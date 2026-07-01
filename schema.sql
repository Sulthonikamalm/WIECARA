-- SQLite version of the combined database schema

CREATE TABLE IF NOT EXISTS Admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nama TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,
  last_login DATETIME DEFAULT NULL,
  can_decrypt_reports BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LoginAttempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT 0,
  failure_reason TEXT NULL
);

CREATE TABLE IF NOT EXISTS ArtikelBlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NULL,
  judul TEXT NOT NULL,
  isi_postingan TEXT NOT NULL,
  gambar_header_url TEXT NULL,
  kategori TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES Admin(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ChatSession (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id_unik TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ChatMessage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ChatSession(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Psikolog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nama_lengkap TEXT NOT NULL,
  spesialisasi TEXT NULL,
  no_telepon TEXT NULL,
  foto_url TEXT NULL,
  status TEXT DEFAULT 'aktif',
  failed_attempts INTEGER DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Laporan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode_pelaporan TEXT NOT NULL UNIQUE,
  status_laporan TEXT NOT NULL DEFAULT 'Investigasi',
  status_darurat TEXT NULL,
  korban_sebagai TEXT NULL,
  tingkat_kekhawatiran TEXT NULL,
  gender_korban TEXT NULL,
  pelaku_kekerasan TEXT NULL,
  waktu_kejadian TEXT NULL,
  lokasi_kejadian TEXT NULL,
  detail_kejadian TEXT NULL,
  email_korban TEXT NULL,
  usia_korban TEXT NULL,
  whatsapp_korban TEXT NULL,
  status_disabilitas TEXT DEFAULT 'tidak',
  jenis_disabilitas TEXT DEFAULT NULL,
  encrypted_data TEXT NULL,
  is_encrypted BOOLEAN DEFAULT 0,
  encryption_version TEXT DEFAULT 'v1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  chat_session_id INTEGER DEFAULT NULL,
  alasan_penolakan TEXT NULL,
  validated_by_admin INTEGER NULL,
  assigned_psikolog_id INTEGER NULL,
  auto_close_at DATETIME DEFAULT NULL,
  dispute_count INTEGER DEFAULT 0,
  FOREIGN KEY (chat_session_id) REFERENCES ChatSession(id) ON DELETE SET NULL,
  FOREIGN KEY (validated_by_admin) REFERENCES Admin(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_psikolog_id) REFERENCES Psikolog(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Bukti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS encryption_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT 1,
  error_message TEXT NULL,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES Admin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS JadwalPertemuan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  psikolog_id INTEGER NOT NULL,
  scheduled_by_admin INTEGER NULL,
  waktu_mulai DATETIME NOT NULL,
  waktu_selesai DATETIME NOT NULL,
  tipe TEXT NOT NULL DEFAULT 'offline',
  tempat_atau_link TEXT NOT NULL,
  status_jadwal TEXT DEFAULT 'scheduled',
  catatan_admin TEXT NULL,
  jadwal_lama_id INTEGER NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE,
  FOREIGN KEY (psikolog_id) REFERENCES Psikolog(id) ON DELETE CASCADE,
  FOREIGN KEY (scheduled_by_admin) REFERENCES Admin(id) ON DELETE SET NULL,
  FOREIGN KEY (jadwal_lama_id) REFERENCES JadwalPertemuan(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS CatatanKonsultasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  psikolog_id INTEGER NOT NULL,
  jadwal_id INTEGER NULL,
  ringkasan_kasus TEXT NOT NULL,
  detail_konsultasi TEXT NOT NULL,
  rekomendasi TEXT NULL,
  tingkat_risiko TEXT NOT NULL DEFAULT 'sedang',
  is_encrypted BOOLEAN DEFAULT 0,
  encrypted_data TEXT NULL,
  encryption_version TEXT DEFAULT 'v1',
  status_catatan TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE,
  FOREIGN KEY (psikolog_id) REFERENCES Psikolog(id) ON DELETE CASCADE,
  FOREIGN KEY (jadwal_id) REFERENCES JadwalPertemuan(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS FeedbackUser (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  catatan_id INTEGER NULL,
  tipe_feedback TEXT NOT NULL,
  komentar_user TEXT NULL,
  detail_dispute TEXT NULL,
  respon_psikolog TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME DEFAULT NULL,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE,
  FOREIGN KEY (catatan_id) REFERENCES CatatanKonsultasi(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS StatusHistory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  status_lama TEXT NULL,
  status_baru TEXT NOT NULL,
  diubah_oleh_role TEXT NOT NULL,
  diubah_oleh_id INTEGER NULL,
  keterangan TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PendampingHukum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nama_lengkap TEXT NOT NULL,
  spesialisasi TEXT NULL,
  no_telepon TEXT NULL,
  status TEXT DEFAULT 'aktif',
  failed_attempts INTEGER DEFAULT 0,
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS CatatanHukum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laporan_id INTEGER NOT NULL,
  legal_id INTEGER NOT NULL,
  analisis_hukum TEXT NOT NULL,
  rekomendasi_hukum TEXT NOT NULL,
  pasal_terkait TEXT NULL,
  status_catatan TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE CASCADE,
  FOREIGN KEY (legal_id) REFERENCES PendampingHukum(id) ON DELETE CASCADE
);

-- Blockchain Ledger for immutable audit trail
CREATE TABLE IF NOT EXISTS BlockchainLedger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_index INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action_type TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_id INTEGER DEFAULT 0,
  laporan_id INTEGER DEFAULT NULL,
  data_payload TEXT NOT NULL,
  previous_hash TEXT NOT NULL DEFAULT '0',
  hash TEXT NOT NULL,
  FOREIGN KEY (laporan_id) REFERENCES Laporan(id) ON DELETE SET NULL
);

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

CREATE INDEX IF NOT EXISTS idx_emergency_case_admin_watch
ON EmergencyCase(status, admin_acknowledged_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_location_session_created
ON EmergencyLocationHeartbeat(session_id_unik, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_audit_case_created
ON EmergencyAuditLog(case_id, created_at DESC);

-- Insert dummy admin for testing (password is 'admin123' if bcrypt is used later)
-- We will hash it in python.
