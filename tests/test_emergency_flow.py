import importlib
import tempfile
import unittest
from pathlib import Path


class EmergencyFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.db_path = Path(cls.temp_dir.name) / "test_database.db"

        import db
        db.DB_PATH = str(cls.db_path)

        cls.server = importlib.import_module("server")
        cls.app = cls.server.app
        cls.app.config.update(TESTING=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()

    def setUp(self):
        self.client = self.app.test_client()

    def test_crisis_keyword_returns_safety_check(self):
        samples = [
            "saya mau bunuh diri",
            "saya sekarang mau menancapkan pisau keperut saya jadi saya mengakhiri hidup saya saja",
            "saya sekarang mau menancapkan pisau keperut saya saja dan lompat dari gedung",
            "saya mau lompat dari gedung saja",
            "saya akan melukai tangan dan leher saya"
        ]

        for message in samples:
            with self.subTest(message=message):
                response = self.client.post("/api/chatbot/chat.php", json={"message": message})
                payload = response.get_json()

                self.assertEqual(response.status_code, 200)
                self.assertEqual(payload["phase"], "safety_check")
                self.assertEqual(payload["risk_type"], "SELF_HARM_INTENT")
                self.assertEqual(payload["safety_check_timeout_seconds"], 20)

    def test_report_scoring_still_uses_existing_consent_flow(self):
        response = self.client.post("/api/chatbot/chat.php", json={
            "message": "saya mau lapor kekerasan"
        })
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["phase"], "consent")
        self.assertEqual(payload["tier"], "report")
        self.assertTrue(payload["consent_given"])

    def test_reject_offer_clears_consent_state(self):
        client = self.app.test_client()
        offered = client.post("/api/chatbot/chat.php", json={
            "message": "saya mau lapor kekerasan"
        }).get_json()
        self.assertEqual(offered["phase"], "consent")
        self.assertTrue(offered["consent_given"])

        client.post("/api/chatbot/chat.php", json={"action": "reject_offer"})

        after = client.post("/api/chatbot/chat.php", json={
            "message": "halo"
        }).get_json()
        # Setelah tawaran ditolak, chatbot kembali ke mode curhat (bukan report).
        self.assertEqual(after["phase"], "curhat")
        self.assertEqual(after["tier"], "curhat")
        self.assertFalse(after["consent_given"])

    def test_abuse_scoring_accumulates_sexual_harassment_details(self):
        first = self.client.post("/api/chatbot/chat.php", json={
            "message": "saya butuh bantuan"
        }).get_json()
        second = self.client.post("/api/chatbot/chat.php", json={
            "message": "saya dilecehkan"
        }).get_json()
        third = self.client.post("/api/chatbot/chat.php", json={
            "message": "diremas remas payudara saya"
        }).get_json()

        self.assertEqual(first["phase"], "curhat")
        self.assertEqual(second["phase"], "curhat")
        self.assertEqual(third["phase"], "consent")
        self.assertEqual(third["tier"], "report")
        self.assertTrue(third["consent_given"])

    def test_safe_answer_only_logs_and_does_not_create_active_case(self):
        response = self.client.post("/api/emergency/safety_log.php", json={
            "trigger_message": "saya mau bunuh diri",
            "risk_type": "SELF_HARM_INTENT"
        })
        active = self.client.get("/api/emergency/active_cases.php").get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(active["data"], [])

    def test_invalid_gps_is_rejected_for_heartbeat(self):
        response = self.client.post("/api/emergency/location_heartbeat.php", json={
            "latitude": 999,
            "longitude": 106.8,
            "accuracy": 12,
            "permission_state": "granted"
        })

        self.assertEqual(response.status_code, 400)

    def test_safe_response_cannot_create_dispatch_case(self):
        response = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "saya mau bunuh diri",
            "risk_type": "SELF_HARM_INTENT",
            "user_response": "SAFE"
        })

        self.assertEqual(response.status_code, 400)

    def test_lapor_emergency_button_creates_active_case(self):
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "Tombol DARURAT pada form Lapor ditekan.",
            "risk_type": "FORM_EMERGENCY_BUTTON",
            "user_response": "NEED_HELP_NOW"
        })
        payload = create.get_json()
        case_id = payload["data"]["id"]
        active = self.client.get("/api/emergency/active_cases.php").get_json()["data"]

        self.assertEqual(create.status_code, 201)
        self.assertTrue(any(item["id"] == case_id for item in active))

        self.client.post("/api/emergency/false_alarm.php", json={
            "case_id": case_id,
            "reason": "Cleanup test tombol darurat"
        })

    def test_admin_acknowledgement_does_not_clear_responder_dashboard(self):
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "Tombol DARURAT pada form Lapor ditekan.",
            "risk_type": "FORM_EMERGENCY_BUTTON",
            "user_response": "NEED_HELP_NOW"
        })
        case_id = create.get_json()["data"]["id"]

        admin_before = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]
        responder_before = self.client.get("/api/emergency/active_cases.php").get_json()["data"]

        admin_ack = self.client.post("/api/emergency/admin_accept_case.php", json={
            "case_id": case_id,
            "admin_label": "Admin PPKPT"
        })

        admin_after = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]
        responder_after_admin = self.client.get("/api/emergency/active_cases.php").get_json()["data"]

        responder_ack = self.client.post("/api/emergency/accept_case.php", json={
            "case_id": case_id,
            "responder_label": "Petugas Polisi/Damkar"
        })
        responder_after_responder = self.client.get("/api/emergency/active_cases.php").get_json()["data"]
        admin_after_responder = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]

        self.assertEqual(create.status_code, 201)
        self.assertTrue(any(item["id"] == case_id for item in admin_before))
        self.assertTrue(any(item["id"] == case_id for item in responder_before))
        self.assertEqual(admin_ack.status_code, 200)
        self.assertFalse(any(item["id"] == case_id for item in admin_after))
        self.assertTrue(any(item["id"] == case_id for item in responder_after_admin))
        self.assertEqual(responder_ack.status_code, 200)
        self.assertFalse(any(item["id"] == case_id for item in responder_after_responder))
        self.assertFalse(any(item["id"] == case_id for item in admin_after_responder))

    def test_responder_acknowledgement_does_not_clear_admin_alert(self):
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "Tombol DARURAT pada form Lapor ditekan.",
            "risk_type": "FORM_EMERGENCY_BUTTON",
            "user_response": "NEED_HELP_NOW"
        })
        case_id = create.get_json()["data"]["id"]

        responder_ack = self.client.post("/api/emergency/accept_case.php", json={
            "case_id": case_id,
            "responder_label": "Petugas Polisi/Damkar"
        })
        responder_after = self.client.get("/api/emergency/active_cases.php").get_json()["data"]
        admin_after_responder = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]

        admin_ack = self.client.post("/api/emergency/admin_accept_case.php", json={
            "case_id": case_id,
            "admin_label": "Admin PPKPT"
        })
        admin_after_admin = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]

        self.assertEqual(create.status_code, 201)
        self.assertEqual(responder_ack.status_code, 200)
        self.assertFalse(any(item["id"] == case_id for item in responder_after))
        self.assertTrue(any(item["id"] == case_id for item in admin_after_responder))
        self.assertEqual(admin_ack.status_code, 200)
        self.assertFalse(any(item["id"] == case_id for item in admin_after_admin))

    def test_admin_ack_does_not_mutate_global_status(self):
        """Penjaga root-cause: tombol admin hanya menyentuh kolom admin_acknowledged_*.

        Regresi lama menulis status='RESPONDER_ACCEPTED' + accepted_at saat admin klik,
        sehingga query dashboard pihak berwajib (status='NEW_HIGH_RISK' AND accepted_at IS NULL)
        tidak lagi mengembalikan case dan alert pihak berwajib ikut hilang.
        """
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "Tombol DARURAT pada form Lapor ditekan.",
            "risk_type": "FORM_EMERGENCY_BUTTON",
            "user_response": "NEED_HELP_NOW"
        })
        case_id = create.get_json()["data"]["id"]

        self.client.post("/api/emergency/admin_accept_case.php", json={
            "case_id": case_id,
            "admin_label": "Admin PPKPT"
        })

        active = self.client.get("/api/emergency/active_cases.php").get_json()["data"]
        case_row = next((item for item in active if item["id"] == case_id), None)

        # Alert pihak berwajib WAJIB tetap ada setelah admin merespons...
        self.assertIsNotNone(case_row, "Admin ack tidak boleh menghapus alert pihak berwajib")
        # ...dan status global TIDAK BOLEH berubah (tetap NEW_HIGH_RISK).
        self.assertEqual(case_row["status"], "NEW_HIGH_RISK")

        # Cleanup: tutup case agar tidak bocor ke test lain yang mengasumsikan active_cases kosong.
        self.client.post("/api/emergency/accept_case.php", json={
            "case_id": case_id,
            "responder_label": "Cleanup"
        })

    def test_responder_accept_does_not_mutate_global_status_or_admin_column(self):
        """Simetri root-cause: accept pihak berwajib tidak menyentuh kolom admin / status global."""
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "Tombol DARURAT pada form Lapor ditekan.",
            "risk_type": "FORM_EMERGENCY_BUTTON",
            "user_response": "NEED_HELP_NOW"
        })
        case_id = create.get_json()["data"]["id"]

        self.client.post("/api/emergency/accept_case.php", json={
            "case_id": case_id,
            "responder_label": "Petugas Polisi/Damkar"
        })

        admin_watch = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]
        case_row = next((item for item in admin_watch if item["id"] == case_id), None)

        # Alert admin WAJIB tetap ada (admin belum merespons)...
        self.assertIsNotNone(case_row, "Accept pihak berwajib tidak boleh menghapus alert admin")
        # ...status global tetap NEW_HIGH_RISK dan kolom admin tetap kosong.
        self.assertEqual(case_row["status"], "NEW_HIGH_RISK")
        self.assertIsNone(case_row["admin_acknowledged_at"])

        # Cleanup: case ini masih tampil di admin_watch sampai admin merespons.
        self.client.post("/api/emergency/admin_accept_case.php", json={
            "case_id": case_id,
            "admin_label": "Cleanup"
        })

    def test_double_click_admin_and_responder_is_idempotent(self):
        """Validasi #11: klik ganda tidak menggandakan data atau mengacaukan status."""
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "Tombol DARURAT pada form Lapor ditekan.",
            "risk_type": "FORM_EMERGENCY_BUTTON",
            "user_response": "NEED_HELP_NOW"
        })
        case_id = create.get_json()["data"]["id"]

        first_admin = self.client.post("/api/emergency/admin_accept_case.php", json={"case_id": case_id})
        second_admin = self.client.post("/api/emergency/admin_accept_case.php", json={"case_id": case_id})

        first_responder = self.client.post("/api/emergency/accept_case.php", json={"case_id": case_id})
        second_responder = self.client.post("/api/emergency/accept_case.php", json={"case_id": case_id})

        active = self.client.get("/api/emergency/active_cases.php").get_json()["data"]
        admin_watch = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]

        # Klik kedua tetap sukses (idempoten), bukan error palsu maupun sukses palsu.
        self.assertEqual(first_admin.status_code, 200)
        self.assertEqual(second_admin.status_code, 200)
        self.assertEqual(first_responder.status_code, 200)
        self.assertEqual(second_responder.status_code, 200)
        # Tidak ada duplikasi dan alert tidak "hidup lagi" di kedua dashboard.
        self.assertEqual(len([item for item in active if item["id"] == case_id]), 0)
        self.assertEqual(len([item for item in admin_watch if item["id"] == case_id]), 0)

    def test_create_case_payload_and_atomic_status_transition(self):
        create = self.client.post("/api/emergency/create_case.php", json={
            "trigger_message": "saya mau bunuh diri",
            "risk_type": "SELF_HARM_INTENT",
            "user_response": "NEED_HELP_NOW",
            "fresh_location": {
                "latitude": -6.2,
                "longitude": 106.816666,
                "accuracy": 18
            }
        })
        create_payload = create.get_json()
        case_id = create_payload["data"]["id"]

        active = self.client.get("/api/emergency/active_cases.php").get_json()["data"]
        case_payload = next(item for item in active if item["id"] == case_id)

        self.assertEqual(create.status_code, 201)
        self.assertEqual(create_payload["data"]["location_source"], "GPS_FRESH")
        self.assertNotIn("user_agent", case_payload)
        self.assertNotIn("session_id_unik", case_payload)

        accepted = self.client.post("/api/emergency/accept_case.php", json={
            "case_id": case_id,
            "responder_label": "Petugas Test"
        })
        second_transition = self.client.post("/api/emergency/false_alarm.php", json={
            "case_id": case_id,
            "reason": "Klik dari tab lain"
        })
        active_after = self.client.get("/api/emergency/active_cases.php").get_json()["data"]
        admin_watch_after = self.client.get("/api/emergency/admin_watch_cases.php").get_json()["data"]

        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(second_transition.status_code, 409)
        self.assertFalse(any(item["id"] == case_id for item in active_after))
        self.assertTrue(any(item["id"] == case_id for item in admin_watch_after))

    def _buat_laporan(self, client, email):
        return client.post("/api/lapor/submit.php", json={
            "pelakuKekerasan": "Pelaku",
            "waktuKejadian": "2026-01-01 10:00",
            "lokasiKejadian": "Kampus",
            "detailKejadian": "Detail kejadian uji",
            "emailKorban": email,
            "usiaKorban": "20"
        }).get_json()

    def test_close_case_requires_kode_pelaporan(self):
        client = self.app.test_client()
        submitted = self._buat_laporan(client, "korban-close@example.com")["data"]

        # Payload lama berbasis id mentah harus ditolak -> menutup celah IDOR.
        legacy = client.post("/api/monitoring/close_case.php", json={
            "laporan_id": submitted["laporan_id"]
        })
        self.assertEqual(legacy.status_code, 400)

        # Kode salah -> 404, tidak menutup kasus milik orang lain.
        wrong = client.post("/api/monitoring/close_case.php", json={
            "kode_pelaporan": "PPKPT000000000"
        })
        self.assertEqual(wrong.status_code, 404)

        # Kode benar -> sukses.
        ok = client.post("/api/monitoring/close_case.php", json={
            "kode_pelaporan": submitted["kode_pelaporan"]
        })
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.get_json()["status"], "success")

    def test_submit_feedback_requires_kode_pelaporan(self):
        client = self.app.test_client()
        submitted = self._buat_laporan(client, "korban-fb@example.com")["data"]

        legacy = client.post("/api/monitoring/submit_feedback.php", json={
            "laporan_id": submitted["laporan_id"],
            "pesan": "halo"
        })
        self.assertEqual(legacy.status_code, 400)

        ok = client.post("/api/monitoring/submit_feedback.php", json={
            "kode_pelaporan": submitted["kode_pelaporan"],
            "pesan": "Terima kasih atas bantuannya"
        })
        self.assertEqual(ok.status_code, 200)

    def test_delete_blog_missing_returns_404(self):
        client = self.app.test_client()
        login = client.post("/api/auth/login.php", json={
            "email": "admin@gmail.com", "password": "admin"
        })
        self.assertEqual(login.status_code, 200)

        res = client.post("/api/blog/delete_blog.php", json={"id": 999999})
        self.assertEqual(res.status_code, 404)

    def test_pesan_untuk_model_membatasi_history(self):
        from api_routes.chatbot import _pesan_untuk_model, MAX_HISTORY_MESSAGES
        history = [{"role": "system", "content": "sys"}]
        for i in range(MAX_HISTORY_MESSAGES + 10):
            history.append({"role": "user", "content": str(i)})

        out = _pesan_untuk_model(history)
        self.assertEqual(out[0]["role"], "system")
        self.assertEqual(len(out), MAX_HISTORY_MESSAGES + 1)
        # Pesan terbaru tetap dipertahankan.
        self.assertEqual(out[-1]["content"], str(MAX_HISTORY_MESSAGES + 9))


if __name__ == "__main__":
    unittest.main()
