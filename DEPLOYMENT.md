# 🚀 WIECARA PPKS - Panduan Deployment Production

## ✅ Checklist Sebelum Deploy

### 1. Environment & Config

```bash
# Pastikan .env sudah dikonfigurasi dengan benar
```

**File:** `.env`

| Variable | Development | Production |
|----------|-------------|------------|
| `APP_ENV` | `development` | `production` |
| `DEBUG_MODE` | `true` | `false` |
| `GROQ_API_KEY` | API key valid | API key valid |
| `ENCRYPTION_KEY` | 64 karakter hex | 64 karakter hex |
| `DB_PASS` | kosong/local | password kuat! |
| `CORS_ALLOWED_ORIGINS` | `*` | `https://domain.com` |
| `MAINTENANCE_SECRET_KEY` | random | random 40+ karakter |

---

### 2. HTTPS Configuration

**Mengapa HTTPS wajib:**
- Enkripsi data sensitif (password, info korban)
- Session cookies dengan flag `Secure`
- Mencegah man-in-the-middle attack

**Setup HTTPS dengan Let's Encrypt (gratis):**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-apache

# Generate certificate
sudo certbot --apache -d wiecara.domain.com

# Auto-renew (cron)
0 0 1 * * certbot renew --quiet
```

**Update `.env` untuk HTTPS:**
```env
CORS_ALLOWED_ORIGINS=https://wiecara.domain.com,https://www.wiecara.domain.com
```

---

### 3. CORS Settings Production

**File:** `.env`

```env
# JANGAN gunakan * di production!
# Daftar domain yang diizinkan (pisah dengan koma)
CORS_ALLOWED_ORIGINS=https://wiecara.telkomuniversity.ac.id,https://admin.wiecara.telkomuniversity.ac.id
```

**Jika API diakses dari mobile app:**
```env
CORS_ALLOWED_ORIGINS=https://wiecara.domain.com,capacitor://localhost,http://localhost
```

---

### 4. Apache Virtual Host (HTTPS)

```apache
<VirtualHost *:443>
    ServerName wiecara.domain.com
    DocumentRoot /var/www/wiecara
    
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/wiecara.domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/wiecara.domain.com/privkey.pem
    
    # Security Headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    <Directory /var/www/wiecara>
        AllowOverride All
        Require all granted
    </Directory>
    
    # Lindungi file sensitif
    <FilesMatch "^\.env|^config\.php$">
        Require all denied
    </FilesMatch>
</VirtualHost>

# Redirect HTTP ke HTTPS
<VirtualHost *:80>
    ServerName wiecara.domain.com
    Redirect permanent / https://wiecara.domain.com/
</VirtualHost>
```

---

### 5. File Permissions (Linux)

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/wiecara

# Directories: 755, Files: 644
find /var/www/wiecara -type d -exec chmod 755 {} \;
find /var/www/wiecara -type f -exec chmod 644 {} \;

# Protect sensitive files
chmod 600 /var/www/wiecara/.env
chmod 600 /var/www/wiecara/config/config.php

# Upload directory writable
chmod 755 /var/www/wiecara/uploads/bukti
```

---

### 6. Database Production

```sql
-- Buat user khusus (bukan root!)
CREATE USER 'wiecara_user'@'localhost' IDENTIFIED BY 'password_kuat_123!';
GRANT SELECT, INSERT, UPDATE, DELETE ON wiecara_ppks.* TO 'wiecara_user'@'localhost';
FLUSH PRIVILEGES;
```

**Update `.env`:**
```env
DB_USER=wiecara_user
DB_PASS=password_kuat_123!
```

---

### 7. Maintenance Mode

**Aktifkan maintenance:**
```bash
# Via CLI
php maintenance/toggle.php on

# Via Browser (butuh secret key)
https://wiecara.domain.com/maintenance/toggle.php?action=on&key=YOUR_SECRET_KEY
```

**Nonaktifkan maintenance:**
```bash
php maintenance/toggle.php off
```

---

### 8. Log Rotation

```bash
# Jalankan manual
php api/logs/rotate.php

# Atau setup cron (setiap minggu)
0 0 * * 0 php /var/www/wiecara/api/logs/rotate.php >> /var/log/wiecara-rotate.log
```

---

### 9. Final Checklist

- [ ] `APP_ENV=production`
- [ ] `DEBUG_MODE=false`
- [ ] `CORS_ALLOWED_ORIGINS` tidak menggunakan `*`
- [ ] HTTPS aktif dan forced redirect
- [ ] `.env` dan `config.php` tidak bisa diakses via browser
- [ ] Database menggunakan user non-root
- [ ] File permissions sudah benar
- [ ] Backup database terjadwal
- [ ] SSL certificate auto-renew aktif
- [ ] Log rotation terjadwal

---

## 📞 Emergency

Jika terjadi masalah:

1. **Aktifkan maintenance mode** untuk mencegah akses
2. **Cek log files** di `api/logs/`
3. **Rollback** jika perlu dari backup

---

*Terakhir diupdate: 2026-01-05*
