"""
Entry point WSGI untuk Vercel.

Vercel (@vercel/python) menjalankan file di dalam folder /api sebagai serverless
function dan mencari callable WSGI bernama `app`. File ini hanya menambahkan root
repo ke sys.path lalu mengimpor `app` dari server.py — seluruh logika tetap di
server.py sehingga `python server.py` lokal tidak berubah.
"""

import os
import sys

# Root repo (satu level di atas folder /api). Tanpa ini `import server`, `storage`,
# `db`, dan paket `api_routes` tidak ditemukan saat dijalankan sebagai fungsi.
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from server import app  # noqa: E402  (import setelah sys.path diatur)

# `app` adalah WSGI application yang dipakai Vercel sebagai handler.
