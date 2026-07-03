import unittest
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DICTIONARY_SCRIPT = "i18n-dictionary.js"
ENGINE_SCRIPT = "i18n.js"


class I18nIntegrationTest(unittest.TestCase):
    def test_semua_halaman_html_memuat_i18n(self):
        html_files = sorted(ROOT_DIR.rglob("*.html"))
        self.assertGreater(len(html_files), 0)

        missing = []
        wrong_order = []
        for path in html_files:
            content = path.read_text(encoding="utf-8", errors="ignore")
            dictionary_index = content.find(DICTIONARY_SCRIPT)
            engine_index = content.find(ENGINE_SCRIPT)
            if dictionary_index == -1 or engine_index == -1:
                missing.append(str(path.relative_to(ROOT_DIR)))
                continue
            if dictionary_index > engine_index:
                wrong_order.append(str(path.relative_to(ROOT_DIR)))

        self.assertEqual(missing, [])
        self.assertEqual(wrong_order, [])

    def test_engine_memakai_storage_key_dan_switcher_stabil(self):
        engine = (ROOT_DIR / "assets/js/shared/i18n.js").read_text(encoding="utf-8")

        self.assertIn("wiecara_bahasa", engine)
        self.assertIn("data-wiecara-language-switcher", engine)
        self.assertIn("data-wiecara-language-option", engine)
        self.assertIn("document.documentElement.lang", engine)

    def test_kamus_memiliki_entri_wajib(self):
        dictionary = (ROOT_DIR / "assets/js/shared/i18n-dictionary.js").read_text(encoding="utf-8")

        required_texts = [
            '"Pilih Akses Dashboard"',
            '"Pengguna"',
            '"Masuk"',
            '"Lapor"',
            '"Monitoring"',
            '"Wawasan"',
            '"Manajemen Kasus"',
            '"WIECARA Emergency Command"',
            '"HALAMAN TIDAK DITEMUKAN"',
        ]

        for text in required_texts:
            with self.subTest(text=text):
                self.assertIn(text, dictionary)


if __name__ == "__main__":
    unittest.main()
