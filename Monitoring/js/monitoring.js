document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('reportIdInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchLoader = document.getElementById('searchLoader');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const timelineContainer = document.getElementById('timelineContainer');
    const timelineHeader = document.getElementById('timelineHeader');
    const timeline = document.getElementById('timeline');

    // Search Events
    if (searchBtn) {
        searchBtn.addEventListener('click', doSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const kodeParam = urlParams.get('kode');
    if (kodeParam) {
        if (searchInput) searchInput.value = kodeParam;
        doSearch();
    }

    async function doSearch() {
        const query = searchInput ? searchInput.value.trim() : '';
        if (!query) {
            showError('Silakan masukkan kode laporan atau email.');
            return;
        }

        hideError();
        if (searchLoader) searchLoader.style.display = 'flex';

        try {
            const res = await fetch(`../api/monitoring/check_progress.php?kode=${encodeURIComponent(query)}`);
            const data = await res.json();
            
            if (searchLoader) searchLoader.style.display = 'none';

            if (data.status !== 'success' || !data.data) {
                showError('Kode Laporan atau Email "' + query + '" tidak ditemukan dalam sistem.');
                return;
            }

            renderTimeline(data.data);
        } catch (e) {
            if (searchLoader) searchLoader.style.display = 'none';
            showError('Terjadi kesalahan saat memproses permintaan.');
        }
    }

    function showError(msg) {
        if (errorMessage) errorMessage.style.display = 'flex';
        if (errorText) errorText.textContent = msg;
        if (timelineHeader) timelineHeader.style.display = 'none';
        if (timelineContainer) timelineContainer.style.display = 'none';
    }

    function hideError() {
        if (errorMessage) errorMessage.style.display = 'none';
    }

    function renderTimeline(c) {
        if (timelineContainer) timelineContainer.style.display = 'block';
        if (timelineHeader) {
            timelineHeader.style.display = '';
            document.getElementById('timelineTitle').textContent = 'Progress Laporan #' + c.laporan.id;
            document.getElementById('timelineId').textContent = c.laporan.kode_pelaporan;
            document.getElementById('timelineDate').textContent = c.laporan.created_at;

            const statusBadge = document.getElementById('statusBadge');
            const statusText = document.getElementById('statusText');
            if (statusBadge && statusText) {
                statusText.textContent = c.laporan.status_laporan;
                const statusClasses = { Completed: 'status-completed', Process: 'status-process', Investigasi: 'status-investigation', 'Eskalasi Hukum': 'status-investigation' };
                statusBadge.className = 'timeline-status-badge ' + (statusClasses[c.laporan.status_laporan] || '');
            }

            const closeCaseBtn = document.getElementById('closeCaseBtn');
            if (closeCaseBtn) {
                if (['Closed', 'Completed'].includes(c.laporan.status_laporan)) {
                    closeCaseBtn.style.display = 'none';
                } else {
                    closeCaseBtn.style.display = 'flex';
                    closeCaseBtn.onclick = async () => {
                        if (confirm('Apakah Anda yakin masalah ini telah diselesaikan? Tindakan ini akan menutup kasus Anda.')) {
                            try {
                                closeCaseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
                                closeCaseBtn.disabled = true;
                                const res = await fetch('../api/monitoring/close_case.php', {
                                    method: 'POST',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({ kode_pelaporan: c.laporan.kode_pelaporan })
                                });
                                const result = await res.json();
                                if (result.status === 'success') {
                                    alert('Terima kasih. Laporan telah berhasil diselesaikan.');
                                    document.getElementById('searchBtn').click(); // reload
                                } else {
                                    alert('Gagal menutup laporan: ' + result.message);
                                    closeCaseBtn.innerHTML = '<i class="fas fa-check-circle"></i> Selesaikan Laporan';
                                    closeCaseBtn.disabled = false;
                                }
                            } catch (e) {
                                alert('Terjadi kesalahan koneksi.');
                                closeCaseBtn.innerHTML = '<i class="fas fa-check-circle"></i> Selesaikan Laporan';
                                closeCaseBtn.disabled = false;
                            }
                        }
                    };
                }
            }
        }

        if (timeline) {
            timeline.innerHTML = c.timeline.map((step, i) => {
                const iconMap = { 
                    'created': 'fas fa-file-signature', 
                    'status_update': 'fas fa-sync-alt', 
                    'schedule': 'fas fa-calendar-check',
                    'consultation_note': 'fas fa-user-md',
                    'legal_note': 'fas fa-gavel',
                    'feedback': 'fas fa-comment-dots',
                    'psikolog_response': 'fas fa-reply'
                };
                const colorMap = { 
                    'created': '#3b82f6', 
                    'status_update': '#f59e0b', 
                    'schedule': '#8b5cf6',
                    'consultation_note': '#06b6d4',
                    'legal_note': '#dc2626',
                    'feedback': '#10b981',
                    'psikolog_response': '#6366f1'
                };
                
                const icon = iconMap[step.type] || 'fas fa-info-circle';
                const color = colorMap[step.type] || '#64748b';
                
                let detailsHtml = '';
                if (step.type === 'schedule' && step.details) {
                    detailsHtml = `
                    <div style="margin-top: 10px; background: #f8fafc; border-left: 3px solid ${color}; padding: 12px; border-radius: 6px;">
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>👨‍⚕️ Psikolog:</strong> ${step.details.psikolog} (${step.details.spesialisasi || 'Umum'})</div>
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>📅 Waktu:</strong> ${step.details.waktu_mulai} s/d ${step.details.waktu_selesai || '-'} WIB</div>
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>💻 Tipe:</strong> ${step.details.tipe}</div>
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>📍 Lokasi/Link:</strong> ${step.details.lokasi}</div>
                        <div style="font-size: 0.85rem; color: #475569;"><strong>📋 Status:</strong> ${step.details.status_jadwal}</div>
                        ${step.details.catatan_admin ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 4px;"><strong>📝 Catatan:</strong> ${step.details.catatan_admin}</div>` : ''}
                    </div>`;
                }
                if (step.type === 'consultation_note' && step.details) {
                    detailsHtml = `
                    <div style="margin-top: 10px; background: #ecfeff; border-left: 3px solid ${color}; padding: 12px; border-radius: 6px;">
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>📋 Ringkasan:</strong> ${step.details.ringkasan}</div>
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>🔍 Detail:</strong> ${step.details.detail_konsultasi}</div>
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>💡 Rekomendasi:</strong> ${step.details.rekomendasi}</div>
                        <div style="font-size: 0.85rem; color: #475569;"><strong>⚠️ Tingkat Risiko:</strong> ${step.details.tingkat_risiko}</div>
                    </div>`;
                }
                if (step.type === 'legal_note' && step.details) {
                    detailsHtml = `
                    <div style="margin-top: 10px; background: #fef2f2; border-left: 3px solid ${color}; padding: 12px; border-radius: 6px;">
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>⚖️ Analisis Hukum:</strong> ${step.details.analisis}</div>
                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 4px;"><strong>📜 Rekomendasi:</strong> ${step.details.rekomendasi}</div>
                        <div style="font-size: 0.85rem; color: #475569;"><strong>📄 Pasal Terkait:</strong> ${step.details.pasal_terkait}</div>
                    </div>`;
                }

                const dt = new Date(step.timestamp);
                const timeStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });

                return `
                <div class="timeline-item ${step.status}" style="display:flex;gap:20px;margin-bottom:30px;position:relative;">
                    <div class="timeline-icon" style="flex-shrink:0;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color}22;position:relative;z-index:2;">
                        <i class="${icon}" style="color:${color};font-size:1.1rem;"></i>
                    </div>
                    ${i < c.timeline.length - 1 ? `<div style="position:absolute;left:19px;top:40px;bottom:-30px;width:2px;background:#e5e7eb;z-index:1;"></div>` : ''}
                    <div style="flex:1;padding-bottom:10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <h4 style="font-size:1rem;font-weight:600;color:#1e293b;margin:0;">${step.title}</h4>
                            <span style="font-size:0.75rem;color:#94a3b8;">${timeStr}</span>
                        </div>
                        <p style="font-size:0.9rem;color:#64748b;margin:0;line-height:1.5;">${step.desc}</p>
                        ${detailsHtml}
                    </div>
                </div>
                `;
            }).join('');
            
            // Append Feedback Form
            timeline.innerHTML += `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1;">
                <h4 style="font-size:1.1rem;font-weight:600;color:#1e293b;margin-bottom:10px;"><i class="fas fa-comment-medical me-2" style="color:#10b981;"></i> Berikan Umpan Balik / Pesan Tambahan</h4>
                <p style="font-size:0.85rem;color:#64748b;margin-bottom:15px;">Kirim pesan langsung kepada Psikolog atau Satgas yang menangani kasus Anda.</p>
                <form id="feedbackForm">
                    <textarea id="feedbackText" rows="3" style="width:100%; border:1px solid #cbd5e1; border-radius:8px; padding:10px; font-size:0.9rem; margin-bottom:10px;" placeholder="Ketik pesan atau tambahan informasi di sini..." required></textarea>
                    <button type="submit" style="background:#10b981; color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">Kirim Pesan</button>
                </form>
            </div>
            `;
            
            // Attach feedback submit event
            setTimeout(() => {
                const feedbackForm = document.getElementById('feedbackForm');
                if (feedbackForm) {
                    feedbackForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const btn = feedbackForm.querySelector('button');
                        btn.disabled = true;
                        btn.textContent = 'Mengirim...';
                        
                        try {
                            const res = await fetch('../api/monitoring/submit_feedback.php', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    kode_pelaporan: c.laporan.kode_pelaporan,
                                    pesan: document.getElementById('feedbackText').value
                                })
                            });
                            const result = await res.json();
                            if(result.status === 'success') {
                                alert('Pesan berhasil terkirim!');
                                document.getElementById('searchBtn').click(); // Reload timeline
                            } else {
                                alert('Gagal mengirim pesan.');
                                btn.disabled = false;
                                btn.textContent = 'Kirim Pesan';
                            }
                        } catch(err) {
                            alert('Terjadi kesalahan.');
                            btn.disabled = false;
                            btn.textContent = 'Kirim Pesan';
                        }
                    });
                }
            }, 100);

            // Append Activity Log at the very bottom
            if (c.activity_log && c.activity_log.length > 0) {
                timeline.innerHTML += `
                <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
                    <h4 style="font-size:1.1rem;font-weight:700;color:#1e293b;margin-bottom:15px;">
                        <i class="fas fa-history" style="color:#6366f1;margin-right:8px;"></i>Riwayat Aktivitas
                    </h4>
                    <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:12px;">Log lengkap seluruh perubahan yang dilakukan oleh Admin, Psikolog, dan Pendamping Hukum pada laporan Anda.</p>
                    <div style="background:#f8fafc; border-radius:8px; padding:12px;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                            <thead>
                                <tr style="border-bottom:2px solid #e2e8f0;">
                                    <th style="text-align:left;padding:8px 6px;color:#64748b;font-weight:600;">Aktivitas</th>
                                    <th style="text-align:left;padding:8px 6px;color:#64748b;font-weight:600;">Oleh</th>
                                    <th style="text-align:right;padding:8px 6px;color:#64748b;font-weight:600;">Waktu</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${c.activity_log.map(log => {
                                    const logDt = new Date(log.timestamp);
                                    const logTime = logDt.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
                                    const actorColors = { 'Sistem': '#3b82f6', 'Admin': '#f59e0b', 'Psikolog': '#06b6d4', 'Pendamping Hukum': '#dc2626', 'Pelapor': '#10b981' };
                                    const actorColor = actorColors[log.actor] || '#64748b';
                                    return `
                                    <tr style="border-bottom:1px solid #e5e7eb;">
                                        <td style="padding:8px 6px;color:#1e293b;">${log.action}</td>
                                        <td style="padding:8px 6px;"><span style="background:${actorColor}15;color:${actorColor};padding:2px 8px;border-radius:12px;font-weight:600;font-size:0.75rem;">${log.actor}</span></td>
                                        <td style="padding:8px 6px;text-align:right;color:#94a3b8;font-size:0.8rem;">${logTime}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            }
        }

        if (timelineContainer) {
            timelineContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Reveal animations
    const reveals = document.querySelectorAll('[data-reveal]');
    reveals.forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
});