"""
Lokasi penyimpanan WIECARA yang sadar-lingkungan (local vs serverless/Vercel).

Masalah: Flask app ini menulis ke 3 tempat — database SQLite, session filesystem,
dan folder uploads. Di hosting serverless seperti Vercel, seluruh direktori kode
bersifat READ-ONLY; satu-satunya tempat yang bisa ditulis adalah /tmp (ephemeral,
hilang saat cold start). Modul ini memusatkan keputusan "di mana data ditulis":

- Lokal (development/produksi VPS biasa): DATA_DIR = folder project, persis seperti
  perilaku lama. Tidak ada yang berubah.
- Serverless (Vercel/AWS Lambda terdeteksi via env): DATA_DIR = /tmp/wiecara, dan
  database.db yang ikut ter-deploy disalin ke sana sekali per cold start sebagai
  "seed" (berisi akun admin/psikolog default). Data tulisan baru bersifat sementara
  per instance — cukup untuk demo, bukan untuk penyimpanan permanen.

Override eksplisit lewat env WIECARA_DATA_DIR bila ingin menaruh data di lokasi lain.
"""

import os
import shutil

# Folder tempat file kode berada (root repo). Selalu read-only di serverless.
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Deteksi lingkungan serverless. Vercel meng-set VERCEL=1; Lambda meng-set
# AWS_LAMBDA_FUNCTION_NAME. Di lingkungan ini filesystem kode read-only.
IS_SERVERLESS = bool(
    os.environ.get('VERCEL')
    or os.environ.get('AWS_LAMBDA_FUNCTION_NAME')
)

# Direktori data yang bisa ditulis.
DATA_DIR = (
    os.environ.get('WIECARA_DATA_DIR')
    or ('/tmp/wiecara' if IS_SERVERLESS else PROJECT_DIR)
)

# Path turunan yang dipakai modul lain.
DB_PATH = os.path.join(DATA_DIR, 'database.db')
SESSION_DIR = os.path.join(DATA_DIR, 'flask_session')
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')

# Sumber seed database (ikut ter-commit & ter-deploy). Saat lokal ini identik
# dengan DB_PATH sehingga tidak ada penyalinan.
SEED_DB_PATH = os.path.join(PROJECT_DIR, 'database.db')

# Subfolder uploads yang dipakai blueprint.
_UPLOAD_SUBDIRS = ('bukti', 'blog', 'psikolog', 'content')


def bootstrap():
    """
    Siapkan semua direktori writable dan seed database bila perlu.

    Aman dipanggil berkali-kali (idempotent). Harus dipanggil sekali saat startup
    SEBELUM koneksi database / session pertama dibuat.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(SESSION_DIR, exist_ok=True)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    for sub in _UPLOAD_SUBDIRS:
        os.makedirs(os.path.join(UPLOAD_FOLDER, sub), exist_ok=True)

    # Hanya di serverless: salin database seed ke lokasi writable bila belum ada.
    # Lokal tidak pernah masuk cabang ini karena DB_PATH == SEED_DB_PATH.
    if DB_PATH != SEED_DB_PATH and not os.path.exists(DB_PATH) and os.path.exists(SEED_DB_PATH):
        shutil.copy2(SEED_DB_PATH, DB_PATH)
