from flask import Blueprint, request, jsonify, session
from db import get_db
import bcrypt
import os

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login.php', methods=['POST'])
def login():
    # Handle both JSON and FormData
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
    user = conn.execute('SELECT * FROM Admin WHERE email = ?', (email,)).fetchone()

    if not user:
        return jsonify({'status': 'error', 'message': 'Email atau password salah'}), 401

    # Verify password
    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        # In a real app we'd increment failed_attempts
        return jsonify({'status': 'error', 'message': 'Email atau password salah'}), 401

    # Login Success
    # session.clear() - Removed to prevent logging out other roles
    session.permanent = True
    session['admin_id'] = user['id']
    session['admin_name'] = user['nama']
    session['admin_email'] = user['email']
    session['admin_username'] = user['username']
    session['logged_in'] = True
    session['csrf_token'] = os.urandom(16).hex()

    conn.execute('UPDATE Admin SET failed_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
    conn.commit()

    return jsonify({
        'status': 'success',
        'message': 'Login berhasil',
        'data': {
            'id': user['id'],
            'name': user['nama'],
            'email': user['email'],
            'username': user['username']
        },
        'csrf_token': session['csrf_token'],
        'redirect': '../cases/cases.html'
    })

@auth_bp.route('/check.php', methods=['GET', 'POST'])
def check():
    if not session.get('logged_in') or not session.get('admin_id'):
        return jsonify({'status': 'unauthorized', 'message': 'Belum login'}), 401

    # Generate CSRF token if it doesn't exist
    if 'csrf_token' not in session:
        session['csrf_token'] = os.urandom(16).hex()

    return jsonify({
        'status': 'authenticated',
        'user': {
            'id': session['admin_id'],
            'name': session['admin_name'],
            'email': session['admin_email'],
            'username': session.get('admin_username', '')
        },
        'session': {
            'csrf_token': session['csrf_token']
        },
        'csrf_token': session['csrf_token']
    })

@auth_bp.route('/logout.php', methods=['GET', 'POST'])
def logout():
    session.pop('admin_id', None)
    session.pop('admin_name', None)
    session.pop('admin_email', None)
    session.pop('admin_username', None)
    session.pop('logged_in', None)
    return jsonify({
        'status': 'success',
        'message': 'Berhasil logout',
        'redirect': '../auth/login.html'
    })
