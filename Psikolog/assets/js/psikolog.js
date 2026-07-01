document.addEventListener('DOMContentLoaded', async function () {
    // Auth Check & Data Fetching
    try {
        const authRes = await fetch('../../api/psikolog/get_cases.php');
        const result = await authRes.json();
        
        if (result.status !== 'success') {
            window.location.href = 'login.html';
            return;
        }

        const myCases = result.data.cases;
        
        // Profile
        const name = sessionStorage.getItem('psikolog_name') || 'Psikolog';
        document.getElementById('profileName').textContent = name;
        document.getElementById('profileSpecialization').textContent = 'Psikolog Klinis';

        // Date
        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        // Stats
        const total = myCases.length;
        const aktif = myCases.filter(c => c.status_laporan !== 'Completed').length;
        const selesai = myCases.filter(c => c.status_laporan === 'Completed').length;

        setText('statTotal', total);
        setText('statAktif', aktif);
        setText('statMenunggu', 0); // Placeholder
        setText('statDispute', 0); // Placeholder
        setText('statSelesai', selesai);

        // Recent Cases Table
        renderCasesTable('recentCasesBody', myCases.slice(0, 5));

        // All Cases Table
        renderCasesTable('allCasesBody', myCases);

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                const val = statusFilter.value;
                const filtered = val ? myCases.filter(c => {
                    if (val === 'Closed') return c.status_laporan === 'Completed';
                    return true;
                }) : myCases;
                renderCasesTable('allCasesBody', filtered);
            });
        }

        // Schedule list
        const scheduleList = document.getElementById('scheduleList');
        if (scheduleList) {
            const scheduledCases = myCases; // Every case here is a schedule technically based on our DB setup
            if (scheduledCases.length === 0) {
                scheduleList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Belum ada jadwal pertemuan</p></div>';
            } else {
                scheduleList.innerHTML = scheduledCases.map(c => {
                    const dt = new Date(c.tanggal);
                    const statusClass = c.status === 'Selesai' ? 'stat-success' : 'stat-info';
                    return `
                    <div class="schedule-item" style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #fafafa;">
                        <div>
                            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                                <i class="fas fa-user" style="color: #6366f1; margin-right: 6px;"></i>
                                Kasus #${c.kode_pelaporan}
                            </div>
                            <div style="font-size: 0.85rem; color: #64748b;">
                                <i class="fas fa-calendar" style="margin-right: 4px;"></i>
                                ${dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} — ${c.waktu} WIB
                            </div>
                            <div style="font-size: 0.85rem; color: #64748b; margin-top: 2px;">
                                <i class="fas fa-${c.tipe_konseling && c.tipe_konseling.includes('Online') ? 'video' : 'building'}" style="margin-right: 4px;"></i>
                                ${c.tipe_konseling} — ${c.lokasi}
                            </div>
                        </div>
                        <span style="padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;
                            background: ${c.status === 'Selesai' ? '#dcfce7' : '#e0f2fe'};
                            color: ${c.status === 'Selesai' ? '#16a34a' : '#0284c7'};">${c.status}</span>
                    </div>
                    `;
                }).join('');
            }
        }

        // Navigation
        document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                const target = document.getElementById('page-' + page);
                if (target) target.classList.add('active');
                const titles = { overview: 'Overview', cases: 'Kasus Saya', schedule: 'Jadwal' };
                document.getElementById('pageTitle').textContent = titles[page] || 'Overview';
            });
        });

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const mobileToggle = document.getElementById('mobileToggle');
        const sidebar = document.getElementById('sidebar');
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
        if (mobileToggle) mobileToggle.addEventListener('click', () => sidebar.classList.toggle('mobile-open'));

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await fetch('../../api/psikolog/logout.php');
            window.location.href = 'login.html';
        });

        // Modal functionality
        const caseModal = document.getElementById('caseModal');
        const modalClose = document.getElementById('modalClose');
        if (modalClose) modalClose.addEventListener('click', () => { caseModal.style.display = 'none'; });
        if (caseModal) caseModal.addEventListener('click', (e) => { if (e.target === caseModal) caseModal.style.display = 'none'; });

        // Tab switching in modal
        document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
            });
        });

        // Make openCaseModal global
        window.openCaseModal = async function (jadwalId, laporanId) {
            if (!caseModal) return;
            
            try {
                const detailRes = await fetch(`../../api/psikolog/get_case_detail.php?id=${laporanId}`);
                const detailData = await detailRes.json();
                
                if (detailData.status !== 'success') {
                    alert('Gagal mengambil data kasus.');
                    return;
                }
                
                const c = detailData.data;
                caseModal.style.display = 'flex';
                document.getElementById('modalTitle').textContent = 'Detail Kasus #' + c.kode_pelaporan;

                // Detail tab
                const detailGrid = document.getElementById('caseDetailGrid');
                if (detailGrid) {
                    let notesHtml = '';
                    if (c.catatan_psikolog && c.catatan_psikolog.length > 0) {
                        notesHtml = '<div style="grid-column:1/-1; margin-top:20px;"><h6 style="color:#06b6d4;margin:0 0 12px;font-weight:600;"><i class="fas fa-clipboard-check"></i> Riwayat Catatan Konsultasi (' + c.catatan_psikolog.length + ' sesi)</h6>';
                        notesHtml += c.catatan_psikolog.map(n => {
                            const dt = new Date(n.created_at).toLocaleString('id-ID');
                            return `
                            <div style="background:#ecfeff; border-left:4px solid #06b6d4; padding:16px; border-radius:6px; margin-bottom:10px;">
                                <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:8px;">${dt} — <strong style="color:#06b6d4;">${n.psikolog_nama || 'Psikolog'}</strong></div>
                                <div style="margin-bottom:6px;"><strong style="color:#475569;">Ringkasan:</strong> <span style="color:#1e293b;">${n.ringkasan_kasus || '-'}</span></div>
                                <div style="margin-bottom:6px;"><strong style="color:#475569;">Detail:</strong> <span style="color:#1e293b;">${n.detail_konsultasi || '-'}</span></div>
                                <div style="margin-bottom:6px;"><strong style="color:#475569;">Rekomendasi:</strong> <span style="color:#1e293b;">${n.rekomendasi || '-'}</span></div>
                                <div><strong style="color:#475569;">Risiko:</strong> <span style="color:#1e293b; text-transform:capitalize;">${n.tingkat_risiko || '-'}</span></div>
                            </div>`;
                        }).join('');
                        notesHtml += '</div>';
                    }
                    
                    if (c.catatan_hukum && c.catatan_hukum.length > 0) {
                        notesHtml += '<div style="grid-column:1/-1; margin-top:20px;"><h6 style="color:#dc2626;margin:0 0 12px;font-weight:600;"><i class="fas fa-gavel"></i> Catatan Pendamping Hukum (' + c.catatan_hukum.length + ')</h6>';
                        notesHtml += c.catatan_hukum.map(ch => {
                            const dt = new Date(ch.created_at).toLocaleString('id-ID');
                            return `
                            <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:6px; margin-bottom:10px;">
                                <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:8px;">${dt} — <strong style="color:#dc2626;">${ch.legal_nama || 'Pendamping Hukum'}</strong></div>
                                <div style="margin-bottom:6px;"><strong style="color:#475569;">Analisis:</strong> <span style="color:#1e293b;">${ch.analisis_hukum || '-'}</span></div>
                                <div style="margin-bottom:6px;"><strong style="color:#475569;">Rekomendasi:</strong> <span style="color:#1e293b;">${ch.rekomendasi_hukum || '-'}</span></div>
                                <div><strong style="color:#475569;">Pasal Terkait:</strong> <span style="color:#1e293b;">${ch.pasal_terkait || '-'}</span></div>
                            </div>`;
                        }).join('');
                        notesHtml += '</div>';
                    }

                    detailGrid.innerHTML = `
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div><label style="font-size:0.8rem;color:#94a3b8;display:block;">Kode Laporan</label><span style="font-weight:600;">${c.kode_pelaporan}</span></div>
                            <div><label style="font-size:0.8rem;color:#94a3b8;display:block;">Status</label><span style="font-weight:600;">${c.status_laporan}</span></div>
                            <div><label style="font-size:0.8rem;color:#94a3b8;display:block;">Email Korban</label><span>${c.email_korban}</span></div>
                            <div><label style="font-size:0.8rem;color:#94a3b8;display:block;">WhatsApp</label><span>${c.whatsapp_korban || '-'}</span></div>
                            <div><label style="font-size:0.8rem;color:#94a3b8;display:block;">Gender</label><span>${c.gender_korban || '-'}</span></div>
                            <div><label style="font-size:0.8rem;color:#94a3b8;display:block;">Usia</label><span>${c.usia_korban || '-'} tahun</span></div>
                            <div style="grid-column:1/-1;"><label style="font-size:0.8rem;color:#94a3b8;display:block;">Kronologi</label><p style="margin-top:4px;line-height:1.6;color:#475569;">${c.detail_kejadian || '-'}</p></div>
                            ${notesHtml}
                        </div>
                    `;
                }

                // Feedback tab
                const feedbackList = document.getElementById('feedbackList');
                if (feedbackList) {
                    if (!c.feedback || c.feedback.length === 0) {
                        feedbackList.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px;">Belum ada umpan balik dari pengguna.</p>';
                    } else {
                        feedbackList.innerHTML = c.feedback.map(f => {
                            const dt = new Date(f.created_at).toLocaleString('id-ID');
                            return `
                            <div style="background: #f8fafc; border-left: 4px solid #2fc4b2; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
                                <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">${dt} - Pesan dari Pelapor</div>
                                <div style="font-size: 0.95rem; color: #1e293b;">${f.komentar_user}</div>
                            </div>
                            `;
                        }).join('');
                    }
                }

                // Reset to first tab
                document.querySelectorAll('.modal-tabs .tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
                document.querySelectorAll('.tab-content').forEach((t, i) => t.classList.toggle('active', i === 0));
                
                // Populate existing notes if any
                if (c.catatan_psikolog && c.catatan_psikolog.length > 0) {
                    const lastNote = c.catatan_psikolog[0];
                    if (document.getElementById('ringkasanKasus')) document.getElementById('ringkasanKasus').value = lastNote.ringkasan_kasus || '';
                    if (document.getElementById('detailKonsultasi')) document.getElementById('detailKonsultasi').value = lastNote.detail_konsultasi || '';
                    if (document.getElementById('rekomendasi')) document.getElementById('rekomendasi').value = lastNote.rekomendasi || '';
                    if (document.querySelector(`input[name="tingkatRisiko"][value="${lastNote.tingkat_risiko}"]`)) {
                        document.querySelector(`input[name="tingkatRisiko"][value="${lastNote.tingkat_risiko}"]`).checked = true;
                    }
                } else {
                    if (document.getElementById('ringkasanKasus')) document.getElementById('ringkasanKasus').value = '';
                    if (document.getElementById('detailKonsultasi')) document.getElementById('detailKonsultasi').value = '';
                    if (document.getElementById('rekomendasi')) document.getElementById('rekomendasi').value = '';
                    if (document.querySelector('input[name="tingkatRisiko"][value="sedang"]')) {
                        document.querySelector('input[name="tingkatRisiko"][value="sedang"]').checked = true;
                    }
                }
                
                // Set jadwal_id in notes form if exists
                const notesForm = document.getElementById('notesForm');
                if (notesForm) {
                    notesForm.onsubmit = async (e) => {
                        e.preventDefault();
                        const ringkasan = document.getElementById('ringkasanKasus')?.value || '';
                        const notes = document.getElementById('detailKonsultasi')?.value || '';
                        const rekomendasi = document.getElementById('rekomendasi')?.value || '';
                        const tingkatRisiko = document.querySelector('input[name="tingkatRisiko"]:checked')?.value || 'sedang';
                        
                        const response = await fetch('../../api/psikolog/update_notes.php', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                jadwal_id: jadwalId,
                                laporan_id: laporanId,
                                ringkasan: ringkasan,
                                notes: notes,
                                rekomendasi: rekomendasi,
                                tingkat_risiko: tingkatRisiko,
                                status: 'Selesai'
                            })
                        });
                        const result = await response.json();
                        if (result.status === 'success') {
                            alert('Catatan berhasil disimpan!');
                            caseModal.style.display = 'none';
                            location.reload();
                        } else {
                            alert('Gagal: ' + result.message);
                        }
                        caseModal.style.display = 'none';
                        window.location.reload();
                    };
                }
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan saat membuka detail.');
            }
        };

    } catch (e) {
        console.error('Failed to load dashboard data', e);
        window.location.href = 'login.html';
    }

    function renderCasesTable(tbodyId, cases) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        if (cases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada kasus</p></td></tr>';
            return;
        }
        tbody.innerHTML = cases.map(c => {
            const jadwalText = new Date(c.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + c.waktu;
            const statusLabels = { Completed: 'Selesai', Process: 'Baru', Investigasi: 'Investigasi' };
            const statusColors = { Completed: '#22c55e', Process: '#3b82f6', Investigasi: '#f59e0b' };
            return `
            <tr style="cursor:pointer;" onclick="openCaseModal('${c.id}', '${c.laporan_id}')">
                <td><span style="font-weight:600;color:#1e293b;">${c.kode_pelaporan}</span></td>
                <td><span style="padding:3px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;background:${statusColors[c.status_laporan] || '#94a3b8'}22;color:${statusColors[c.status_laporan] || '#94a3b8'};">${statusLabels[c.status_laporan] || c.status_laporan}</span></td>
                <td><span style="color:#f59e0b;font-weight:600;font-size:0.85rem;">Sedang</span></td>
                <td style="font-size:0.85rem;color:#64748b;">${jadwalText}</td>
                <td><button class="btn-view" style="padding:5px 12px;background:#6366f1;color:white;border:none;border-radius:6px;font-size:0.8rem;cursor:pointer;" onclick="event.stopPropagation();openCaseModal('${c.id}', '${c.laporan_id}')"><i class="fas fa-eye"></i> Detail</button></td>
            </tr>
            `;
        }).join('');
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
});
