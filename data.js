/**
 * WIECARA PPKPT - Shared Mock Data
 * Data ini digunakan oleh semua halaman (Admin, Psikolog, User/Monitoring)
 * Sinkronisasi terjamin karena semuanya membaca dari satu sumber yang sama.
 */

const MOCK_DATA = {

    // =============================================
    // ADMIN PROFILE
    // =============================================
    admin: {
        name: 'Admin PPKPT',
        role: 'Administrator',
        email: 'admin@telkomuniversity.ac.id'
    },

    // =============================================
    // PSIKOLOG PROFILE
    // =============================================
    psikolog: {
        id: 1,
        name: 'Dr. Rina Sari, M.Psi',
        email: 'rina.sari@telkomuniversity.ac.id',
        specialization: 'Psikologi Klinis',
        avatar: null
    },

    // =============================================
    // DAFTAR PSIKOLOG (untuk dropdown jadwal)
    // =============================================
    psikologList: [
        { id: 1, name: 'Dr. Rina Sari, M.Psi', specialization: 'Psikologi Klinis' },
        { id: 2, name: 'Dr. Budi Santoso, M.Psi', specialization: 'Psikologi Forensik' },
        { id: 3, name: 'Dra. Melani Putri, M.Psi', specialization: 'Konseling Trauma' }
    ],

    // =============================================
    // LEGAL SUPPORT PROFILE
    // =============================================
    legalSupport: {
        id: 1,
        name: 'Fajar Nugroho, S.H., M.H.',
        email: 'fajar.nugroho@telkomuniversity.ac.id',
        specialization: 'Hukum Pidana & Perlindungan Korban',
        lisensi: 'PERADI/2021/10234',
        avatar: null
    },

    // =============================================
    // DAFTAR LEGAL SUPPORT (untuk dropdown assignment)
    // =============================================
    legalSupportList: [
        { id: 1, name: 'Fajar Nugroho, S.H., M.H.', specialization: 'Hukum Pidana & Perlindungan Korban' },
        { id: 2, name: 'Siti Aminah, S.H., M.Kn.', specialization: 'Hukum Perdata & Mediasi' }
    ],

    // =============================================
    // CASES (5 kasus — synchronized across all views)
    // =============================================
    cases: [
        {
            id: 'PPKPT001',
            kode_laporan: 'PPKPT001',
            email: 'anisa.r@student.telkomuniversity.ac.id',
            whatsapp: '081234567890',
            status: 'Completed',
            tingkat_kekhawatiran: 'sedikit',
            tanggal_laporan: '2025-01-15',
            gender_korban: 'Perempuan',
            usia_korban: '20-25',
            korban_sebagai: 'Saya Sendiri',
            status_disabilitas: 'Tidak',
            jenis_disabilitas: null,
            pelaku_kekerasan: 'Senior di organisasi kampus',
            waktu_kejadian: '2025-01-10',
            lokasi_kejadian: 'Gedung Rektorat Lantai 3, Kampus Telkom University Surabaya',
            detail_kejadian: 'Saya mengalami intimidasi verbal oleh senior di organisasi kampus. Kejadian terjadi saat rapat internal organisasi. Senior tersebut melakukan tindakan bullying secara verbal dan mengancam akan mengeluarkan saya dari organisasi jika melaporkan kejadian ini.',
            sumber_laporan: 'Website WIECARA',
            status_darurat: false,
            bukti: ['screenshot_chat.jpg', 'rekaman_audio.mp3'],
            // Psikolog assignment
            psikolog_id: 1,
            psikolog_name: 'Dr. Rina Sari, M.Psi',
            jadwal: {
                id: 1,
                tanggal: '2025-01-20',
                waktu: '10:00',
                durasi: 60,
                tipe: 'Online (Video Call)',
                lokasi: 'https://zoom.us/j/1234567890',
                status: 'Selesai'
            },
            catatan_psikolog: {
                id: 1,
                ringkasan: 'Klien mengalami intimidasi verbal dari senior organisasi. Menunjukkan gejala kecemasan ringan dan trauma.',
                detail: 'Pertemuan konsultasi berjalan selama 60 menit. Klien menceritakan kronologi kejadian dengan detail. Terdapat gejala kecemasan ringan (sulit tidur, merasa was-was). Klien kooperatif dan menunjukkan kemauan untuk pulih. Dilakukan teknik grounding dan CBT sederhana.',
                rekomendasi: 'Konseling lanjutan 2 minggu ke depan. Disarankan menjaga jarak dengan pelaku dan melaporkan jika ada intimidasi lanjutan.',
                tingkat_risiko: 'rendah',
                status: 'Confirmed',
                created_at: '2025-01-20'
            },
            feedback_user: {
                status: 'confirmed',
                komentar: 'Terima kasih atas penanganannya. Saya ingin melanjutkan ke proses hukum.',
                keputusan_lanjut: 'legal',
                created_at: '2025-01-22'
            },
            // Legal escalation data
            legal_consent: {
                status: 'approved',
                timestamp: '2025-01-22 09:30',
                consent_text: 'Saya, pelapor dengan kode PPKPT001, dengan sadar dan tanpa paksaan menyetujui eskalasi kasus ini ke pendamping hukum untuk proses hukum lebih lanjut.',
                blockchain_hash: '0x7a3b...f8e2'
            },
            legal_support_id: 1,
            legal_support_name: 'Fajar Nugroho, S.H., M.H.',
            catatan_hukum: {
                id: 1,
                analisis: 'Berdasarkan kronologi dan bukti yang tersedia, kasus ini memenuhi unsur intimidasi sebagaimana diatur dalam Pasal 27 UU TPKS. Bukti digital (screenshot percakapan dan rekaman audio) cukup kuat untuk mendukung laporan.',
                rekomendasi_hukum: 'Mediasi formal melalui institusi kampus sebagai langkah awal. Jika tidak berhasil, dapat dilanjutkan ke jalur pelaporan kepolisian.',
                tindakan_disarankan: ['Mediasi oleh pihak kampus', 'Surat peringatan resmi ke pelaku', 'Dokumentasi untuk laporan kepolisian jika diperlukan'],
                status: 'Dalam Pendampingan',
                created_at: '2025-01-24'
            },
            timeline: [
                { phase: 1, title: 'Laporan Diterima', status: 'completed', date: '2025-01-15 08:30', description: 'Laporan berhasil diterima dan kode monitoring PPKPT001 dikirim ke email pelapor.' },
                { phase: 2, title: 'Verifikasi & Asesmen Awal', status: 'completed', date: '2025-01-16 10:00', description: 'Tim Satgas melakukan verifikasi data pelapor dan asesmen awal tingkat urgensi kasus.' },
                { phase: 3, title: 'Penjadwalan Konsultasi', status: 'completed', date: '2025-01-18 14:00', description: 'Jadwal konsultasi ditetapkan pada 20 Januari 2025, pukul 10:00 WIB via Zoom.' },
                { phase: 4, title: 'Konsultasi Psikolog', status: 'completed', date: '2025-01-20 10:00', description: 'Sesi konsultasi dengan Dr. Rina Sari, M.Psi telah selesai dilaksanakan.' },
                { phase: 5, title: 'Konfirmasi Penyintas', status: 'completed', date: '2025-01-22 09:00', description: 'Penyintas mengkonfirmasi hasil konsultasi dan memilih melanjutkan ke proses hukum.' },
                { phase: 6, title: 'Eskalasi ke Pendamping Hukum', status: 'completed', date: '2025-01-22 10:00', description: 'Admin meneruskan kasus ke pendamping hukum setelah persetujuan eksplisit dari penyintas.' },
                { phase: 7, title: 'Pendampingan Hukum', status: 'active', date: '2025-01-24 09:00', description: 'Pendamping hukum mengakses laporan (read-only) dan memberikan analisis hukum.' }
            ],
            audit_trail: [
                { actor: 'Sistem', role: 'system', action: 'Laporan baru diterima', timestamp: '2025-01-15 08:30', detail: 'Kode laporan: PPKPT001', blockchain_hash: '0x1a2b...3c4d' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Verifikasi laporan', timestamp: '2025-01-16 10:00', detail: 'Status diubah ke Investigasi', blockchain_hash: '0x2b3c...4d5e' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Menjadwalkan konsultasi', timestamp: '2025-01-18 14:00', detail: 'Psikolog: Dr. Rina Sari, M.Psi', blockchain_hash: '0x3c4d...5e6f' },
                { actor: 'Dr. Rina Sari, M.Psi', role: 'psikolog', action: 'Submit catatan konsultasi', timestamp: '2025-01-20 11:15', detail: 'Tingkat risiko: Rendah', blockchain_hash: '0x4d5e...6f7a' },
                { actor: 'Penyintas', role: 'user', action: 'Konfirmasi & pilih eskalasi hukum', timestamp: '2025-01-22 09:00', detail: 'Persetujuan eksplisit untuk eskalasi ke pendamping hukum', blockchain_hash: '0x5e6f...7a8b' },
                { actor: 'Sistem', role: 'system', action: 'Consent terekam di blockchain', timestamp: '2025-01-22 09:30', detail: 'Hash consent: 0x7a3b...f8e2', blockchain_hash: '0x6f7a...8b9c' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Meneruskan ke pendamping hukum', timestamp: '2025-01-22 10:00', detail: 'Pendamping: Fajar Nugroho, S.H., M.H.', blockchain_hash: '0x7a8b...9c0d' },
                { actor: 'Fajar Nugroho, S.H., M.H.', role: 'legal', action: 'Akses laporan (read-only)', timestamp: '2025-01-23 08:00', detail: 'Verifikasi audit trail & bukti', blockchain_hash: '0x8b9c...0d1e' },
                { actor: 'Fajar Nugroho, S.H., M.H.', role: 'legal', action: 'Submit analisis hukum', timestamp: '2025-01-24 09:00', detail: 'Rekomendasi: Mediasi formal', blockchain_hash: '0x9c0d...1e2f' }
            ]
        },
        {
            id: 'PPKPT002',
            kode_laporan: 'PPKPT002',
            email: 'budi.w@student.telkomuniversity.ac.id',
            whatsapp: '081298765432',
            status: 'Process',
            tingkat_kekhawatiran: 'khawatir',
            tanggal_laporan: '2025-01-10',
            gender_korban: 'Laki-laki',
            usia_korban: '18-20',
            korban_sebagai: 'Teman saya',
            status_disabilitas: 'Tidak',
            jenis_disabilitas: null,
            pelaku_kekerasan: 'Dosen pembimbing akademik',
            waktu_kejadian: '2025-01-05',
            lokasi_kejadian: 'Ruang Dosen Gedung B, Kampus Telkom University Surabaya',
            detail_kejadian: 'Teman saya mengalami perlakuan tidak menyenangkan dari dosen pembimbing akademik. Dosen tersebut memberikan tekanan berlebihan dan mengancam akan memberikan nilai buruk jika tidak menuruti keinginannya. Teman saya merasa tertekan dan tidak berani melapor sendiri.',
            sumber_laporan: 'Website WIECARA',
            status_darurat: false,
            bukti: ['screenshot_email.jpg'],
            psikolog_id: null,
            psikolog_name: null,
            jadwal: null,
            catatan_psikolog: null,
            feedback_user: null,
            timeline: [
                { phase: 1, title: 'Laporan Diterima', status: 'completed', date: '2025-01-10 14:20', description: 'Laporan berhasil diterima dan kode monitoring PPKPT002 dikirim ke email pelapor.' },
                { phase: 2, title: 'Verifikasi & Asesmen Awal', status: 'active', date: '2025-01-11 09:00', description: 'Tim Satgas sedang melakukan verifikasi data dan asesmen awal.' },
                { phase: 3, title: 'Penjadwalan Konsultasi', status: 'pending', date: null, description: 'Menunggu hasil verifikasi untuk penjadwalan.' },
                { phase: 4, title: 'Konsultasi Psikolog', status: 'pending', date: null, description: 'Belum dijadwalkan.' },
                { phase: 5, title: 'Penyelesaian Kasus', status: 'pending', date: null, description: 'Menunggu proses sebelumnya selesai.' }
            ],
            audit_trail: [
                { actor: 'Sistem', role: 'system', action: 'Laporan baru diterima', timestamp: '2025-01-10 14:20', detail: 'Kode laporan: PPKPT002' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Mulai verifikasi', timestamp: '2025-01-11 09:00', detail: 'Asesmen awal sedang dilakukan' }
            ]
        },
        {
            id: 'GNJ34',
            kode_laporan: 'GNJ34',
            email: 'citra.d@student.telkomuniversity.ac.id',
            whatsapp: '081356789012',
            status: 'Investigation',
            tingkat_kekhawatiran: 'sangat',
            tanggal_laporan: '2025-01-20',
            gender_korban: 'Perempuan',
            usia_korban: '18-20',
            korban_sebagai: 'Saya Sendiri',
            status_disabilitas: 'Tidak',
            jenis_disabilitas: null,
            pelaku_kekerasan: 'Mahasiswa tingkat atas',
            waktu_kejadian: '2025-01-18',
            lokasi_kejadian: 'Area Parkir Kampus Telkom University Surabaya',
            detail_kejadian: 'Saya mengalami pelecehan verbal dan fisik oleh mahasiswa tingkat atas di area parkir kampus. Kejadian terjadi sore hari ketika area kampus sudah mulai sepi. Pelaku melakukan tindakan yang membuat saya sangat tidak nyaman dan takut.',
            sumber_laporan: 'Website WIECARA',
            status_darurat: true,
            bukti: ['foto_cctv.jpg', 'rekaman_video.mp4'],
            psikolog_id: 1,
            psikolog_name: 'Dr. Rina Sari, M.Psi',
            jadwal: {
                id: 2,
                tanggal: '2025-01-25',
                waktu: '14:00',
                durasi: 90,
                tipe: 'Offline (Tatap Muka)',
                lokasi: 'Ruang Konseling Lt. 2 Gedung Student Center',
                status: 'Dijadwalkan'
            },
            catatan_psikolog: null,
            feedback_user: null,
            timeline: [
                { phase: 1, title: 'Laporan Diterima', status: 'completed', date: '2025-01-20 16:45', description: 'Laporan berhasil diterima. Kasus ditandai sebagai DARURAT.' },
                { phase: 2, title: 'Verifikasi & Asesmen Awal', status: 'completed', date: '2025-01-20 17:30', description: 'Verifikasi cepat dilakukan. Kasus bersifat darurat, ditindaklanjuti segera.' },
                { phase: 3, title: 'Penjadwalan Konsultasi', status: 'completed', date: '2025-01-21 09:00', description: 'Jadwal konsultasi ditetapkan pada 25 Januari 2025 pukul 14:00 WIB, tatap muka.' },
                { phase: 4, title: 'Konsultasi Psikolog', status: 'active', date: null, description: 'Menunggu sesi konsultasi pada tanggal yang dijadwalkan.' },
                { phase: 5, title: 'Penyelesaian Kasus', status: 'pending', date: null, description: 'Menunggu proses konsultasi selesai.' }
            ],
            audit_trail: [
                { actor: 'Sistem', role: 'system', action: 'Laporan DARURAT diterima', timestamp: '2025-01-20 16:45', detail: 'Kode laporan: GNJ34 — PRIORITAS TINGGI' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Verifikasi darurat', timestamp: '2025-01-20 17:30', detail: 'Kasus darurat, tindak lanjut segera' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Menjadwalkan konsultasi', timestamp: '2025-01-21 09:00', detail: 'Psikolog: Dr. Rina Sari, M.Psi — Tatap Muka' }
            ]
        },
        {
            id: 'PPKPT004',
            kode_laporan: 'PPKPT004',
            email: 'dewi.m@student.telkomuniversity.ac.id',
            whatsapp: '081267890123',
            status: 'Process',
            tingkat_kekhawatiran: 'sedikit',
            tanggal_laporan: '2025-01-25',
            gender_korban: 'Perempuan',
            usia_korban: '20-25',
            korban_sebagai: 'Orang lain',
            status_disabilitas: 'Ya',
            jenis_disabilitas: 'Tunanetra',
            pelaku_kekerasan: 'Staf administrasi',
            waktu_kejadian: '2025-01-22',
            lokasi_kejadian: 'Kantor Administrasi Akademik, Kampus Telkom University Surabaya',
            detail_kejadian: 'Saya menyaksikan staf administrasi memperlakukan teman saya yang memiliki disabilitas secara tidak layak. Staf tersebut menolak memberikan pelayanan dengan alasan yang tidak jelas dan menggunakan kata-kata yang merendahkan.',
            sumber_laporan: 'WhatsApp Darurat',
            status_darurat: false,
            bukti: [],
            psikolog_id: null,
            psikolog_name: null,
            jadwal: null,
            catatan_psikolog: null,
            feedback_user: null,
            timeline: [
                { phase: 1, title: 'Laporan Diterima', status: 'completed', date: '2025-01-25 11:00', description: 'Laporan diterima melalui WhatsApp darurat. Kode monitoring PPKPT004 dikirim.' },
                { phase: 2, title: 'Verifikasi & Asesmen Awal', status: 'active', date: '2025-01-26 08:30', description: 'Tim Satgas sedang memverifikasi dan melakukan asesmen awal.' },
                { phase: 3, title: 'Penjadwalan Konsultasi', status: 'pending', date: null, description: 'Menunggu hasil verifikasi.' },
                { phase: 4, title: 'Konsultasi Psikolog', status: 'pending', date: null, description: 'Belum dijadwalkan.' },
                { phase: 5, title: 'Penyelesaian Kasus', status: 'pending', date: null, description: 'Menunggu proses sebelumnya selesai.' }
            ],
            audit_trail: [
                { actor: 'Sistem', role: 'system', action: 'Laporan baru diterima (WhatsApp)', timestamp: '2025-01-25 11:00', detail: 'Kode laporan: PPKPT004' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Mulai verifikasi', timestamp: '2025-01-26 08:30', detail: 'Verifikasi data pelapor' }
            ]
        },
        {
            id: 'PPKPT005',
            kode_laporan: 'PPKPT005',
            email: 'eka.p@student.telkomuniversity.ac.id',
            whatsapp: '081345678901',
            status: 'Completed',
            tingkat_kekhawatiran: 'khawatir',
            tanggal_laporan: '2025-02-01',
            gender_korban: 'Perempuan',
            usia_korban: '20-25',
            korban_sebagai: 'Saya Sendiri',
            status_disabilitas: 'Tidak',
            jenis_disabilitas: null,
            pelaku_kekerasan: 'Teman seangkatan',
            waktu_kejadian: '2025-01-28',
            lokasi_kejadian: 'Kantin Kampus Telkom University Surabaya',
            detail_kejadian: 'Teman seangkatan melakukan pelecehan verbal secara berulang di area kantin kampus. Pelaku sering membuat komentar yang tidak pantas dan bersifat seksual di depan mahasiswa lain, membuat saya sangat tidak nyaman.',
            sumber_laporan: 'Website WIECARA',
            status_darurat: false,
            bukti: ['screenshot_chat_1.jpg', 'screenshot_chat_2.jpg', 'foto_bukti.jpg'],
            psikolog_id: 1,
            psikolog_name: 'Dr. Rina Sari, M.Psi',
            jadwal: {
                id: 3,
                tanggal: '2025-02-05',
                waktu: '09:00',
                durasi: 60,
                tipe: 'Online (Video Call)',
                lokasi: 'https://zoom.us/j/9876543210',
                status: 'Selesai'
            },
            catatan_psikolog: {
                id: 2,
                ringkasan: 'Klien mengalami pelecehan verbal berulang oleh teman seangkatan. Menunjukkan gejala kecemasan sosial.',
                detail: 'Sesi konsultasi berlangsung 60 menit via Zoom. Klien menceritakan bahwa pelecehan verbal sudah terjadi selama beberapa bulan. Terdapat gejala kecemasan sosial, sulit berkonsentrasi di kelas, dan menghindari area kantin. Dilakukan teknik relaksasi dan perencanaan strategi coping.',
                rekomendasi: 'Follow-up konseling dalam 1 minggu. Disarankan melaporkan ke pihak dekanat untuk tindakan disipliner terhadap pelaku.',
                tingkat_risiko: 'sedang',
                status: 'Confirmed',
                created_at: '2025-02-05'
            },
            feedback_user: {
                status: 'confirmed',
                komentar: 'Konsultasinya sangat membantu. Saya jadi tahu cara menghadapi situasi ini.',
                created_at: '2025-02-07'
            },
            timeline: [
                { phase: 1, title: 'Laporan Diterima', status: 'completed', date: '2025-02-01 10:15', description: 'Laporan berhasil diterima dan kode monitoring PPKPT005 dikirim ke email pelapor.' },
                { phase: 2, title: 'Verifikasi & Asesmen Awal', status: 'completed', date: '2025-02-02 09:00', description: 'Tim Satgas melakukan verifikasi data pelapor dan asesmen awal.' },
                { phase: 3, title: 'Penjadwalan Konsultasi', status: 'completed', date: '2025-02-03 11:00', description: 'Jadwal konsultasi ditetapkan pada 5 Februari 2025 pukul 09:00 WIB via Zoom.' },
                { phase: 4, title: 'Konsultasi Psikolog', status: 'completed', date: '2025-02-05 09:00', description: 'Sesi konsultasi dengan Dr. Rina Sari, M.Psi telah selesai dilaksanakan.' },
                { phase: 5, title: 'Penyelesaian Kasus', status: 'completed', date: '2025-02-07 08:30', description: 'User mengkonfirmasi hasil konsultasi. Kasus ditutup.' }
            ],
            audit_trail: [
                { actor: 'Sistem', role: 'system', action: 'Laporan baru diterima', timestamp: '2025-02-01 10:15', detail: 'Kode laporan: PPKPT005' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Verifikasi laporan', timestamp: '2025-02-02 09:00', detail: 'Data terverifikasi' },
                { actor: 'Admin PPKPT', role: 'admin', action: 'Menjadwalkan konsultasi', timestamp: '2025-02-03 11:00', detail: 'Psikolog: Dr. Rina Sari, M.Psi' },
                { actor: 'Dr. Rina Sari, M.Psi', role: 'psikolog', action: 'Submit catatan konsultasi', timestamp: '2025-02-05 10:00', detail: 'Tingkat risiko: Sedang' },
                { actor: 'User', role: 'user', action: 'Konfirmasi hasil konsultasi', timestamp: '2025-02-07 08:30', detail: 'Status: Setuju & Selesai' }
            ]
        }
    ],

    // =============================================
    // BLOG POSTS
    // =============================================
    blogPosts: [
        {
            id: 1,
            title: 'Mengenali Tanda-Tanda Kekerasan di Lingkungan Kampus',
            slug: 'mengenali-tanda-kekerasan',
            excerpt: 'Kekerasan di kampus bisa terjadi dalam berbagai bentuk. Pelajari cara mengenali tanda-tandanya agar kita bisa melindungi diri sendiri dan orang di sekitar kita.',
            content: '<p>Kekerasan di lingkungan kampus merupakan masalah serius yang seringkali tidak terdeteksi karena berbagai faktor. Banyak korban yang tidak menyadari bahwa mereka sedang mengalami kekerasan, atau merasa takut untuk melapor.</p><h3>Bentuk-Bentuk Kekerasan di Kampus</h3><p>1. <strong>Kekerasan Verbal</strong> — Ucapan yang merendahkan, ancaman, atau intimidasi secara verbal.</p><p>2. <strong>Kekerasan Fisik</strong> — Tindakan fisik yang menyakiti atau mengancam keselamatan.</p><p>3. <strong>Pelecehan Seksual</strong> — Tindakan, ucapan, atau gestur yang bersifat seksual dan tidak diinginkan.</p><p>4. <strong>Bullying</strong> — Tindakan berulang yang bertujuan mengintimidasi atau menyakiti.</p><h3>Cara Mengenali Tanda-Tanda</h3><p>Jika Anda atau orang di sekitar mengalami perubahan perilaku mendadak seperti menarik diri, cemas berlebihan, atau menghindari tempat tertentu, itu bisa menjadi tanda adanya kekerasan yang perlu ditangani.</p>',
            author: 'Tim Satgas PPKPT',
            category: 'Edukasi',
            date: '2025-01-15',
            image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
            tags: ['kekerasan', 'kampus', 'edukasi', 'pencegahan']
        },
        {
            id: 2,
            title: 'Langkah-Langkah Melaporkan Kekerasan Seksual di Kampus',
            slug: 'langkah-melaporkan-kekerasan',
            excerpt: 'Panduan lengkap tentang bagaimana cara melaporkan tindak kekerasan seksual di lingkungan kampus melalui jalur resmi Satgas PPKPT.',
            content: '<p>Melaporkan kekerasan seksual memang membutuhkan keberanian besar. Namun, langkah ini sangat penting untuk melindungi diri Anda dan mencegah kejadian serupa terjadi pada orang lain.</p><h3>Langkah 1: Pastikan Keselamatan Anda</h3><p>Prioritas utama adalah keselamatan Anda. Jauhi pelaku dan cari tempat yang aman.</p><h3>Langkah 2: Kumpulkan Bukti</h3><p>Simpan pesan, screenshot, foto, atau rekaman yang relevan. Jangan menghapus bukti apapun.</p><h3>Langkah 3: Laporkan ke WIECARA</h3><p>Gunakan platform WIECARA untuk melaporkan kejadian secara rahasia. Klik tombol LAPOR di website atau hubungi hotline kami.</p><h3>Langkah 4: Dapatkan Pendampingan</h3><p>Anda akan mendapatkan kode monitoring untuk memantau progress dan berhak atas pendampingan psikologis dan hukum.</p>',
            author: 'Tim Satgas PPKPT',
            category: 'Panduan',
            date: '2025-01-20',
            image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80',
            tags: ['panduan', 'pelaporan', 'kekerasan seksual']
        },
        {
            id: 3,
            title: 'Pemulihan Psikologis: Dari Trauma Menuju Resiliensi',
            slug: 'pemulihan-psikologis',
            excerpt: 'Memahami proses pemulihan psikologis bagi penyintas kekerasan dan bagaimana lingkungan kampus dapat mendukung proses recovery.',
            content: '<p>Pemulihan dari pengalaman kekerasan adalah proses yang membutuhkan waktu dan dukungan. Setiap individu memiliki timeline pemulihan yang berbeda, dan tidak ada yang salah dengan proses Anda.</p><h3>Tahapan Pemulihan</h3><p>1. <strong>Pengakuan</strong> — Mengakui bahwa kejadian tersebut bukan kesalahan Anda.</p><p>2. <strong>Pencarian Bantuan</strong> — Menghubungi profesional atau orang yang dipercaya.</p><p>3. <strong>Proses Terapi</strong> — Menjalani konseling untuk memproses pengalaman traumatis.</p><p>4. <strong>Membangun Kembali</strong> — Membangun kembali rasa aman dan kepercayaan diri.</p>',
            author: 'Dr. Rina Sari, M.Psi',
            category: 'Psikologi',
            date: '2025-02-01',
            image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80',
            tags: ['pemulihan', 'psikologi', 'trauma', 'resiliensi']
        },
        {
            id: 4,
            title: 'UU TPKS: Perlindungan Hukum bagi Penyintas Kekerasan Seksual',
            slug: 'uu-tpks-perlindungan',
            excerpt: 'Penjelasan mengenai Undang-Undang Tindak Pidana Kekerasan Seksual (UU TPKS) dan bagaimana undang-undang ini melindungi hak-hak penyintas.',
            content: '<p>Undang-Undang Nomor 12 Tahun 2022 tentang Tindak Pidana Kekerasan Seksual (UU TPKS) merupakan tonggak penting dalam perlindungan hukum bagi penyintas kekerasan seksual di Indonesia.</p><h3>Poin-Poin Penting UU TPKS</h3><p>1. Definisi yang lebih luas tentang kekerasan seksual</p><p>2. Perlindungan identitas korban yang ketat</p><p>3. Hak atas pendampingan hukum dan psikologis</p><p>4. Larangan blaming terhadap korban</p><p>5. Restitusi dan pemulihan bagi penyintas</p>',
            author: 'Tim Satgas PPKPT',
            category: 'Hukum',
            date: '2025-02-10',
            image: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=800&q=80',
            tags: ['hukum', 'UU TPKS', 'perlindungan', 'kekerasan seksual']
        }
    ],

    // =============================================
    // COMPUTED STATISTICS (derived from cases)
    // =============================================
    getStatistics() {
        const cases = this.cases;
        const total = cases.length;
        const statusCount = { Process: 0, Investigation: 0, Completed: 0 };
        const genderCount = { 'Laki-laki': 0, 'Perempuan': 0 };
        const worryCount = { sedikit: 0, khawatir: 0, sangat: 0 };

        cases.forEach(c => {
            // Status
            if (c.status === 'Process') statusCount.Process++;
            else if (c.status === 'Investigation' || c.status === 'Dijadwalkan') statusCount.Investigation++;
            else if (c.status === 'Completed') statusCount.Completed++;

            // Gender
            if (genderCount[c.gender_korban] !== undefined) genderCount[c.gender_korban]++;

            // Worry level
            if (worryCount[c.tingkat_kekhawatiran] !== undefined) worryCount[c.tingkat_kekhawatiran]++;
        });

        return {
            total,
            process: statusCount.Process,
            investigation: statusCount.Investigation,
            completed: statusCount.Completed,
            gender: genderCount,
            worry: worryCount
        };
    },

    // =============================================
    // HELPER: Find case by ID or email
    // =============================================
    findCase(query) {
        if (!query) return null;
        const q = query.trim().toLowerCase();
        return this.cases.find(c =>
            c.id.toLowerCase() === q ||
            c.kode_laporan.toLowerCase() === q ||
            c.email.toLowerCase() === q
        ) || null;
    },

    // =============================================
    // HELPER: Get psikolog cases
    // =============================================
    getPsikologCases(psikologId) {
        return this.cases.filter(c => c.psikolog_id === psikologId);
    },

    // =============================================
    // HELPER: Get blog posts
    // =============================================
    getBlogPosts(limit = null) {
        const posts = [...this.blogPosts];
        // Sort by date descending (newest first)
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (limit && limit > 0) {
            return posts.slice(0, limit);
        }
        return posts;
    },

    // =============================================
    // HELPER: Get blog post by ID
    // =============================================
    getBlogPostById(id) {
        return this.blogPosts.find(p => p.id == id) || null;
    },

    // =============================================
    // HELPER: Get legal support cases
    // =============================================
    getLegalCases(legalId) {
        return this.cases.filter(c => c.legal_support_id === legalId);
    },

    // =============================================
    // HELPER: Get cases with legal consent
    // =============================================
    getCasesWithLegalConsent() {
        return this.cases.filter(c => c.legal_consent && c.legal_consent.status === 'approved');
    },

    // =============================================
    // HELPER: Generate mock blockchain hash (demo)
    // =============================================
    generateBlockchainHash() {
        const chars = '0123456789abcdef';
        let hash = '0x';
        for (let i = 0; i < 64; i++) {
            hash += chars[Math.floor(Math.random() * chars.length)];
        }
        return hash;
    }
};
