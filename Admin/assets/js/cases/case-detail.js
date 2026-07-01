document.addEventListener('DOMContentLoaded', async function () {
    // Auth check removed — demo front-end only

    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get('id');

    if (!caseId) {
        alert("ID Kasus tidak ditemukan.");
        window.location.href = 'cases.html';
        return;
    }

    try {
        const res = await fetch('../../../api/cases/get_case_detail.php?id=' + caseId);
        const result = await res.json();
        
        if (result.status === 'success') {
            const caseData = result.data;
            
            // Hide loading state, show content
            const loadingState = document.getElementById('loadingState');
            const caseContent = document.getElementById('caseContent');
            if (loadingState) loadingState.style.display = 'none';
            if (caseContent) caseContent.style.display = 'block';

            // Populate UI Elements
            setText('caseCode', caseData.kode_pelaporan);
            setText('caseDate', 'Dilaporkan: ' + caseData.created_at);
            setText('korbanSebagai', caseData.korban_sebagai || 'Korban');
            setText('emailKorban', caseData.email_korban);
            setText('whatsappKorban', caseData.whatsapp_korban || '-');
            setText('genderKorban', caseData.gender_korban || '-');
            setText('usiaKorban', caseData.usia_korban || '-');
            
            setText('waktuKejadian', caseData.waktu_kejadian || '-');
            setText('lokasiKejadian', caseData.lokasi_kejadian || '-');
            setText('detailKejadian', caseData.detail_kejadian || '-');
            
            // Set status
            const statusBadge = document.getElementById('statusBadge');
            if (statusBadge) {
                statusBadge.querySelector('span').textContent = caseData.status_laporan;
                statusBadge.className = 'status-badge-large ' + (caseData.status_laporan === 'Completed' ? 'completed' : 'process');
            }

            // Render Schedule Info
            if (caseData.jadwal && caseData.jadwal.length > 0) {
                const j = caseData.jadwal[0]; // Most recent schedule
                const scheduleSection = document.getElementById('scheduleInfoSection');
                if (scheduleSection) {
                    scheduleSection.style.display = 'block';
                    setText('schedulePsikolog', j.psikolog_nama || '-');
                    setText('scheduleTimeAuth', j.waktu_mulai + ' s/d ' + j.waktu_selesai);
                    setText('scheduleType', j.tipe === 'online' ? 'Online (Video Call)' : 'Tatap Muka (Offline)');
                    setText('scheduleLocation', j.tempat_atau_link || '-');
                }
            }

            // Always show Consultation Status Section
            const consultationStatusSection = document.getElementById('consultationStatusSection');
            if (consultationStatusSection) {
                consultationStatusSection.style.display = 'block';
            }

            // Render Status History
            const historyContainer = document.getElementById('feedbackHistoryList');
            if (historyContainer) {
                let html = '';
                
                // Status History Log
                if (caseData.history && caseData.history.length > 0) {
                    html += '<h6 style="margin:0 0 10px;color:#475569;font-weight:600;"><i class="bi bi-clock-history me-1"></i>Riwayat Status</h6>';
                    html += caseData.history.map(h => {
                        const dt = new Date(h.created_at).toLocaleString('id-ID');
                        const roleColors = { admin: '#f59e0b', psikolog: '#06b6d4', legal: '#dc2626' };
                        const color = roleColors[h.diubah_oleh_role] || '#64748b';
                        return `
                        <div style="background:#f8fafc; border-left:4px solid ${color}; padding:10px 12px; margin-bottom:8px; border-radius:4px;">
                            <div style="font-size:0.8rem;color:#94a3b8;margin-bottom:2px;">${dt} — <span style="color:${color};font-weight:600;">${h.diubah_oleh_role.toUpperCase()}</span></div>
                            <div style="font-size:0.9rem;color:#1e293b;">${h.status_lama || '-'} → <strong>${h.status_baru}</strong></div>
                            <div style="font-size:0.85rem;color:#64748b;">${h.keterangan || ''}</div>
                        </div>`;
                    }).join('');
                }
                
                // Psikolog Notes
                if (caseData.catatan_psikolog && caseData.catatan_psikolog.length > 0) {
                    html += '<h6 style="margin:20px 0 10px;color:#06b6d4;font-weight:600;"><i class="bi bi-person-lines-fill me-1"></i>Catatan Psikolog</h6>';
                    html += caseData.catatan_psikolog.map(cp => {
                        const dt = new Date(cp.created_at).toLocaleString('id-ID');
                        return `
                        <div style="background:#ecfeff; border-left:4px solid #06b6d4; padding:12px; margin-bottom:8px; border-radius:4px;">
                            <div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px;">${dt} — <strong style="color:#06b6d4;">${cp.psikolog_nama || 'Psikolog'}</strong></div>
                            <div style="font-size:0.9rem;color:#1e293b;margin-bottom:4px;"><strong>Ringkasan:</strong> ${cp.ringkasan_kasus}</div>
                            <div style="font-size:0.9rem;color:#1e293b;margin-bottom:4px;"><strong>Detail:</strong> ${cp.detail_konsultasi}</div>
                            <div style="font-size:0.9rem;color:#1e293b;margin-bottom:4px;"><strong>Rekomendasi:</strong> ${cp.rekomendasi || '-'}</div>
                            <div style="font-size:0.85rem;color:#64748b;"><strong>Risiko:</strong> ${cp.tingkat_risiko}</div>
                        </div>`;
                    }).join('');
                }

                // Legal Notes
                if (caseData.catatan_hukum && caseData.catatan_hukum.length > 0) {
                    html += '<h6 style="margin:20px 0 10px;color:#dc2626;font-weight:600;"><i class="bi bi-briefcase me-1"></i>Catatan Pendamping Hukum</h6>';
                    html += caseData.catatan_hukum.map(ch => {
                        const dt = new Date(ch.created_at).toLocaleString('id-ID');
                        return `
                        <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px; margin-bottom:8px; border-radius:4px;">
                            <div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px;">${dt} — <strong style="color:#dc2626;">${ch.legal_nama || 'Pendamping Hukum'}</strong></div>
                            <div style="font-size:0.9rem;color:#1e293b;margin-bottom:4px;"><strong>Analisis:</strong> ${ch.analisis_hukum}</div>
                            <div style="font-size:0.9rem;color:#1e293b;margin-bottom:4px;"><strong>Rekomendasi:</strong> ${ch.rekomendasi_hukum}</div>
                            ${ch.pasal_terkait ? `<div style="font-size:0.85rem;color:#64748b;"><strong>Pasal:</strong> ${ch.pasal_terkait}</div>` : ''}
                        </div>`;
                    }).join('');
                }
                
                // User Feedback
                if (caseData.feedback && caseData.feedback.length > 0) {
                    html += '<h6 style="margin:20px 0 10px;color:#2fc4b2;font-weight:600;"><i class="bi bi-chat-dots me-1"></i>Pesan dari Pelapor</h6>';
                    html += caseData.feedback.map(f => {
                        const dt = new Date(f.created_at).toLocaleString('id-ID');
                        return `
                        <div style="background:#f0fdf4; border-left:4px solid #2fc4b2; padding:12px; margin-bottom:8px; border-radius:4px;">
                            <div style="font-size:0.8rem;color:#64748b;margin-bottom:4px;">${dt}</div>
                            <div style="font-size:0.95rem;color:#1e293b;">${f.komentar_user}</div>
                        </div>`;
                    }).join('');
                }
                
                // Update Consultation Badges if there are notes
                if (caseData.catatan_psikolog && caseData.catatan_psikolog.length > 0) {
                    const latestNote = caseData.catatan_psikolog[0];
                    setText('consultationStatusBadge', latestNote.status_catatan === 'final' ? 'Selesai (Final)' : latestNote.status_catatan);
                    
                    const riskBadge = document.getElementById('consultationRiskBadge');
                    if (riskBadge) {
                        riskBadge.textContent = latestNote.tingkat_risiko || '-';
                        riskBadge.className = 'fw-bold fs-5 text-capitalize';
                        if (latestNote.tingkat_risiko === 'kritis' || latestNote.tingkat_risiko === 'tinggi') {
                            riskBadge.classList.add('text-danger');
                        } else if (latestNote.tingkat_risiko === 'sedang') {
                            riskBadge.classList.add('text-warning');
                        } else {
                            riskBadge.classList.add('text-success');
                        }
                    }
                }
                
                if (!html) {
                    html = '<p class="text-muted fst-italic">Belum ada aktivitas pada kasus ini.</p>';
                }
                
                historyContainer.innerHTML = html;
            }


            // Eskalasi Hukum Button
            const btnEskalasi = document.getElementById('btnEskalasi');
            if (btnEskalasi) {
                btnEskalasi.addEventListener('click', async () => {
                    if (confirm('Eskalasi kasus ini ke Pendamping Hukum?')) {
                        try {
                            const res = await fetch('../../../api/cases/update_case.php', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({id: caseId, status_laporan: 'Eskalasi Hukum'})
                            });
                            const result = await res.json();
                            if (result.status === 'success') {
                                alert('Kasus berhasil dieskalasi ke Pendamping Hukum!');
                                window.location.reload();
                            } else {
                                alert('Gagal: ' + result.message);
                            }
                        } catch(err) {
                            alert('Terjadi kesalahan.');
                        }
                    }
                });
            }

            // Complete Case Button (Admin)
            const btnCompleteCase = document.getElementById('btnCompleteCase');
            if (btnCompleteCase) {
                btnCompleteCase.addEventListener('click', async () => {
                    if (confirm('Apakah Anda yakin ingin menyelesaikan dan menutup laporan ini?')) {
                        try {
                            const res = await fetch('../../../api/cases/update_case.php', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({id: caseId, status_laporan: 'Completed'})
                            });
                            const result = await res.json();
                            if (result.status === 'success') {
                                alert('Laporan berhasil diselesaikan oleh Admin!');
                                window.location.reload();
                            } else {
                                alert('Gagal: ' + result.message);
                            }
                        } catch(err) {
                            alert('Terjadi kesalahan.');
                        }
                    }
                });
            }

            // Delete Button
            const btnDelete = document.getElementById('btnDeleteCase');
            if (btnDelete) {
                btnDelete.addEventListener('click', async () => {
                    if (confirm('Yakin ingin menghapus kasus ini? Tindakan ini tidak dapat dibatalkan!')) {
                        try {
                            const res = await fetch('../../../api/cases/delete_case.php', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({id: caseId})
                            });
                            const result = await res.json();
                            if (result.status === 'success') {
                                alert('Kasus berhasil dihapus.');
                                window.location.href = 'cases.html';
                            }
                        } catch(err) {
                            alert('Gagal menghapus kasus.');
                        }
                    }
                });
            }

            // Jadwalkan Button & Modal
            const btnSchedule = document.getElementById('btnSchedule');
            const scheduleModal = document.getElementById('scheduleModal');
            const btnCloseSchedule = document.getElementById('btnCloseSchedule');
            const scheduleForm = document.getElementById('scheduleForm');
            const psikologSelect = document.getElementById('psikologSelect');

            if (btnSchedule && scheduleModal) {
                btnSchedule.addEventListener('click', async () => {
                    scheduleModal.style.display = 'flex';
                    try {
                        const res = await fetch('../../../api/admin/get_psikologs.php');
                        const result = await res.json();
                        if(result.status === 'success') {
                            psikologSelect.innerHTML = '<option value="" selected disabled>Pilih Psikolog...</option>' + 
                                result.data.map(p => `<option value="${p.id}">${p.nama_lengkap} - ${p.spesialisasi || 'Umum'}</option>`).join('');
                        }
                    } catch(err) {
                        psikologSelect.innerHTML = '<option value="" disabled>Gagal memuat psikolog</option>';
                    }
                });

                btnCloseSchedule.addEventListener('click', () => {
                    scheduleModal.style.display = 'none';
                });

                scheduleForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btnSubmit = document.getElementById('btnSubmitSchedule');
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = 'Menyimpan...';

                    const psikolog_id = document.getElementById('psikologSelect').value;
                    const tanggal = document.getElementById('scheduleDate').value;
                    const waktu = document.getElementById('scheduleTime').value;
                    const durasi = document.getElementById('scheduleDuration').value;
                    const tipe = document.querySelector('input[name="meetingType"]:checked').value;
                    const lokasi = document.getElementById('meetingLocation').value;
                    
                    const waktu_mulai = `${tanggal} ${waktu}:00`;
                    const startDate = new Date(tanggal + 'T' + waktu + ':00');
                    startDate.setMinutes(startDate.getMinutes() + parseInt(durasi));
                    const pad = n => n.toString().padStart(2, '0');
                    const waktu_selesai = `${startDate.getFullYear()}-${pad(startDate.getMonth()+1)}-${pad(startDate.getDate())} ${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:00`;

                    try {
                        const res = await fetch('../../../api/cases/schedule_case.php', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                laporan_id: caseId,
                                psikolog_id: psikolog_id,
                                waktu_mulai: waktu_mulai,
                                waktu_selesai: waktu_selesai,
                                tipe_pertemuan: tipe,
                                lokasi_link: lokasi
                            })
                        });
                        const result = await res.json();
                        if(result.status === 'success') {
                            alert('Jadwal berhasil dibuat!');
                            window.location.reload();
                        } else {
                            alert('Gagal: ' + result.message);
                            btnSubmit.disabled = false;
                            btnSubmit.textContent = 'Simpan Jadwal';
                        }
                    } catch(err) {
                        alert('Terjadi kesalahan.');
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Simpan Jadwal';
                    }
                });
            }
        } else {
            const loadingState = document.getElementById('loadingState');
            const errorState = document.getElementById('errorState');
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'block';
        }
    } catch (e) {
        console.error('Failed to load case detail', e);
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'block';
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
});
