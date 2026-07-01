"""
Modul akses database SQLite WIECARA.

Dua perbaikan penting dibanding versi sebelumnya:
1. Setiap koneksi mengaktifkan `PRAGMA foreign_keys = ON`. SQLite default-nya OFF,
   sehingga tanpa ini SEMUA aturan ON DELETE CASCADE / SET NULL di schema.sql tidak
   pernah berjalan (mis. hapus Laporan menyisakan Bukti/Jadwal/Catatan yatim).
2. Di dalam request Flask, koneksi dibagikan lewat `flask.g` dan ditutup otomatis
   oleh teardown di server.py. Ini menutup kebocoran koneksi karena sebelumnya banyak
   endpoint memanggil get_db() tanpa pernah close().
"""

import os
import sqlite3

from flask import g, has_app_context

# Lokasi database ditentukan terpusat di storage.py agar konsisten antara
# lingkungan lokal (folder project) dan serverless/Vercel (/tmp yang writable).
from storage import DB_PATH
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')


EMERGENCY_SCHEMA_SQL = '''
CREATE TABLE IF NOT EXISTS EmergencyCase (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode_darurat TEXT NOT NULL UNIQUE,
  session_id_unik TEXT NULL,
  risk_type TEXT NOT NULL,
  trigger_message TEXT NOT NULL,
  user_response TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW_HIGH_RISK',
  latitude REAL NULL,
  longitude REAL NULL,
  accuracy_meters REAL NULL,
  location_source TEXT NOT NULL DEFAULT 'IP_FALLBACK',
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  admin_acknowledged_at DATETIME DEFAULT NULL,
  admin_acknowledged_by TEXT DEFAULT NULL,
  accepted_at DATETIME DEFAULT NULL,
  accepted_by TEXT DEFAULT NULL,
  resolved_at DATETIME DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS EmergencyLocationHeartbeat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id_unik TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL NULL,
  permission_state TEXT NOT NULL DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS EmergencyAuditLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata_json TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES EmergencyCase(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emergency_case_status_created
ON EmergencyCase(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_location_session_created
ON EmergencyLocationHeartbeat(session_id_unik, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_audit_case_created
ON EmergencyAuditLog(case_id, created_at DESC);
'''


def _buka_koneksi():
    """Buat koneksi SQLite baru dengan row_factory dan foreign key aktif."""
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def get_db():
    """
    Kembalikan koneksi database.

    Di dalam konteks aplikasi Flask, koneksi di-cache pada `g` agar satu request
    memakai satu koneksi yang sama dan ditutup sekali saja oleh teardown.
    Di luar konteks (mis. init_db saat startup), kembalikan koneksi lepas yang
    harus ditutup sendiri oleh pemanggil.
    """
    if has_app_context():
        if 'db_conn' not in g:
            g.db_conn = _buka_koneksi()
        return g.db_conn
    return _buka_koneksi()


def close_db(exception=None):
    """Tutup koneksi request yang tersimpan di `g`. Dipanggil oleh teardown Flask."""
    conn = g.pop('db_conn', None)
    if conn is not None:
        conn.close()


def init_db():
    """Inisialisasi database dari schema.sql bila file database belum ada."""
    if os.path.exists(DB_PATH):
        return

    # Impor bcrypt di sini agar modul tetap ringan saat hanya butuh get_db().
    import bcrypt

    print("Initializing new SQLite database...")
    conn = _buka_koneksi()
    try:
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            conn.executescript(f.read())

        # Admin default (password: admin)
        admin_pass = bcrypt.hashpw('admin'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        conn.execute('''
            INSERT INTO Admin (username, email, password_hash, nama, can_decrypt_reports)
            VALUES (?, ?, ?, ?, ?)
        ''', ('admin', 'admin@gmail.com', admin_pass, 'System Administrator', 1))

        # Psikolog default (password: psikolog)
        psikolog_pass = bcrypt.hashpw('psikolog'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        conn.execute('''
            INSERT INTO Psikolog (username, email, password_hash, nama_lengkap, spesialisasi, status)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('dr.sari', 'psikolog@gmail.com', psikolog_pass, 'Dr. Sari Wijayanti, M.Psi', 'Trauma & Kekerasan Seksual', 'aktif'))

        conn.commit()
        print("Database initialized successfully.")
    finally:
        conn.close()


def ensure_emergency_schema():
    """Pastikan tabel emergency tersedia pada database demo yang sudah ada."""
    conn = _buka_koneksi()
    try:
        conn.executescript(EMERGENCY_SCHEMA_SQL)
        _ensure_column(conn, 'EmergencyCase', 'admin_acknowledged_at', 'DATETIME DEFAULT NULL')
        _ensure_column(conn, 'EmergencyCase', 'admin_acknowledged_by', 'TEXT DEFAULT NULL')
        conn.execute(
            '''CREATE INDEX IF NOT EXISTS idx_emergency_case_admin_watch
               ON EmergencyCase(status, admin_acknowledged_at, created_at DESC)'''
        )
        conn.commit()
    finally:
        conn.close()


def _ensure_column(conn, table_name, column_name, column_definition):
    columns = {
        row['name']
        for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()
    }
    if column_name not in columns:
        conn.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}')
