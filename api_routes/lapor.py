from flask import Blueprint, request, jsonify
import os
import time
import random
import uuid
import storage
from db import get_db
from api_routes.blockchain_utils import record_block

lapor_bp = Blueprint('lapor', __name__)

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@lapor_bp.route('/submit.php', methods=['POST'])
def submit():
    input_data = request.form
    if request.is_json:
        input_data = request.get_json()
        
    pelakuKekerasan = input_data.get('pelakuKekerasan')
    waktuKejadian = input_data.get('waktuKejadian')
    lokasiKejadian = input_data.get('lokasiKejadian')
    detailKejadian = input_data.get('detailKejadian')
    emailKorban = input_data.get('emailKorban')
    usiaKorban = input_data.get('usiaKorban')
    
    if not pelakuKekerasan or not waktuKejadian or not lokasiKejadian or not detailKejadian or not emailKorban or not usiaKorban:
        return jsonify({'success': False, 'message': 'Validation failed, some fields are missing.'}), 400
        
    kode_pelaporan = 'PPKPT' + str(int(time.time()))[-6:] + str(random.randint(0, 999)).zfill(3)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO Laporan (
            kode_pelaporan, status_laporan, status_darurat, korban_sebagai,
            tingkat_kekhawatiran, gender_korban, pelaku_kekerasan, waktu_kejadian,
            lokasi_kejadian, detail_kejadian, email_korban, usia_korban,
            whatsapp_korban, status_disabilitas, jenis_disabilitas, chat_session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        kode_pelaporan, 'Investigasi', input_data.get('statusDarurat'), input_data.get('korbanSebagai'),
        input_data.get('tingkatKekhawatiran'), input_data.get('genderKorban'), pelakuKekerasan, waktuKejadian,
        lokasiKejadian, detailKejadian, emailKorban, usiaKorban,
        input_data.get('whatsappKorban'), input_data.get('statusDisabilitas', 'tidak'), input_data.get('jenisDisabilitas'), input_data.get('chatSessionId')
    ))
    laporan_id = cursor.lastrowid
    
    uploaded_files_count = 0
    bukti_files = request.files.getlist('buktiFiles[]')
    if not bukti_files:
        bukti_files = request.files.getlist('buktiFiles')

    for file in bukti_files:
        if file and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"bukti_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}"
            upload_path = os.path.join(storage.UPLOAD_FOLDER, 'bukti', kode_pelaporan)
            os.makedirs(upload_path, exist_ok=True)
            file.save(os.path.join(upload_path, filename))
            
            file_type = 'image' if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] else 'video'
            file_url = f"uploads/bukti/{kode_pelaporan}/{filename}"
            
            cursor.execute('INSERT INTO Bukti (laporan_id, file_url, file_type) VALUES (?, ?, ?)', (laporan_id, file_url, file_type))
            uploaded_files_count += 1
            
    # Record to Blockchain
    record_block('LAPORAN_BARU', 'user', 0, laporan_id, {
        'kode_pelaporan': kode_pelaporan,
        'email_korban': emailKorban,
        'pelaku': pelakuKekerasan,
        'lokasi': lokasiKejadian,
        'status': 'Investigasi',
        'bukti_count': uploaded_files_count
    }, conn)
    
    conn.commit()
    # Koneksi ditutup otomatis oleh teardown_appcontext (lihat db.py), jangan
    # close() manual karena koneksi ini di-cache di flask.g.

    return jsonify({
        'success': True,
        'message': 'Laporan berhasil dikirim',
        'data': {
            'kode_pelaporan': kode_pelaporan,
            'laporan_id': laporan_id,
            'status_laporan': 'Investigasi',
            'uploaded_files': uploaded_files_count,
            'created_at': time.strftime('%Y-%m-%d %H:%M:%S')
        }
    }), 201
