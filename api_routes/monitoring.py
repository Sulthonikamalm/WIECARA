from flask import Blueprint, request, jsonify
from db import get_db
from api_routes.blockchain_utils import record_block

monitoring_bp = Blueprint('monitoring', __name__)

@monitoring_bp.route('/check_progress.php', methods=['GET', 'POST'])
def check_progress():
    if request.method == 'POST':
        data = request.get_json()
        query = data.get('query') if data else None
    else:
        query = request.args.get('kode') or request.args.get('query')
        
    if not query:
        return jsonify({'status': 'error', 'message': 'Parameter query diperlukan'}), 400
        
    conn = get_db()
    laporan = conn.execute('''
        SELECT id, kode_pelaporan, status_laporan, status_darurat, 
               tingkat_kekhawatiran, email_korban, created_at 
        FROM Laporan 
        WHERE kode_pelaporan = ? OR email_korban = ? 
        LIMIT 1
    ''', (query, query)).fetchone()
    
    if not laporan:
        return jsonify({'status': 'error', 'message': 'Data tidak ditemukan'})
        
    laporan_id = laporan['id']
    timeline = []
    activity_log = []
    
    # ===== EVENT 1: Laporan Diterima =====
    timeline.append({
        'type': 'created',
        'title': 'Laporan Diterima',
        'desc': 'Sistem telah menerima laporan Anda dan sedang menunggu peninjauan oleh Admin.',
        'timestamp': laporan['created_at'],
        'status': 'completed'
    })
    activity_log.append({
        'action': 'Laporan dikirim ke sistem',
        'actor': 'Sistem',
        'timestamp': laporan['created_at']
    })
    
    # ===== EVENT 2: Status History (Admin actions) =====
    status_history = conn.execute('''
        SELECT sh.status_lama, sh.status_baru, sh.keterangan, sh.diubah_oleh_role, sh.created_at
        FROM StatusHistory sh
        WHERE sh.laporan_id = ? 
        ORDER BY sh.created_at ASC
    ''', (laporan_id,)).fetchall()
    
    status_descriptions = {
        'Investigasi': 'Laporan Anda sedang dalam tahap investigasi oleh Tim Satgas.',
        'Dijadwalkan': 'Jadwal konsultasi dengan Psikolog telah ditetapkan.',
        'Dilanjutkan': 'Kasus Anda sedang diproses lebih lanjut oleh Tim.',
        'Eskalasi Hukum': 'Kasus Anda telah dieskalasi ke jalur hukum untuk penanganan lebih lanjut.',
        'Ditolak': 'Laporan Anda ditolak. Silakan hubungi Admin untuk informasi lebih lanjut.',
        'Closed': 'Kasus Anda telah ditutup dan dinyatakan selesai.',
        'Completed': 'Proses konsultasi telah selesai. Terima kasih atas kepercayaan Anda.'
    }
    
    for sh in status_history:
        role_label = 'Admin' if sh['diubah_oleh_role'] == 'admin' else 'Psikolog'
        desc = sh['keterangan'] or status_descriptions.get(sh['status_baru'], f"Status diperbarui menjadi {sh['status_baru']}")
        
        timeline.append({
            'type': 'status_update',
            'title': f"Status: {sh['status_baru']}",
            'desc': desc,
            'timestamp': sh['created_at'],
            'status': 'completed'
        })
        activity_log.append({
            'action': f"Status diubah dari '{sh['status_lama']}' ke '{sh['status_baru']}'",
            'actor': role_label,
            'timestamp': sh['created_at']
        })
        
    # ===== EVENT 3: Jadwal Konsultasi =====
    jadwals = conn.execute('''
        SELECT j.id, j.waktu_mulai, j.waktu_selesai, j.tipe, j.tempat_atau_link, 
               j.status_jadwal, j.catatan_admin, j.created_at,
               p.nama_lengkap as psikolog_nama, p.spesialisasi as psikolog_spesialisasi
        FROM JadwalPertemuan j
        LEFT JOIN Psikolog p ON j.psikolog_id = p.id
        WHERE j.laporan_id = ?
        ORDER BY j.created_at ASC
    ''', (laporan_id,)).fetchall()
    
    for j in jadwals:
        tipe_label = 'Online (Video Call)' if j['tipe'] == 'online' else 'Tatap Muka (Offline)'
        timeline.append({
            'type': 'schedule',
            'title': 'Jadwal Konsultasi Ditetapkan',
            'desc': f"Anda dijadwalkan untuk konsultasi dengan {j['psikolog_nama']} ({j['psikolog_spesialisasi'] or 'Umum'}).",
            'details': {
                'psikolog': j['psikolog_nama'],
                'spesialisasi': j['psikolog_spesialisasi'] or 'Umum',
                'waktu_mulai': j['waktu_mulai'],
                'waktu_selesai': j['waktu_selesai'],
                'tipe': tipe_label,
                'lokasi': j['tempat_atau_link'],
                'status_jadwal': j['status_jadwal'],
                'catatan_admin': j['catatan_admin']
            },
            'timestamp': j['created_at'],
            'status': 'active' if j['status_jadwal'] in ('Scheduled', 'scheduled') else 'completed'
        })
        activity_log.append({
            'action': f"Jadwal konsultasi ditetapkan ({tipe_label}) — {j['waktu_mulai']}",
            'actor': 'Admin',
            'timestamp': j['created_at']
        })
    
    # ===== EVENT 4: Catatan Konsultasi (Psikolog notes) =====
    catatan = conn.execute('''
        SELECT c.ringkasan_kasus, c.detail_konsultasi, c.rekomendasi, c.tingkat_risiko, 
               c.status_catatan, c.created_at,
               p.nama_lengkap as psikolog_nama
        FROM CatatanKonsultasi c
        LEFT JOIN Psikolog p ON c.psikolog_id = p.id
        WHERE c.laporan_id = ?
        ORDER BY c.created_at ASC
    ''', (laporan_id,)).fetchall()
    
    for ct in catatan:
        risiko_map = {'rendah': '🟢 Rendah', 'sedang': '🟡 Sedang', 'tinggi': '🔴 Tinggi', 'kritis': '⚫ Kritis'}
        timeline.append({
            'type': 'consultation_note',
            'title': 'Catatan Konsultasi dari Psikolog',
            'desc': f"Psikolog {ct['psikolog_nama']} telah menyelesaikan sesi dan memberikan catatan.",
            'details': {
                'ringkasan': ct['ringkasan_kasus'],
                'detail_konsultasi': ct['detail_konsultasi'],
                'rekomendasi': ct['rekomendasi'] or '-',
                'tingkat_risiko': risiko_map.get(ct['tingkat_risiko'], ct['tingkat_risiko']),
                'status': ct['status_catatan']
            },
            'timestamp': ct['created_at'],
            'status': 'completed'
        })
        activity_log.append({
            'action': f"Catatan konsultasi ditulis oleh {ct['psikolog_nama']}",
            'actor': 'Psikolog',
            'timestamp': ct['created_at']
        })
        
    # ===== EVENT 5: Catatan Hukum (Legal analysis) =====
    try:
        catatan_hukum = conn.execute('''
            SELECT ch.analisis_hukum, ch.rekomendasi_hukum, ch.pasal_terkait, ch.created_at,
                   ph.nama_lengkap as legal_nama
            FROM CatatanHukum ch
            LEFT JOIN PendampingHukum ph ON ch.legal_id = ph.id
            WHERE ch.laporan_id = ?
            ORDER BY ch.created_at ASC
        ''', (laporan_id,)).fetchall()
        
        for ch in catatan_hukum:
            timeline.append({
                'type': 'legal_note',
                'title': 'Analisis Hukum dari Pendamping Hukum',
                'desc': f"Pendamping Hukum {ch['legal_nama']} telah memberikan analisis dan rekomendasi hukum.",
                'details': {
                    'analisis': ch['analisis_hukum'],
                    'rekomendasi': ch['rekomendasi_hukum'],
                    'pasal_terkait': ch['pasal_terkait'] or '-'
                },
                'timestamp': ch['created_at'],
                'status': 'completed'
            })
            activity_log.append({
                'action': f"Analisis hukum ditulis oleh {ch['legal_nama']}",
                'actor': 'Pendamping Hukum',
                'timestamp': ch['created_at']
            })
    except Exception:
        pass  # Table may not exist in older DBs
        
    # ===== EVENT 6: Feedback User =====
    feedbacks = conn.execute('''
        SELECT tipe_feedback, komentar_user, respon_psikolog, created_at, responded_at
        FROM FeedbackUser
        WHERE laporan_id = ?
        ORDER BY created_at ASC
    ''', (laporan_id,)).fetchall()
    
    for fb in feedbacks:
        timeline.append({
            'type': 'feedback',
            'title': 'Umpan Balik Anda',
            'desc': fb['komentar_user'],
            'timestamp': fb['created_at'],
            'status': 'completed'
        })
        activity_log.append({
            'action': f"Pelapor mengirim umpan balik: \"{fb['komentar_user'][:50]}...\"" if len(fb['komentar_user'] or '') > 50 else f"Pelapor mengirim umpan balik",
            'actor': 'Pelapor',
            'timestamp': fb['created_at']
        })
        
        # If psikolog responded
        if fb['respon_psikolog']:
            timeline.append({
                'type': 'psikolog_response',
                'title': 'Balasan dari Psikolog',
                'desc': fb['respon_psikolog'],
                'timestamp': fb['responded_at'] or fb['created_at'],
                'status': 'completed'
            })
            activity_log.append({
                'action': 'Psikolog membalas umpan balik',
                'actor': 'Psikolog',
                'timestamp': fb['responded_at'] or fb['created_at']
            })
        
    # Sort everything by timestamp
    timeline.sort(key=lambda x: x['timestamp'] or '')
    activity_log.sort(key=lambda x: x['timestamp'] or '', reverse=True)
    
    return jsonify({
        'status': 'success',
        'data': {
            'laporan': dict(laporan),
            'timeline': timeline,
            'activity_log': activity_log
        }
    })

@monitoring_bp.route('/submit_feedback.php', methods=['POST'])
def submit_feedback():
    data = request.get_json(silent=True) or {}
    kode = (data.get('kode_pelaporan') or '').strip()
    pesan = data.get('pesan')
    tipe = data.get('tipe_feedback', 'Umum')

    if not kode or not pesan:
        return jsonify({'status': 'error', 'message': 'Kode pelaporan dan pesan wajib diisi'}), 400

    conn = get_db()

    # Kode pelaporan berfungsi sebagai token kepemilikan. Resolusi id lewat kode
    # (bukan id mentah dari client) mencegah IDOR: pengirim feedback harus tahu
    # kode laporan, bukan sekadar menebak id berurutan.
    laporan = conn.execute("SELECT id FROM Laporan WHERE kode_pelaporan = ?", (kode,)).fetchone()
    if not laporan:
        return jsonify({'status': 'error', 'message': 'Laporan tidak ditemukan'}), 404
    laporan_id = laporan['id']

    conn.execute('''
        INSERT INTO FeedbackUser (laporan_id, catatan_id, tipe_feedback, komentar_user)
        VALUES (?, NULL, ?, ?)
    ''', (laporan_id, tipe, pesan))
    
    # Record to Blockchain
    record_block('FEEDBACK_USER', 'user', 0, int(laporan_id), {
        'tipe_feedback': tipe,
        'pesan': pesan
    }, conn)
    
    conn.commit()
    
    return jsonify({'status': 'success', 'message': 'Feedback berhasil dikirim'})

@monitoring_bp.route('/get_laporan.php', methods=['POST'])
def get_laporan():
    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({'status': 'error', 'message': 'Parameter query diperlukan'}), 400
        
    query = data['query']
    
    conn = get_db()
    laporan = conn.execute('''
        SELECT *
        FROM Laporan 
        WHERE kode_pelaporan = ? OR email_korban = ? 
        LIMIT 1
    ''', (query, query)).fetchone()
    
    if laporan:
        return jsonify({
            'status': 'success',
            'data': dict(laporan)
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'Data tidak ditemukan'
        })

@monitoring_bp.route('/close_case.php', methods=['POST'])
def close_case():
    data = request.get_json(silent=True) or {}
    kode = (data.get('kode_pelaporan') or '').strip()

    if not kode:
        return jsonify({'status': 'error', 'message': 'Kode pelaporan wajib diisi'}), 400

    conn = get_db()

    # Kode pelaporan = token kepemilikan. Lookup by kode (bukan id mentah dari
    # client) mencegah IDOR menutup kasus orang lain via id berurutan.
    current = conn.execute(
        "SELECT id, status_laporan FROM Laporan WHERE kode_pelaporan = ?", (kode,)
    ).fetchone()
    if not current:
        return jsonify({'status': 'error', 'message': 'Laporan tidak ditemukan'}), 404

    laporan_id = current['id']
    old_status = current['status_laporan']
    
    if old_status in ('Closed', 'Completed'):
        return jsonify({'status': 'success', 'message': 'Laporan sudah selesai'})
        
    # Update to Completed
    conn.execute("UPDATE Laporan SET status_laporan = 'Completed' WHERE id = ?", (laporan_id,))
    
    # Log to StatusHistory
    conn.execute('''
        INSERT INTO StatusHistory (laporan_id, status_lama, status_baru, diubah_oleh_role, diubah_oleh_id, keterangan)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (laporan_id, old_status, 'Completed', 'user', 0, 'Pelapor telah mengkonfirmasi bahwa masalah telah diselesaikan dan menutup kasus ini.'))
    
    # Record to Blockchain
    record_block('CLOSE_CASE', 'user', 0, int(laporan_id), {
        'status_lama': old_status,
        'status_baru': 'Completed',
        'pesan': 'Pelapor menutup kasus'
    }, conn)
    
    conn.commit()
    return jsonify({'status': 'success', 'message': 'Laporan berhasil ditutup'})
