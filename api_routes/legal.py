from flask import Blueprint, request, jsonify, session
from db import get_db
import bcrypt
import os
from api_routes.blockchain_utils import record_block

legal_bp = Blueprint('legal', __name__)

@legal_bp.route('/login.php', methods=['POST'])
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
    user = conn.execute('SELECT * FROM PendampingHukum WHERE email = ?', (email,)).fetchone()

    if not user:
        return jsonify({'status': 'error', 'message': 'Email atau password salah'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'status': 'error', 'message': 'Email atau password salah'}), 401

    if user['status'] != 'aktif':
        return jsonify({'status': 'error', 'message': 'Akun Anda tidak aktif. Hubungi Admin.'}), 403

    # session.clear() - Removed to prevent logging out other roles
    session.permanent = True
    session['legal_id'] = user['id']
    session['legal_name'] = user['nama_lengkap']
    session['legal_email'] = user['email']
    session['legal_logged_in'] = True
    session['csrf_token'] = os.urandom(16).hex()

    conn.execute('UPDATE PendampingHukum SET failed_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
    conn.commit()

    return jsonify({
        'status': 'success',
        'message': 'Login berhasil',
        'data': {
            'id': user['id'],
            'name': user['nama_lengkap'],
            'email': user['email']
        },
        'redirect': 'dashboard.html'
    })

@legal_bp.route('/check.php', methods=['GET'])
def check():
    if not session.get('legal_logged_in'):
        return jsonify({'status': 'unauthorized'}), 401
    return jsonify({
        'status': 'authenticated',
        'user': {
            'id': session['legal_id'],
            'name': session['legal_name'],
            'email': session['legal_email']
        }
    })

@legal_bp.route('/logout.php', methods=['GET', 'POST'])
def logout():
    session.pop('legal_id', None)
    session.pop('legal_name', None)
    session.pop('legal_email', None)
    session.pop('legal_logged_in', None)
    return jsonify({'status': 'success', 'message': 'Berhasil logout'})

# Get cases that have been escalated to legal (status = 'Eskalasi Hukum')
@legal_bp.route('/get_cases.php', methods=['GET'])
def get_cases():
    if not session.get('legal_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    conn = get_db()
    cases = conn.execute('''
        SELECT l.id, l.kode_pelaporan, l.status_laporan, l.status_darurat,
               l.tingkat_kekhawatiran, l.email_korban, l.gender_korban,
               l.usia_korban, l.pelaku_kekerasan, l.lokasi_kejadian,
               l.detail_kejadian, l.created_at,
               (SELECT COUNT(*) FROM CatatanHukum ch WHERE ch.laporan_id = l.id) as has_legal_notes,
               (SELECT c2.tingkat_risiko FROM CatatanKonsultasi c2 WHERE c2.laporan_id = l.id ORDER BY c2.created_at DESC LIMIT 1) as psikolog_risk
        FROM Laporan l
        WHERE l.status_laporan LIKE '%Eskalasi Hukum%' 
           OR l.id IN (SELECT laporan_id FROM CatatanHukum WHERE legal_id = ?)
           OR l.id IN (SELECT laporan_id FROM StatusHistory WHERE status_baru LIKE '%Eskalasi Hukum%')
        ORDER BY l.created_at DESC
    ''', (session['legal_id'],)).fetchall()
    
    return jsonify({
        'status': 'success',
        'data': {'cases': [dict(c) for c in cases]}
    })

@legal_bp.route('/get_case_detail.php', methods=['GET'])
def get_case_detail():
    if not session.get('legal_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    case_id = request.args.get('id')
    conn = get_db()
    laporan = conn.execute("SELECT * FROM Laporan WHERE id = ?", (case_id,)).fetchone()
    if not laporan:
        return jsonify({'status': 'error', 'message': 'Not found'}), 404
        
    data = dict(laporan)
    
    # Get Psikolog notes
    catatan_psikolog = conn.execute('''
        SELECT c.*, p.nama_lengkap as psikolog_nama
        FROM CatatanKonsultasi c
        LEFT JOIN Psikolog p ON c.psikolog_id = p.id
        WHERE c.laporan_id = ?
        ORDER BY c.created_at DESC
    ''', (case_id,)).fetchall()
    data['catatan_psikolog'] = [dict(c) for c in catatan_psikolog]
    
    # Get Legal notes
    catatan_hukum = conn.execute('''
        SELECT ch.*, ph.nama_lengkap as legal_nama
        FROM CatatanHukum ch
        LEFT JOIN PendampingHukum ph ON ch.legal_id = ph.id
        WHERE ch.laporan_id = ?
        ORDER BY ch.created_at DESC
    ''', (case_id,)).fetchall()
    data['catatan_hukum'] = [dict(c) for c in catatan_hukum]
    
    # Get Status History (Audit Trail)
    history = conn.execute('''
        SELECT * FROM StatusHistory WHERE laporan_id = ? ORDER BY created_at DESC
    ''', (case_id,)).fetchall()
    data['history'] = [dict(h) for h in history]
    
    # Get Feedback
    feedback = conn.execute('''
        SELECT * FROM FeedbackUser WHERE laporan_id = ? ORDER BY created_at ASC
    ''', (case_id,)).fetchall()
    data['feedback'] = [dict(f) for f in feedback]
    
    return jsonify({'status': 'success', 'data': data})

@legal_bp.route('/save_analysis.php', methods=['POST'])
def save_analysis():
    if not session.get('legal_logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    data = request.get_json()
    laporan_id = data.get('laporan_id')
    analisis = data.get('analisis_hukum', '')
    rekomendasi = data.get('rekomendasi_hukum', '')
    pasal = data.get('pasal', data.get('pasal_terkait', ''))
    
    if not laporan_id or not analisis:
        return jsonify({'status': 'error', 'message': 'Data tidak lengkap'}), 400
        
    conn = get_db()
    
    conn.execute('''
        INSERT INTO CatatanHukum (laporan_id, legal_id, analisis_hukum, rekomendasi_hukum, pasal_terkait, status_catatan)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (laporan_id, session['legal_id'], analisis, rekomendasi, pasal, 'final'))
    
    # (Removed misleading StatusHistory insert. CatatanHukum is read directly by the frontend)
    
    # Record to Blockchain
    record_block('CATATAN_HUKUM', 'legal', session['legal_id'], int(laporan_id), {
        'analisis_hukum': analisis,
        'rekomendasi_hukum': rekomendasi,
        'pasal_terkait': pasal,
        'legal_nama': session.get('legal_name', '')
    }, conn)
    
    conn.commit()
    
    return jsonify({'status': 'success', 'message': 'Analisis hukum berhasil disimpan'})
