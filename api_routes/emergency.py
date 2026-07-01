import json
import math
import os
import sqlite3
from datetime import datetime

from flask import Blueprint, jsonify, request, session

from db import get_db


emergency_bp = Blueprint('emergency', __name__)
ALLOWED_HIGH_RISK_RESPONSES = {'NEED_HELP_NOW', 'NO_RESPONSE_20_SECONDS'}
ALLOWED_RISK_TYPES = {'SELF_HARM_INTENT', 'FORM_EMERGENCY_BUTTON'}


def _text(value, default='', max_length=2000):
    value = (value or default)
    if not isinstance(value, str):
        value = str(value)
    return value.strip()[:max_length]


def _session_id_unik():
    """Ambil atau buat session id stabil untuk heartbeat lokasi dan emergency case."""
    if 'session_id_unik' not in session:
        session['session_id_unik'] = 'session_' + os.urandom(8).hex()
    return session['session_id_unik']


def _ip_address():
    """Untuk demo, pakai remote_addr dan jangan percaya header proxy dari client."""
    return request.remote_addr or 'unknown'


def _audit(conn, case_id, action, actor, metadata=None):
    conn.execute(
        '''INSERT INTO EmergencyAuditLog (case_id, action, actor, metadata_json)
           VALUES (?, ?, ?, ?)''',
        (case_id, action, actor, json.dumps(metadata or {}, ensure_ascii=False, default=str))
    )


def _normalisasi_lokasi(raw_location):
    if not isinstance(raw_location, dict):
        return None

    try:
        latitude = float(raw_location.get('latitude'))
        longitude = float(raw_location.get('longitude'))
    except (TypeError, ValueError):
        return None

    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or latitude < -90
        or latitude > 90
        or longitude < -180
        or longitude > 180
    ):
        return None

    accuracy = raw_location.get('accuracy')
    try:
        accuracy = float(accuracy) if accuracy is not None else None
    except (TypeError, ValueError):
        accuracy = None
    if accuracy is not None and (not math.isfinite(accuracy) or accuracy < 0):
        accuracy = None

    return {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy
    }


def _last_known_location(conn, session_id_unik):
    row = conn.execute(
        '''SELECT latitude, longitude, accuracy_meters
           FROM EmergencyLocationHeartbeat
           WHERE session_id_unik = ?
           ORDER BY created_at DESC
           LIMIT 1''',
        (session_id_unik,)
    ).fetchone()
    if not row:
        return None
    return {
        'latitude': row['latitude'],
        'longitude': row['longitude'],
        'accuracy': row['accuracy_meters']
    }


def _pilih_lokasi(conn, session_id_unik, fresh_location, request_last_known):
    fresh = _normalisasi_lokasi(fresh_location)
    if fresh:
        return fresh, 'GPS_FRESH'

    request_known = _normalisasi_lokasi(request_last_known)
    if request_known:
        return request_known, 'GPS_LAST_KNOWN'

    db_known = _last_known_location(conn, session_id_unik)
    if db_known:
        return db_known, 'GPS_LAST_KNOWN'

    return {'latitude': None, 'longitude': None, 'accuracy': None}, 'IP_FALLBACK'


def _kode_darurat():
    timestamp = datetime.utcnow().strftime('%y%m%d%H%M%S')
    suffix = os.urandom(2).hex().upper()
    return f'WCR-EMG-{timestamp}-{suffix}'


def _ambil_case_id(value):
    try:
        case_id = int(value)
    except (TypeError, ValueError):
        return None
    return case_id if case_id > 0 else None


@emergency_bp.route('/location_heartbeat.php', methods=['POST'])
def location_heartbeat():
    data = request.get_json(silent=True) or {}
    lokasi = _normalisasi_lokasi(data)
    if not lokasi:
        return jsonify({'status': 'error', 'message': 'Lokasi tidak valid'}), 400

    permission_state = _text(data.get('permission_state'), 'unknown', 32) or 'unknown'
    session_id_unik = _session_id_unik()
    conn = get_db()
    conn.execute(
        '''INSERT INTO EmergencyLocationHeartbeat
           (session_id_unik, latitude, longitude, accuracy_meters, permission_state)
           VALUES (?, ?, ?, ?, ?)''',
        (
            session_id_unik,
            lokasi['latitude'],
            lokasi['longitude'],
            lokasi['accuracy'],
            permission_state
        )
    )
    conn.commit()

    return jsonify({
        'status': 'success',
        'session_id': session_id_unik,
        'location_source': 'GPS_LAST_KNOWN'
    })


@emergency_bp.route('/create_case.php', methods=['POST'])
def create_case():
    data = request.get_json(silent=True) or {}
    trigger_message = _text(data.get('trigger_message'), '', 2000)
    risk_type = _text(data.get('risk_type'), 'SELF_HARM_INTENT', 64)
    user_response = _text(data.get('user_response'), 'NO_RESPONSE_20_SECONDS', 64)

    if not trigger_message:
        return jsonify({'status': 'error', 'message': 'trigger_message wajib diisi'}), 400
    if risk_type not in ALLOWED_RISK_TYPES:
        return jsonify({'status': 'error', 'message': 'risk_type tidak didukung'}), 400
    if user_response not in ALLOWED_HIGH_RISK_RESPONSES:
        return jsonify({'status': 'error', 'message': 'user_response tidak membuat emergency case'}), 400

    session_id_unik = _session_id_unik()
    conn = get_db()
    lokasi, location_source = _pilih_lokasi(
        conn,
        session_id_unik,
        data.get('fresh_location'),
        data.get('last_known_location')
    )
    kode_darurat = _kode_darurat()

    try:
        cursor = conn.execute(
            '''INSERT INTO EmergencyCase
               (kode_darurat, session_id_unik, risk_type, trigger_message, user_response,
                status, latitude, longitude, accuracy_meters, location_source, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                kode_darurat,
                session_id_unik,
                risk_type,
                trigger_message,
                user_response,
                'NEW_HIGH_RISK',
                lokasi['latitude'],
                lokasi['longitude'],
                lokasi['accuracy'],
                location_source,
                _ip_address(),
                _text(request.headers.get('User-Agent', ''), '', 500)
            )
        )
    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({'status': 'error', 'message': 'Gagal membuat kode darurat unik'}), 500

    case_id = cursor.lastrowid
    _audit(conn, case_id, 'CREATE_HIGH_RISK_CASE', 'system', {
        'user_response': user_response,
        'location_source': location_source
    })
    conn.commit()

    return jsonify({
        'status': 'success',
        'data': {
            'id': case_id,
            'kode_darurat': kode_darurat,
            'status': 'NEW_HIGH_RISK',
            'location_source': location_source
        }
    }), 201


@emergency_bp.route('/safety_log.php', methods=['POST'])
def safety_log():
    data = request.get_json(silent=True) or {}
    session_id_unik = _session_id_unik()
    conn = get_db()
    _audit(conn, None, 'USER_CONFIRMED_SAFE', 'user', {
        'session_id_unik': session_id_unik,
        'trigger_message': data.get('trigger_message', ''),
        'risk_type': data.get('risk_type', 'SELF_HARM_INTENT')
    })
    conn.commit()
    return jsonify({'status': 'success'})


@emergency_bp.route('/active_cases.php', methods=['GET'])
def active_cases():
    conn = get_db()
    rows = conn.execute(
        '''SELECT id, kode_darurat, risk_type, trigger_message, user_response, status,
                  latitude, longitude, accuracy_meters, location_source, ip_address, created_at
           FROM EmergencyCase
           WHERE status = 'NEW_HIGH_RISK'
             AND accepted_at IS NULL
           ORDER BY created_at DESC'''
    ).fetchall()
    return jsonify({
        'status': 'success',
        'data': [dict(row) for row in rows]
    })


@emergency_bp.route('/admin_watch_cases.php', methods=['GET'])
def admin_watch_cases():
    conn = get_db()
    rows = conn.execute(
        '''SELECT id, kode_darurat, risk_type, trigger_message, user_response, status,
                  latitude, longitude, accuracy_meters, location_source, ip_address,
                  created_at, admin_acknowledged_at, admin_acknowledged_by,
                  accepted_at, accepted_by
           FROM EmergencyCase
           WHERE status = 'NEW_HIGH_RISK'
             AND admin_acknowledged_at IS NULL
           ORDER BY created_at DESC'''
    ).fetchall()
    return jsonify({
        'status': 'success',
        'data': [dict(row) for row in rows]
    })


@emergency_bp.route('/admin_accept_case.php', methods=['POST'])
def admin_accept_case():
    data = request.get_json(silent=True) or {}
    case_id = _ambil_case_id(data.get('case_id'))
    admin_label = _text(data.get('admin_label'), 'Admin PPKPT', 120) or 'Admin PPKPT'
    if not case_id:
        return jsonify({'status': 'error', 'message': 'case_id wajib diisi'}), 400

    conn = get_db()
    current = conn.execute(
        '''SELECT id, status, admin_acknowledged_at
           FROM EmergencyCase
           WHERE id = ?''',
        (case_id,)
    ).fetchone()
    if not current:
        return jsonify({'status': 'error', 'message': 'Emergency case tidak ditemukan'}), 404

    if current['status'] != 'NEW_HIGH_RISK':
        return jsonify({
            'status': 'error',
            'message': 'Emergency case sudah diproses pihak berwajib',
            'current_status': current['status']
        }), 409

    if current['admin_acknowledged_at']:
        return jsonify({'status': 'success', 'message': 'Alert admin sudah dihentikan'})

    cursor = conn.execute(
        '''UPDATE EmergencyCase
           SET admin_acknowledged_at = CURRENT_TIMESTAMP,
               admin_acknowledged_by = ?
           WHERE id = ?
             AND status = 'NEW_HIGH_RISK'
             AND admin_acknowledged_at IS NULL''',
        (admin_label, case_id)
    )
    if cursor.rowcount == 0:
        return jsonify({'status': 'success', 'message': 'Alert admin sudah dihentikan'})

    _audit(conn, int(case_id), 'ADMIN_ACKNOWLEDGED', admin_label)
    conn.commit()
    return jsonify({'status': 'success', 'message': 'Alert admin dihentikan'})


@emergency_bp.route('/accept_case.php', methods=['POST'])
def accept_case():
    data = request.get_json(silent=True) or {}
    case_id = _ambil_case_id(data.get('case_id'))
    responder_label = _text(data.get('responder_label'), 'Petugas', 120) or 'Petugas'
    if not case_id:
        return jsonify({'status': 'error', 'message': 'case_id wajib diisi'}), 400

    conn = get_db()
    current = conn.execute(
        "SELECT id, status, accepted_at FROM EmergencyCase WHERE id = ?",
        (case_id,)
    ).fetchone()
    if not current:
        return jsonify({'status': 'error', 'message': 'Emergency case tidak ditemukan'}), 404
    if current['status'] != 'NEW_HIGH_RISK':
        return jsonify({
            'status': 'error',
            'message': 'Emergency case sudah diproses',
            'current_status': current['status']
        }), 409
    if current['accepted_at']:
        return jsonify({'status': 'success', 'message': 'Alert pihak berwajib sudah dihentikan'})

    cursor = conn.execute(
        '''UPDATE EmergencyCase
           SET accepted_at = CURRENT_TIMESTAMP,
               accepted_by = ?
           WHERE id = ?
             AND status = 'NEW_HIGH_RISK'
             AND accepted_at IS NULL''',
        (responder_label, case_id)
    )
    if cursor.rowcount == 0:
        return jsonify({'status': 'success', 'message': 'Alert pihak berwajib sudah dihentikan'})

    _audit(conn, int(case_id), 'RESPONDER_ACCEPTED', responder_label)
    conn.commit()
    return jsonify({'status': 'success', 'message': 'Alert pihak berwajib dihentikan'})


@emergency_bp.route('/false_alarm.php', methods=['POST'])
def false_alarm():
    data = request.get_json(silent=True) or {}
    case_id = _ambil_case_id(data.get('case_id'))
    reason = _text(data.get('reason'), 'Tidak ada alasan', 500) or 'Tidak ada alasan'
    if not case_id:
        return jsonify({'status': 'error', 'message': 'case_id wajib diisi'}), 400

    conn = get_db()
    current = conn.execute("SELECT id, status FROM EmergencyCase WHERE id = ?", (case_id,)).fetchone()
    if not current:
        return jsonify({'status': 'error', 'message': 'Emergency case tidak ditemukan'}), 404

    cursor = conn.execute(
        '''UPDATE EmergencyCase
           SET status = 'FALSE_ALARM',
               resolved_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND status = 'NEW_HIGH_RISK'
             AND accepted_at IS NULL''',
        (case_id,)
    )
    if cursor.rowcount == 0:
        return jsonify({
            'status': 'error',
            'message': 'Emergency case sudah diproses',
            'current_status': current['status']
        }), 409

    _audit(conn, int(case_id), 'FALSE_ALARM', 'responder', {'reason': reason})
    conn.commit()
    return jsonify({'status': 'success', 'message': 'Case ditandai false alarm'})
