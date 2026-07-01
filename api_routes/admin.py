from flask import Blueprint, request, jsonify, session
from db import get_db

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/get_psikologs.php', methods=['GET'])
def get_psikologs():
    if not session.get('logged_in'):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    conn = get_db()
    psikologs = conn.execute("SELECT id, nama_lengkap, spesialisasi, status FROM Psikolog").fetchall()
    
    return jsonify({
        'status': 'success',
        'data': [dict(p) for p in psikologs]
    })
