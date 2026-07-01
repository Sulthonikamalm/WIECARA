from flask import Blueprint, request, jsonify
from db import get_db

db_admin_bp = Blueprint('db_admin', __name__)

@db_admin_bp.route('/tables', methods=['GET'])
def get_tables():
    conn = get_db()
    # Query to get all tables except internal sqlite tables
    query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    tables = conn.execute(query).fetchall()
    
    table_list = [t['name'] for t in tables]
    return jsonify({
        'status': 'success',
        'data': table_list
    })

@db_admin_bp.route('/table_data', methods=['GET'])
def get_table_data():
    table_name = request.args.get('table')
    if not table_name:
        return jsonify({'status': 'error', 'message': 'Parameter tabel tidak ditemukan.'}), 400

    conn = get_db()
    
    # Validation against SQL injection by checking if table exists
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchall()
    if not tables:
        return jsonify({'status': 'error', 'message': 'Tabel tidak ditemukan.'}), 404

    try:
        # Get columns
        columns_info = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        columns = [col['name'] for col in columns_info]

        # Get rows
        rows = conn.execute(f"SELECT * FROM {table_name} LIMIT 1000").fetchall()
        data = [dict(row) for row in rows]

        return jsonify({
            'status': 'success',
            'data': {
                'columns': columns,
                'rows': data
            }
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@db_admin_bp.route('/query', methods=['POST'])
def execute_query():
    data = request.get_json()
    query = data.get('query', '').strip()
    
    if not query:
        return jsonify({'status': 'error', 'message': 'Query kosong.'}), 400

    conn = get_db()
    try:
        if query.lower().startswith("select") or query.lower().startswith("pragma"):
            rows = conn.execute(query).fetchall()
            if not rows:
                 return jsonify({'status': 'success', 'data': {'columns': [], 'rows': []}})
                 
            columns = rows[0].keys()
            data_rows = [dict(row) for row in rows]
            return jsonify({
                'status': 'success',
                'data': {
                    'columns': list(columns),
                    'rows': data_rows
                }
            })
        else:
            # INSERT, UPDATE, DELETE, etc
            cursor = conn.execute(query)
            conn.commit()
            return jsonify({
                'status': 'success',
                'message': f"Query berhasil dieksekusi. Affected rows: {cursor.rowcount}"
            })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@db_admin_bp.route('/reset_data', methods=['POST'])
def reset_data():
    conn = get_db()
    try:
        tables_to_clear = [
            'Laporan', 'Bukti', 'ChatSession', 'ChatMessage', 
            'StatusHistory', 'JadwalPertemuan', 'CatatanKonsultasi', 
            'CatatanHukum', 'FeedbackUser', 'BlockchainLedger', 'encryption_audit_log'
        ]
        
        conn.execute('PRAGMA foreign_keys = OFF;')
        for table in tables_to_clear:
            conn.execute(f'DELETE FROM {table}')
        conn.execute('PRAGMA foreign_keys = ON;')
        
        conn.commit()
        return jsonify({
            'status': 'success',
            'message': 'Semua data transaksi berhasil dihapus. Database bersih.'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
