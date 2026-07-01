from flask import Blueprint, request, jsonify, session
from db import get_db
import storage
import os
import time
import uuid

blog_bp = Blueprint('blog', __name__)

# Ekstensi gambar yang diizinkan untuk header artikel blog
EKSTENSI_GAMBAR = {'jpg', 'jpeg', 'png', 'gif', 'webp'}

# Batas ukuran gambar header (5 MB), selaras dengan validasi di frontend blog-form.js
MAKS_UKURAN_GAMBAR = 5 * 1024 * 1024


def _gambar_diizinkan(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in EKSTENSI_GAMBAR


def _tambah_alias_blog(row_dict):
    """
    Tambahkan alias nama field agar konsumen frontend lama tetap kompatibel.
    Tabel sumber adalah ArtikelBlog (judul/isi_postingan/gambar_header_url),
    sedangkan sebagian frontend publik (Blog/js) membaca title/content/thumbnail.
    """
    row_dict['title'] = row_dict.get('judul')
    row_dict['content'] = row_dict.get('isi_postingan')
    row_dict['thumbnail'] = row_dict.get('gambar_header_url')
    return row_dict


@blog_bp.route('/get_blogs.php', methods=['GET'])
def get_blogs():
    conn = get_db()
    blogs = conn.execute("SELECT * FROM ArtikelBlog ORDER BY created_at DESC").fetchall()
    return jsonify({
        'status': 'success',
        'data': [_tambah_alias_blog(dict(b)) for b in blogs]
    })


@blog_bp.route('/get_blog_detail.php', methods=['GET'])
def get_blog_detail():
    blog_id = request.args.get('id')
    if not blog_id:
        return jsonify({'status': 'error', 'message': 'Parameter id wajib diisi'}), 400

    conn = get_db()
    blog = conn.execute("SELECT * FROM ArtikelBlog WHERE id = ?", (blog_id,)).fetchone()

    if not blog:
        return jsonify({'status': 'error', 'message': 'Artikel tidak ditemukan'}), 404

    return jsonify({'status': 'success', 'data': _tambah_alias_blog(dict(blog))})


@blog_bp.route('/create_blog.php', methods=['POST'])
def create_blog():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    judul = (data.get('judul') or '').strip()
    isi_postingan = (data.get('isi_postingan') or '').strip()
    kategori = data.get('kategori')
    gambar_header_url = data.get('gambar_header_url')

    if not judul or not isi_postingan:
        return jsonify({'status': 'error', 'message': 'Judul dan isi postingan wajib diisi'}), 400

    conn = get_db()
    cursor = conn.execute(
        '''INSERT INTO ArtikelBlog (author_id, judul, isi_postingan, gambar_header_url, kategori)
           VALUES (?, ?, ?, ?, ?)''',
        (session.get('admin_id'), judul, isi_postingan, gambar_header_url, kategori)
    )
    conn.commit()
    new_id = cursor.lastrowid

    return jsonify({'status': 'success', 'message': 'Blog created', 'data': {'id': new_id}})


@blog_bp.route('/update_blog.php', methods=['POST'])
def update_blog():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    blog_id = data.get('id')
    judul = (data.get('judul') or '').strip()
    isi_postingan = (data.get('isi_postingan') or '').strip()
    kategori = data.get('kategori')
    gambar_header_url = data.get('gambar_header_url')

    if not blog_id:
        return jsonify({'status': 'error', 'message': 'Parameter id wajib diisi'}), 400
    if not judul or not isi_postingan:
        return jsonify({'status': 'error', 'message': 'Judul dan isi postingan wajib diisi'}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM ArtikelBlog WHERE id = ?", (blog_id,)).fetchone()
    if not existing:
        return jsonify({'status': 'error', 'message': 'Artikel tidak ditemukan'}), 404

    conn.execute(
        '''UPDATE ArtikelBlog
           SET judul = ?, isi_postingan = ?, gambar_header_url = ?, kategori = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?''',
        (judul, isi_postingan, gambar_header_url, kategori, blog_id)
    )
    conn.commit()

    return jsonify({'status': 'success', 'message': 'Blog updated'})


@blog_bp.route('/delete_blog.php', methods=['POST'])
def delete_blog():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}
    blog_id = data.get('id')
    if not blog_id:
        return jsonify({'status': 'error', 'message': 'Parameter id wajib diisi'}), 400

    conn = get_db()
    # Pastikan artikel benar-benar ada agar tidak mengembalikan sukses palsu
    # saat id tidak valid (selaras dengan cases.delete_case).
    existing = conn.execute("SELECT id FROM ArtikelBlog WHERE id = ?", (blog_id,)).fetchone()
    if not existing:
        return jsonify({'status': 'error', 'message': 'Artikel tidak ditemukan'}), 404

    conn.execute("DELETE FROM ArtikelBlog WHERE id = ?", (blog_id,))
    conn.commit()

    return jsonify({'status': 'success', 'message': 'Blog deleted'})


@blog_bp.route('/upload_image.php', methods=['POST'])
def upload_image():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401

    file = request.files.get('image')
    if not file or not file.filename:
        return jsonify({'status': 'error', 'message': 'Tidak ada gambar yang diunggah'}), 400

    if not _gambar_diizinkan(file.filename):
        return jsonify({'status': 'error', 'message': 'Format gambar tidak valid. Gunakan JPEG, PNG, GIF, atau WebP.'}), 400

    # Validasi ukuran tanpa menahan seluruh berkas di memori
    file.seek(0, os.SEEK_END)
    ukuran = file.tell()
    file.seek(0)
    if ukuran > MAKS_UKURAN_GAMBAR:
        return jsonify({'status': 'error', 'message': 'Ukuran gambar maksimal 5MB.'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"blog_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
    upload_dir = os.path.join(storage.UPLOAD_FOLDER, 'blog')
    os.makedirs(upload_dir, exist_ok=True)
    file.save(os.path.join(upload_dir, filename))

    file_url = f"uploads/blog/{filename}"
    # Sertakan dua bentuk respons karena frontend membaca data.url atau data.data.url
    return jsonify({'status': 'success', 'url': file_url, 'data': {'url': file_url}})
