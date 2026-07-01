from flask import Flask, send_from_directory, request, jsonify, session, abort
import os
import threading
import webbrowser
from datetime import timedelta
from flask_session import Session
import storage
from db import init_db, close_db, ensure_emergency_schema

# Siapkan direktori writable (DB, session, uploads) sesuai lingkungan.
# Di serverless/Vercel ini menyalin database seed ke /tmp; di lokal tidak ada efek.
# WAJIB dijalankan sebelum init_db() menyentuh database.
storage.bootstrap()

# Initialize database
init_db()
ensure_emergency_schema()

# Load env file manually
env_path = os.path.join(os.path.dirname(__file__), 'env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key, val = line.split('=', 1)
                os.environ[key.strip()] = val.strip()

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('SECRET_KEY', 'super_secret_key_for_wiecara')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=365)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # 50MB max upload size

# Server-side session.
# Data session (mis. conversation_history chatbot) bisa jauh melebihi batas cookie
# browser (~4KB) dan berisi data sensitif. Dengan Flask-Session tipe filesystem,
# isi session disimpan di server; cookie hanya membawa ID session yang acak (UUID4).
# Catatan: SESSION_USE_SIGNER sengaja tidak diaktifkan karena pada Flask-Session 0.5.0
# (versi yang dipin) signer menghasilkan session_id bertipe bytes yang ditolak Werkzeug 3.x.
SESSION_DIR = storage.SESSION_DIR
os.makedirs(SESSION_DIR, exist_ok=True)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = SESSION_DIR
app.config['SESSION_PERMANENT'] = True  # selaras dengan PERMANENT_SESSION_LIFETIME (365 hari)
app.config['SESSION_KEY_PREFIX'] = 'wiecara:'
Session(app)

# Tutup koneksi database otomatis di akhir setiap request.
# Inilah jaring pengaman yang menutup kebocoran koneksi: endpoint cukup memanggil
# get_db() tanpa wajib close() sendiri, koneksi pasti ditutup di sini.
app.teardown_appcontext(close_db)

# Setup uploads directory (lokasi writable ditentukan storage.bootstrap di atas).
UPLOAD_FOLDER = storage.UPLOAD_FOLDER

# Import Blueprints
from api_routes.auth import auth_bp
from api_routes.lapor import lapor_bp
from api_routes.chatbot import chatbot_bp
from api_routes.cases import cases_bp
from api_routes.admin import admin_bp
from api_routes.blog import blog_bp
from api_routes.psikolog import psikolog_bp
from api_routes.monitoring import monitoring_bp
from api_routes.db_admin import db_admin_bp
from api_routes.legal import legal_bp
from api_routes.blockchain import blockchain_bp
from api_routes.emergency import emergency_bp

# Register Blueprints (they handle paths like /api/auth)
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(lapor_bp, url_prefix='/api/lapor')
app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
app.register_blueprint(cases_bp, url_prefix='/api/cases')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(blog_bp, url_prefix='/api/blog')
app.register_blueprint(psikolog_bp, url_prefix='/api/psikolog')
app.register_blueprint(monitoring_bp, url_prefix='/api/monitoring')
app.register_blueprint(db_admin_bp, url_prefix='/api/db_admin')
app.register_blueprint(legal_bp, url_prefix='/api/legal')
app.register_blueprint(blockchain_bp, url_prefix='/api/blockchain')
app.register_blueprint(emergency_bp, url_prefix='/api/emergency')

@app.before_request
def auto_login_dev():
    if os.environ.get('DEBUG_MODE', 'false').lower() == 'true':
        if not session.get('dev_auto_logged_in'):
            session['dev_auto_logged_in'] = True
            
            # Auto login Admin
            session['logged_in'] = True
            session['admin_id'] = 1
            session['admin_name'] = 'System Administrator'
            session['admin_email'] = 'admin@gmail.com'
            session['admin_username'] = 'admin'
            
            # Auto login Psikolog
            session['psikolog_logged_in'] = True
            session['psikolog_id'] = 1
            session['psikolog_name'] = 'Dr. Sari Wijayanti, M.Psi'
            session['psikolog_email'] = 'psikolog@gmail.com'
            
            # Auto login Legal
            session['legal_logged_in'] = True
            session['legal_id'] = 1
            session['legal_name'] = 'Budi Santoso, S.H.'
            session['legal_email'] = 'legal@gmail.com'

# Serve Static Files
BASE_DIR = os.path.dirname(__file__)

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('api/'):
        # If it matches 'api/', but wasn't caught by a blueprint, return 404
        return jsonify({'status': 'error', 'message': 'API Endpoint not found in Python backend.'}), 404
        
    full_path = os.path.join(BASE_DIR, filename)
    if os.path.isdir(full_path):
        # Serve index.html if it's a directory
        return send_from_directory(full_path, 'index.html')

    if os.path.exists(full_path):
        return send_from_directory(BASE_DIR, filename)

    # File upload (bukti/blog/psikolog) ditulis ke direktori data writable, yang di
    # serverless berbeda dari folder kode. Cari di sana sebagai fallback.
    if filename.startswith('uploads/'):
        data_path = os.path.join(storage.DATA_DIR, filename)
        if os.path.exists(data_path):
            return send_from_directory(storage.DATA_DIR, filename)

    return abort(404)

@app.errorhandler(404)
def halaman_tidak_ditemukan(error):
    # Permintaan API tetap balas JSON; halaman biasa tampilkan ErrorPage yang rapi.
    if request.path.startswith('/api/'):
        return jsonify({'status': 'error', 'message': 'Resource tidak ditemukan.'}), 404
    return send_from_directory(os.path.join(BASE_DIR, 'ErrorPage'), '404.html'), 404

# Konfigurasi server: host/port bisa dioverride lewat env, default tetap seperti semula.
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', '5000'))

# Daftar pintu masuk tiap role: (nama, path, auto_buka).
# auto_buka=False -> tetap dicetak di terminal, tapi TIDAK dibuka otomatis sebagai tab.
# Lapor & Wawasan dimatikan auto-buka-nya karena sudah bisa diakses dari Landing Page.
TAUTAN_ROLE = [
    ('Pengguna (Landing)',       '/',                           True),
    ('Lapor Kejadian',           '/Lapor/lapor.html',           False),
    ('Monitoring Laporan',       '/Monitoring/monitoring.html', True),
    ('Wawasan / Blog',           '/Wawasan/wawasan.html',       False),
    ('Admin',                    '/Admin/index.html',           True),
    ('Psikolog',                 '/Psikolog/index.html',        True),
    ('Pendamping Hukum (Legal)', '/Legal/pages/login.html',     True),
    ('DB Admin',                 '/db_admin/index.html',        True),
    ('Blockchain Ledger',        '/db_admin/blockchain.html',   True),
    ('Emergency Responder',      '/Emergency/dashboard.html',   True),
]


def cetak_tautan_role():
    """Tampilkan semua tautan role di terminal agar bisa langsung diklik."""
    base = f"http://127.0.0.1:{PORT}"
    lebar = max(len(nama) for nama, _, _ in TAUTAN_ROLE)
    print("\n" + "=" * 70)
    print("  WIECARA PPKPT siap. Buka salah satu tautan role berikut:")
    print("=" * 70)
    for nama, path, _ in TAUTAN_ROLE:
        print(f"  {nama.ljust(lebar)}  ->  {base}{path}")
    print("=" * 70 + "\n")


def buka_browser_otomatis():
    """Buka tab otomatis hanya untuk entri ber-auto_buka=True (Lapor & Wawasan dilewati)."""
    base = f"http://127.0.0.1:{PORT}"
    pertama = True
    for _, path, auto_buka in TAUTAN_ROLE:
        if not auto_buka:
            continue
        if pertama:
            webbrowser.open_new(base + path)
            pertama = False
        else:
            webbrowser.open_new_tab(base + path)


if __name__ == '__main__':
    print(f"Starting WIECARA Python Server on port {PORT}...")
    cetak_tautan_role()
    threading.Timer(1.5, buka_browser_otomatis).start()
    app.run(debug=True, host=HOST, port=PORT, use_reloader=False)
