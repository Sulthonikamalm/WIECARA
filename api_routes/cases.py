import math
from flask import Blueprint, request, jsonify, session
from db import get_db
from api_routes.blockchain_utils import record_block

cases_bp = Blueprint('cases', __name__)

@cases_bp.route('/get_cases.php', methods=['GET'])
def get_cases():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    offset = (page - 1) * limit
    
    search = request.args.get('search', '')
    statusFilter = request.args.get('status', '')
    
    conn = get_db()
    
    where_clauses = []
    params = []
    
    if search:
        where_clauses.append("(kode_pelaporan LIKE ? OR email_korban LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    if statusFilter:
        where_clauses.append("status_laporan = ?")
        params.append(statusFilter)
        
    where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    
    count_query = f"SELECT COUNT(*) FROM Laporan {where_str}"
    total = conn.execute(count_query, params).fetchone()[0]
    
    query = f"""
        SELECT l.*, 
        (SELECT COUNT(*) FROM Bukti b WHERE b.laporan_id = l.id) as bukti_count 
        FROM Laporan l 
        {where_str} 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    """
    
    cases_params = params + [limit, offset]
    cases_rows = conn.execute(query, cases_params).fetchall()
    
    cases = []
    for c in cases_rows:
        cdict = dict(c)
        cdict['formatted_date'] = c['created_at']
        cases.append(cdict)
        
    return jsonify({
        'status': 'success',
        'data': {
            'cases': cases,
            'total_count': total
        },
        'pagination': {
            'current_page': page,
            'total_pages': math.ceil(total / limit) if limit > 0 else 1,
            'total_records': total,
            'limit': limit,
            'has_next': page * limit < total,
            'has_prev': page > 1
        }
    })

@cases_bp.route('/get_public_stats.php', methods=['GET'])
def get_public_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM Laporan").fetchone()[0]
    process = conn.execute("SELECT COUNT(*) FROM Laporan WHERE status_laporan IN ('Process', 'Investigasi')").fetchone()[0]
    resolved = conn.execute("SELECT COUNT(*) FROM Laporan WHERE status_laporan IN ('Completed', 'Closed')").fetchone()[0]
    
    return jsonify({
        'status': 'success',
        'data': {
            'total_cases': total,
            'active_cases': process,
            'resolved_cases': resolved,
            'psikolog_count': 5, # Mock for public display
            'hukum_count': 2    # Mock for public display
        }
    })

@cases_bp.route('/get_statistics.php', methods=['GET'])
def get_statistics():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM Laporan").fetchone()[0]
    process = conn.execute("SELECT COUNT(*) FROM Laporan WHERE status_laporan IN ('Process', 'Investigasi')").fetchone()[0]
    resolved = conn.execute("SELECT COUNT(*) FROM Laporan WHERE status_laporan IN ('Completed', 'Closed')").fetchone()[0]
    
    return jsonify({
        'status': 'success',
        'data': {
            'total_cases': total,
            'active_cases': process,
            'resolved_cases': resolved,
            'recent_activity': []
        }
    })

@cases_bp.route('/get_case_detail.php', methods=['GET'])
def get_case_detail():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    case_id = request.args.get('id')
    conn = get_db()
    laporan = conn.execute("SELECT * FROM Laporan WHERE id = ?", (case_id,)).fetchone()
    if not laporan:
        return jsonify({'status': 'error', 'message': 'Not found'}), 404
        
    bukti = conn.execute("SELECT * FROM Bukti WHERE laporan_id = ?", (case_id,)).fetchall()
    
    # Get Feedback
    feedback = conn.execute("SELECT * FROM FeedbackUser WHERE laporan_id = ? ORDER BY created_at ASC", (case_id,)).fetchall()
    
    # Get Status History
    history = conn.execute("SELECT * FROM StatusHistory WHERE laporan_id = ? ORDER BY created_at DESC", (case_id,)).fetchall()
    
    data = dict(laporan)
    data['bukti'] = [dict(b) for b in bukti]
    data['feedback'] = [dict(f) for f in feedback]
    data['history'] = [dict(h) for h in history]
    
    # Get Legal notes (CatatanHukum)
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

    # Get CatatanKonsultasi (Psikolog notes)
    try:
        catatan_psikolog = conn.execute('''
            SELECT c.*, p.nama_lengkap as psikolog_nama
            FROM CatatanKonsultasi c
            LEFT JOIN Psikolog p ON c.psikolog_id = p.id
            WHERE c.laporan_id = ?
            ORDER BY c.created_at DESC
        ''', (case_id,)).fetchall()
        data['catatan_psikolog'] = [dict(c) for c in catatan_psikolog]
    except Exception:
        data['catatan_psikolog'] = []
    
    # Get Jadwal
    jadwals = conn.execute('''
        SELECT j.*, p.nama_lengkap as psikolog_nama
        FROM JadwalPertemuan j
        LEFT JOIN Psikolog p ON j.psikolog_id = p.id
        WHERE j.laporan_id = ?
        ORDER BY j.created_at DESC
    ''', (case_id,)).fetchall()
    data['jadwal'] = [dict(j) for j in jadwals]
    
    return jsonify({'status': 'success', 'data': data})

@cases_bp.route('/update_case.php', methods=['POST'])
def update_case():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    
    data = request.get_json()
    case_id = data.get('id')
    new_status = data.get('status_laporan')
    
    if not case_id or not new_status:
        return jsonify({'status': 'error', 'message': 'Missing params'}), 400
        
    conn = get_db()
    
    # Get current status
    current_case = conn.execute("SELECT status_laporan FROM Laporan WHERE id = ?", (case_id,)).fetchone()
    if not current_case:
        return jsonify({'status': 'error', 'message': 'Case not found'}), 404
        
    old_status = current_case['status_laporan']
    
    # Handle parallel statuses: combine Eskalasi Hukum with Dijadwalkan
    final_status = new_status
    if old_status != new_status:
        # If adding Eskalasi Hukum and case is already Dijadwalkan, combine them
        if new_status == 'Eskalasi Hukum' and 'Dijadwalkan' in old_status:
            final_status = 'Eskalasi Hukum & Dijadwalkan'
        # If adding Dijadwalkan and case already has Eskalasi Hukum, combine them
        elif new_status == 'Dijadwalkan' and 'Eskalasi Hukum' in old_status:
            final_status = 'Eskalasi Hukum & Dijadwalkan'
        
        conn.execute("UPDATE Laporan SET status_laporan = ? WHERE id = ?", (final_status, case_id))
        
        # Log to StatusHistory
        conn.execute('''
            INSERT INTO StatusHistory (laporan_id, status_lama, status_baru, diubah_oleh_role, diubah_oleh_id, keterangan)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (case_id, old_status, final_status, 'admin', session.get('admin_id', 1), f"Status diperbarui menjadi {final_status}"))
        
        # Record to Blockchain
        record_block('STATUS_UPDATE', 'admin', session.get('admin_id', 1), int(case_id), {
            'status_lama': old_status,
            'status_baru': final_status,
            'diubah_oleh': 'Admin'
        }, conn)
        
        conn.commit()
    
    return jsonify({'status': 'success', 'message': 'Case updated'})

@cases_bp.route('/delete_case.php', methods=['POST'])
def delete_case():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    
    data = request.get_json(silent=True) or {}
    case_id = data.get('id')
    if not case_id:
        return jsonify({'status': 'error', 'message': 'Parameter id wajib diisi'}), 400

    conn = get_db()
    # Pastikan kasus benar-benar ada agar tidak mengembalikan sukses palsu.
    laporan = conn.execute("SELECT kode_pelaporan FROM Laporan WHERE id = ?", (case_id,)).fetchone()
    if not laporan:
        return jsonify({'status': 'error', 'message': 'Kasus tidak ditemukan'}), 404

    # Catat ke blockchain sebelum dihapus. Data anak (Bukti, Jadwal, Catatan, dst)
    # ikut terhapus otomatis lewat ON DELETE CASCADE karena foreign key kini aktif.
    record_block('DELETE_CASE', 'admin', session.get('admin_id', 1), int(case_id), {
        'kode_pelaporan': laporan['kode_pelaporan'],
        'dihapus_oleh': 'Admin'
    }, conn)

    conn.execute("DELETE FROM Laporan WHERE id = ?", (case_id,))
    conn.commit()

    return jsonify({'status': 'success', 'message': 'Case deleted'})

@cases_bp.route('/schedule_case.php', methods=['POST'])
def schedule_case():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    data = request.get_json()
    laporan_id = data.get('laporan_id')
    psikolog_id = data.get('psikolog_id')
    waktu_mulai = data.get('waktu_mulai')
    waktu_selesai = data.get('waktu_selesai')
    tipe = data.get('tipe_pertemuan', 'online')
    lokasi = data.get('lokasi_link', '')
    
    if not laporan_id or not psikolog_id or not waktu_mulai or not waktu_selesai:
        return jsonify({'status': 'error', 'message': 'Missing required fields'}), 400
        
    conn = get_db()
    
    # Check if case exists
    case_exists = conn.execute("SELECT id, status_laporan FROM Laporan WHERE id = ?", (laporan_id,)).fetchone()
    if not case_exists:
        return jsonify({'status': 'error', 'message': 'Case not found'}), 404
        
    conn.execute('''
        INSERT INTO JadwalPertemuan (laporan_id, psikolog_id, waktu_mulai, waktu_selesai, tipe, tempat_atau_link, status_jadwal, scheduled_by_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ''', (laporan_id, psikolog_id, waktu_mulai, waktu_selesai, tipe, lokasi, 'Scheduled'))
    
    # Assign psikolog. If status is 'Eskalasi Hukum', combine them.
    old_status = case_exists['status_laporan'] if 'status_laporan' in case_exists.keys() else 'Unknown'
    if 'Eskalasi Hukum' in old_status:
        new_status_label = 'Eskalasi Hukum & Dijadwalkan'
        conn.execute("UPDATE Laporan SET status_laporan = ?, assigned_psikolog_id = ? WHERE id = ?", (new_status_label, psikolog_id, laporan_id))
    else:
        new_status_label = 'Dijadwalkan'
        conn.execute("UPDATE Laporan SET status_laporan = ?, assigned_psikolog_id = ? WHERE id = ?", (new_status_label, psikolog_id, laporan_id))
    
    # Log to StatusHistory
    conn.execute('''
        INSERT INTO StatusHistory (laporan_id, status_lama, status_baru, diubah_oleh_role, diubah_oleh_id, keterangan)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (laporan_id, old_status, new_status_label, 'admin', session.get('admin_id', 1), "Jadwal konsultasi telah ditetapkan oleh Admin."))
    
    # Record to Blockchain
    record_block('JADWAL_BARU', 'admin', session.get('admin_id', 1), int(laporan_id), {
        'psikolog_id': psikolog_id,
        'waktu_mulai': waktu_mulai,
        'waktu_selesai': waktu_selesai,
        'tipe': tipe,
        'lokasi': lokasi,
        'status_baru': new_status_label
    }, conn)
    
    conn.commit()
    
    return jsonify({'status': 'success', 'message': 'Berhasil menjadwalkan kasus.'})

