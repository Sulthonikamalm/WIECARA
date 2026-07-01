from flask import Blueprint, request, jsonify, session
from db import get_db
import bcrypt
import os
from api_routes.blockchain_utils import record_block

psikolog_bp = Blueprint('psikolog', __name__)

@psikolog_bp.route('/login.php', methods=['POST'])
def login():
    if request.is_json:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
    else:
        email = request.form.get('email')
        password = request.form.get('password')

    if not email or not password:
        return jsonify({'status': 'error', 'message': 'Email dan password wajib diisi'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM Psikolog WHERE email = ?', (email,)).fetchone()

    if not user:
        return jsonify({'status': 'error', 'message': 'Email atau password salah'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'status': 'error', 'message': 'Email atau password salah'}), 401

    if user['status'] != 'aktif':
        return jsonify({'status': 'error', 'message': 'Akun Anda tidak aktif. Hubungi Admin.'}), 403

    # session.clear() - Removed to prevent logging out other roles
    session.permanent = True
    session['psikolog_id'] = user['id']
    session['psikolog_name'] = user['nama_lengkap']
    session['psikolog_email'] = user['email']
    session['psikolog_logged_in'] = True
    session['csrf_token'] = os.urandom(16).hex()

    conn.execute('UPDATE Psikolog SET failed_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
    conn.commit()

    return jsonify({
        'status': 'success',
        'message': 'Login berhasil',
        'data': {
            'id': user['id'],
            'name': user['nama_lengkap'],
            'email': user['email']
        },
        'csrf_token': session['csrf_token'],
        'redirect': 'dashboard.html'
    })

@psikolog_bp.route('/logout.php', methods=['GET', 'POST'])
def logout():
    session.pop('psikolog_id', None)
    session.pop('psikolog_name', None)
    session.pop('psikolog_email', None)
    session.pop('psikolog_logged_in', None)
    return jsonify({
        'status': 'success',
        'message': 'Berhasil logout',
        'redirect': '../index.html'
    })

@psikolog_bp.route('/get_dashboard_stats.php', methods=['GET'])
def get_dashboard_stats():
    if not session.get('psikolog_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    
    conn = get_db()
    total = conn.execute("SELECT COUNT(DISTINCT l.id) FROM Laporan l LEFT JOIN JadwalPertemuan j ON l.id = j.laporan_id WHERE l.assigned_psikolog_id = ? OR j.psikolog_id = ?", (session['psikolog_id'], session['psikolog_id'])).fetchone()[0]
    upcoming = conn.execute("SELECT COUNT(*) FROM JadwalPertemuan WHERE psikolog_id = ? AND status_jadwal != 'Selesai'", (session['psikolog_id'],)).fetchone()[0]
    completed = conn.execute("SELECT COUNT(DISTINCT l.id) FROM Laporan l LEFT JOIN JadwalPertemuan j ON l.id = j.laporan_id WHERE (l.assigned_psikolog_id = ? OR j.psikolog_id = ?) AND l.status_laporan = 'Completed'", (session['psikolog_id'], session['psikolog_id'])).fetchone()[0]
    return jsonify({'status': 'success', 'data': {'total_cases': total, 'upcoming_sessions': upcoming, 'completed_sessions': completed}})

@psikolog_bp.route('/get_cases.php', methods=['GET'])
def get_cases():
    if not session.get('psikolog_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    conn = get_db()
    jadwal = conn.execute('''
        SELECT 
            l.id as laporan_id, l.id as id, l.kode_pelaporan, l.status_laporan, l.created_at as formatted_date,
            j.id as jadwal_id, j.status_jadwal as status,
            COALESCE(DATE(j.waktu_mulai), '') as tanggal, 
            COALESCE(TIME(j.waktu_mulai), '') as waktu,
            COALESCE(j.tipe, 'offline') as tipe_konseling,
            COALESCE(j.tempat_atau_link, 'Belum ditentukan') as lokasi
        FROM Laporan l
        LEFT JOIN JadwalPertemuan j ON l.id = j.laporan_id
        WHERE l.assigned_psikolog_id = ? OR j.psikolog_id = ?
    ''', (session['psikolog_id'], session['psikolog_id'])).fetchall()
    
    cases = [dict(j) for j in jadwal]
    return jsonify({'status': 'success', 'data': {'cases': cases}})

@psikolog_bp.route('/get_case_detail.php', methods=['GET'])
def get_case_detail():
    if not session.get('psikolog_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    case_id = request.args.get('id')
    conn = get_db()
    laporan = conn.execute("SELECT * FROM Laporan WHERE id = ?", (case_id,)).fetchone()
    if not laporan:
        return jsonify({'status': 'error', 'message': 'Not found'}), 404
        
    data = dict(laporan)
    bukti = conn.execute("SELECT * FROM Bukti WHERE laporan_id = ?", (case_id,)).fetchall()
    data['bukti'] = [dict(b) for b in bukti]
    
    # Get Feedback
    feedback = conn.execute("SELECT * FROM FeedbackUser WHERE laporan_id = ? ORDER BY created_at ASC", (case_id,)).fetchall()
    data['feedback'] = [dict(f) for f in feedback]
    
    # Get Status History
    history = conn.execute("SELECT * FROM StatusHistory WHERE laporan_id = ? ORDER BY created_at DESC", (case_id,)).fetchall()
    data['history'] = [dict(h) for h in history]
    
    # Get CatatanKonsultasi (Psikolog notes - all for this case)
    try:
        catatan = conn.execute('''
            SELECT c.*, p.nama_lengkap as psikolog_nama 
            FROM CatatanKonsultasi c 
            LEFT JOIN Psikolog p ON c.psikolog_id = p.id 
            WHERE c.laporan_id = ? 
            ORDER BY c.created_at DESC
        ''', (case_id,)).fetchall()
        data['catatan_psikolog'] = [dict(c) for c in catatan]
    except Exception:
        data['catatan_psikolog'] = []
    
    # Get CatatanHukum (Legal notes - so psikolog can see legal analysis too)
    try:
        catatan_hukum = conn.execute('''
            SELECT ch.*, ph.nama_lengkap as legal_nama
            FROM CatatanHukum ch
            LEFT JOIN PendampingHukum ph ON ch.legal_id = ph.id
            WHERE ch.laporan_id = ?
            ORDER BY ch.created_at DESC
        ''', (case_id,)).fetchall()
        data['catatan_hukum'] = [dict(c) for c in catatan_hukum]
    except Exception:
        data['catatan_hukum'] = []
    
    # Get Jadwal
    try:
        jadwals = conn.execute('''
            SELECT j.*, p.nama_lengkap as psikolog_nama
            FROM JadwalPertemuan j
            LEFT JOIN Psikolog p ON j.psikolog_id = p.id
            WHERE j.laporan_id = ?
            ORDER BY j.created_at DESC
        ''', (case_id,)).fetchall()
        data['jadwal'] = [dict(j) for j in jadwals]
    except Exception:
        data['jadwal'] = []
    
    return jsonify({'status': 'success', 'data': data})

@psikolog_bp.route('/update_notes.php', methods=['POST'])
def update_notes():
    if not session.get('psikolog_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    data = request.get_json()
    jadwal_id = data.get('jadwal_id')
    laporan_id_from_data = data.get('laporan_id')
    notes = data.get('notes', '')
    ringkasan = data.get('ringkasan', 'Sesi Konsultasi')
    rekomendasi = data.get('rekomendasi', '')
    tingkat_risiko = data.get('tingkat_risiko', 'sedang')
    new_status = data.get('status', 'Selesai')
    
    conn = get_db()
    laporan_id = None
    
    if jadwal_id:
        # Update jadwal status
        conn.execute("UPDATE JadwalPertemuan SET status_jadwal = ? WHERE id = ? AND psikolog_id = ?", 
                     (new_status, jadwal_id, session['psikolog_id']))
        
        # Get laporan_id from jadwal
        jadwal = conn.execute("SELECT laporan_id FROM JadwalPertemuan WHERE id = ?", (jadwal_id,)).fetchone()
        if jadwal:
            laporan_id = jadwal['laporan_id']
            
    if not laporan_id:
        laporan_id = laporan_id_from_data
        
    if not laporan_id:
        return jsonify({'status': 'error', 'message': 'Kasus tidak valid. Pastikan laporan ID tersedia.'}), 400
    
    # Insert into CatatanKonsultasi with full data
    conn.execute('''
        INSERT INTO CatatanKonsultasi (laporan_id, psikolog_id, jadwal_id, ringkasan_kasus, detail_konsultasi, rekomendasi, tingkat_risiko, status_catatan)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (laporan_id, session['psikolog_id'], jadwal_id, ringkasan, notes, rekomendasi, tingkat_risiko, 'final'))
    
    # Get current laporan status
    current = conn.execute("SELECT status_laporan FROM Laporan WHERE id = ?", (laporan_id,)).fetchone()
    old_status = current['status_laporan'] if current else 'Unknown'
    
    # (Removed misleading StatusHistory insert. CatatanKonsultasi is read directly by the frontend)
    
    # Record to Blockchain
    record_block('CATATAN_PSIKOLOG', 'psikolog', session['psikolog_id'], int(laporan_id), {
        'ringkasan': ringkasan,
        'detail': notes,
        'rekomendasi': rekomendasi,
        'tingkat_risiko': tingkat_risiko,
        'psikolog_nama': session.get('psikolog_name', '')
    }, conn)
        
    conn.commit()
    return jsonify({'status': 'success', 'message': 'Catatan berhasil disimpan'})

@psikolog_bp.route('/get_list.php', methods=['GET'])
def get_list():
    conn = get_db()
    psikologs = conn.execute("SELECT id, nama_lengkap, spesialisasi, status FROM Psikolog WHERE status='aktif'").fetchall()
    return jsonify({'status': 'success', 'data': [dict(p) for p in psikologs]})
