/**
 * WIECARA PPKPT — Legal Support Dashboard Logic (API-Connected)
 */
document.addEventListener('DOMContentLoaded', async () => {
    /* =============================================
       STATE & CONFIG
       ============================================= */
    let currentLegalCases = [];
    let currentOpenedCase = null;
    let isRedactedMode = false;

    /* =============================================
       DOM REFERENCES
       ============================================= */
    const DOM = {
        profileName: document.getElementById('profileName'),
        profileSpec: document.getElementById('profileSpecialization'),
        currentDate: document.getElementById('currentDate'),
        pageTitle: document.getElementById('pageTitle'),
        btnLogout: document.getElementById('logoutBtn'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        mobileToggle: document.getElementById('mobileToggle'),
        sidebar: document.getElementById('sidebar'),
        statTotal: document.getElementById('statTotal'),
        statAktif: document.getElementById('statAktif'),
        statSelesai: document.getElementById('statSelesai'),
        recentCasesBody: document.getElementById('recentCasesBody'),
        allCasesBody: document.getElementById('allCasesBody'),
        caseModal: document.getElementById('caseModal'),
        modalClose: document.getElementById('modalClose'),
        modalCode: document.getElementById('modalCode'),
        consentText: document.getElementById('consentText'),
        consentHash: document.getElementById('consentHash'),
        caseDetailGrid: document.getElementById('caseDetailGrid'),
        psikologNotesContainer: document.getElementById('psikologNotesContainer'),
        auditTrailList: document.getElementById('auditTrailList'),
        globalAuditList: document.getElementById('globalAuditList'),
        legalAnalysisForm: document.getElementById('legalAnalysisForm'),
        savedAnalysisContainer: document.getElementById('savedAnalysisContainer'),
        navLinks: document.querySelectorAll('.nav-link'),
        pages: document.querySelectorAll('.page-content'),
    };

    /* =============================================
       AUTH CHECK & DATA LOAD
       ============================================= */
    try {
        const casesRes = await fetch('../../api/legal/get_cases.php');
        const casesData = await casesRes.json();

        if (casesData.status !== 'success') {
            window.location.href = 'login.html';
            return;
        }

        currentLegalCases = casesData.data.cases;
    } catch (e) {
        console.error('Failed to load legal dashboard', e);
        window.location.href = 'login.html';
        return;
    }

    /* =============================================
       INITIALIZATION
       ============================================= */
    function init() {
        setProfile();
        setDate();
        updateStats();
        renderRecentCases();
        renderAllCases();
        renderGlobalAudit();
        bindEvents();
    }

    function setProfile() {
        const name = sessionStorage.getItem('legal_name') || 'Pendamping Hukum';
        if (DOM.profileName) DOM.profileName.textContent = name;
        if (DOM.profileSpec) DOM.profileSpec.textContent = 'Pendamping Hukum';
    }

    function setDate() {
        if (!DOM.currentDate) return;
        DOM.currentDate.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    /* =============================================
       STATS
       ============================================= */
    function updateStats() {
        const total = currentLegalCases.length;
        const active = currentLegalCases.filter(c => c.status_laporan !== 'Closed' && c.status_laporan !== 'Completed').length;
        const completed = total - active;

        if (DOM.statTotal) DOM.statTotal.textContent = total;
        if (DOM.statAktif) DOM.statAktif.textContent = active;
        if (DOM.statSelesai) DOM.statSelesai.textContent = completed;
    }

    /* =============================================
       TABLE RENDERING
       ============================================= */
    function renderRecentCases() {
        if (!DOM.recentCasesBody) return;
        if (currentLegalCases.length === 0) {
            DOM.recentCasesBody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-gavel"></i><p>Belum ada kasus yang dieskalasi ke pendamping hukum</p></td></tr>`;
            return;
        }

        DOM.recentCasesBody.innerHTML = currentLegalCases.slice(0, 5).map(c => {
            const risk = c.psikolog_risk || 'N/A';
            const legalStatus = c.has_legal_notes > 0 ? 'Sudah Dianalisis' : 'Menunggu Analisis';
            return `
                <tr>
                    <td><strong>${c.kode_pelaporan}</strong></td>
                    <td><span class="consent-badge verified"><i class="fas fa-shield-alt"></i> Eskalasi</span></td>
                    <td><span class="risk-tag risk-${(risk || '').toLowerCase()}">${risk}</span></td>
                    <td><span class="legal-status-tag">${legalStatus}</span></td>
                    <td>
                        <button class="btn-action btn-view" data-case-id="${c.id}">
                            <i class="fas fa-external-link-alt"></i> Buka Berkas
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    function renderAllCases() {
        if (!DOM.allCasesBody) return;
        if (currentLegalCases.length === 0) {
            DOM.allCasesBody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="fas fa-folder-open"></i><p>Belum ada kasus pendampingan</p></td></tr>`;
            return;
        }

        DOM.allCasesBody.innerHTML = currentLegalCases.map(c => {
            const legalStatus = c.has_legal_notes > 0 ? '✅ Sudah Dianalisis' : '⏳ Menunggu';
            return `
                <tr>
                    <td><strong>${c.kode_pelaporan}</strong></td>
                    <td>${legalStatus}</td>
                    <td><code class="hash-code">${generateHash()}</code></td>
                    <td>
                        <button class="btn-action btn-view" data-case-id="${c.id}">
                            <i class="fas fa-file-alt"></i> Lihat Full
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    function generateHash() {
        return '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6);
    }

    /* =============================================
       GLOBAL AUDIT TRAIL
       ============================================= */
    async function renderGlobalAudit() {
        if (!DOM.globalAuditList) return;
        // Fetch all status histories from all legal cases
        let allHistory = [];
        for (const c of currentLegalCases.slice(0, 10)) {
            try {
                const res = await fetch(`../../api/legal/get_case_detail.php?id=${c.id}`);
                const data = await res.json();
                if (data.status === 'success' && data.data.history) {
                    data.data.history.forEach(h => {
                        h._kode = c.kode_pelaporan;
                    });
                    allHistory = allHistory.concat(data.data.history);
                }
            } catch(e) {}
        }
        
        if (allHistory.length === 0) {
            DOM.globalAuditList.innerHTML = `<div class="empty-state" style="padding:40px 20px;"><i class="fas fa-link"></i><p>Belum ada audit trail</p></div>`;
            return;
        }
        
        allHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        DOM.globalAuditList.innerHTML = allHistory.slice(0, 20).map(h => `
            <div class="ledger-item">
                <div class="ledger-action">
                    <strong>[${h._kode || '-'}] ${h.status_lama} → ${h.status_baru}</strong>
                    <small>Oleh: ${h.diubah_oleh_role} — ${h.keterangan || ''}</small>
                </div>
                <div class="ledger-meta">
                    <span class="time">${new Date(h.created_at).toLocaleString('id-ID')}</span>
                    <span class="hash-text">${generateHash()}</span>
                </div>
            </div>
        `).join('');
    }

    /* =============================================
       MODAL — CASE DETAIL
       ============================================= */
    async function openCaseDetail(caseId) {
        try {
            const res = await fetch(`../../api/legal/get_case_detail.php?id=${caseId}`);
            const result = await res.json();
            if (result.status !== 'success') {
                alert('Gagal memuat detail kasus.');
                return;
            }

            currentOpenedCase = result.data;
            const c = currentOpenedCase;

            if (DOM.modalCode) DOM.modalCode.textContent = c.kode_pelaporan;
            if (DOM.consentText) DOM.consentText.textContent = 'Kasus ini telah dieskalasi ke jalur hukum oleh Admin.';
            if (DOM.consentHash) DOM.consentHash.textContent = generateHash();

            renderReportDetails(c);
            renderPsikologNotes(c);
            renderAuditTrail(c);
            renderLegalAnalysis(c, caseId);

            // Reset tabs
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="detail"]')?.classList.add('active');
            document.getElementById('tab-detail')?.classList.add('active');

            if (DOM.caseModal) DOM.caseModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } catch(err) {
            console.error(err);
            alert('Terjadi kesalahan saat membuka detail.');
        }
    }

    function closeModal() {
        if (DOM.caseModal) DOM.caseModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    window.openCaseDetail = openCaseDetail;

    /* =============================================
       RENDER FUNCTIONS
       ============================================= */
    function applyRedaction(text) {
        if (!isRedactedMode || !text || text === '-') return text || '-';
        return `<span class="redact-highlight" title="Sensor Privasi Aktif">██████████</span>`;
    }

    function renderReportDetails(c) {
        if (!DOM.caseDetailGrid) return;
        DOM.caseDetailGrid.innerHTML = `
            <div class="info-group">
                <span class="info-label"><i class="far fa-calendar-alt"></i> Tanggal Laporan</span>
                <span class="info-value">${c.created_at || '-'}</span>
            </div>
            <div class="info-group">
                <span class="info-label"><i class="fas fa-venus-mars"></i> Profil Penyintas</span>
                <span class="info-value">Usia ${c.usia_korban || '-'} / ${c.gender_korban || '-'}</span>
            </div>
            <div class="info-group">
                <span class="info-label"><i class="fas fa-phone-alt"></i> Kontak</span>
                <span class="info-value">${applyRedaction(c.email_korban)}</span>
            </div>
            <div class="info-group">
                <span class="info-label"><i class="fas fa-user-shield"></i> Terlapor / Pelaku</span>
                <span class="info-value">${applyRedaction(c.pelaku_kekerasan || '-')}</span>
            </div>
            <div class="info-group">
                <span class="info-label"><i class="fas fa-align-left"></i> Kronologi Kejadian</span>
                <div class="readonly-box">${isRedactedMode ? applyRedaction('masked') : (c.detail_kejadian || '-')}</div>
            </div>
            <div class="info-group">
                <span class="info-label"><i class="fas fa-map-marker-alt"></i> Lokasi Kejadian</span>
                <span class="info-value">${applyRedaction(c.lokasi_kejadian || '-')}</span>
            </div>`;
    }

    function renderPsikologNotes(c) {
        if (!DOM.psikologNotesContainer) return;
        if (c.catatan_psikolog && c.catatan_psikolog.length > 0) {
            DOM.psikologNotesContainer.innerHTML = c.catatan_psikolog.map(cp => `
                <div class="readonly-box" style="margin-bottom: 16px;">
                    <div style="margin-bottom: 12px;">
                        <span class="info-label"><i class="fas fa-user-md"></i> Psikolog: ${cp.psikolog_nama || '-'}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <span class="info-label"><i class="fas fa-clipboard-list"></i> Ringkasan</span>
                        <p style="margin:6px 0 0; font-weight:500;">${cp.ringkasan_kasus}</p>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <span class="info-label"><i class="fas fa-search"></i> Detail Konsultasi</span>
                        <p style="margin:6px 0 0; font-weight:500;">${cp.detail_konsultasi || '-'}</p>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <span class="info-label"><i class="fas fa-exclamation-triangle"></i> Tingkat Risiko</span>
                        <span class="risk-tag risk-${(cp.tingkat_risiko || '').toLowerCase()}" style="display:inline-block; margin-top:6px;">${cp.tingkat_risiko || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="info-label"><i class="fas fa-heartbeat"></i> Rekomendasi</span>
                        <p style="margin:6px 0 0; color:var(--legal-text-secondary, #64748b);">${cp.rekomendasi || '-'}</p>
                    </div>
                </div>`).join('');
        } else {
            DOM.psikologNotesContainer.innerHTML = `<div class="empty-state"><i class="fas fa-user-md"></i><p>Belum ada catatan psikolog untuk kasus ini.</p></div>`;
        }
    }

    function renderAuditTrail(c) {
        if (!DOM.auditTrailList) return;
        if (c.history && c.history.length > 0) {
            DOM.auditTrailList.innerHTML = c.history.map(h => `
                <div class="ledger-item">
                    <div class="ledger-action">
                        <strong>${h.status_lama || '-'} → ${h.status_baru}</strong>
                        <small>Oleh: ${h.diubah_oleh_role} — ${h.keterangan || ''}</small>
                    </div>
                    <div class="ledger-meta">
                        <span class="time">${new Date(h.created_at).toLocaleString('id-ID')}</span>
                        <span class="hash-text">${generateHash()}</span>
                    </div>
                </div>`).join('');
        } else {
            DOM.auditTrailList.innerHTML = `<div class="empty-state" style="padding:32px;"><i class="fas fa-link"></i><p>Belum ada audit trail.</p></div>`;
        }
    }

    function renderLegalAnalysis(c, caseId) {
        if (!DOM.legalAnalysisForm || !DOM.savedAnalysisContainer) return;

        if (c.catatan_hukum && c.catatan_hukum.length > 0) {
            DOM.legalAnalysisForm.style.display = 'none';
            DOM.savedAnalysisContainer.style.display = 'block';
            DOM.savedAnalysisContainer.innerHTML = c.catatan_hukum.map(ch => `
                <div style="background: #f0fdf4; border-left: 4px solid #2fc4b2; padding: 16px; border-radius: 6px; margin-bottom: 12px;">
                    <h4 style="margin: 0 0 8px;"><i class="fas fa-check-circle" style="color:#2fc4b2;"></i> Analisis oleh ${ch.legal_nama || 'Pendamping Hukum'}</h4>
                    <p><strong>Analisis:</strong> ${ch.analisis_hukum}</p>
                    <p><strong>Rekomendasi:</strong> ${ch.rekomendasi_hukum}</p>
                    ${ch.pasal_terkait ? `<p><strong>Pasal Terkait:</strong> ${ch.pasal_terkait}</p>` : ''}
                    <small style="color:#64748b;">${new Date(ch.created_at).toLocaleString('id-ID')}</small>
                </div>`).join('');
        } else {
            DOM.legalAnalysisForm.style.display = 'block';
            DOM.savedAnalysisContainer.style.display = 'none';

            // Clone form to clear old listeners
            const newForm = DOM.legalAnalysisForm.cloneNode(true);
            DOM.legalAnalysisForm.parentNode.replaceChild(newForm, DOM.legalAnalysisForm);
            DOM.legalAnalysisForm = newForm;

            newForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const btn = newForm.querySelector('button[type=submit]');
                btn.disabled = true;
                btn.textContent = 'Menyimpan...';

                const analisis = newForm.querySelector('#legalAnalysis').value;
                const rekomendasi = newForm.querySelector('#legalRecommendation').value;
                const pasal = newForm.querySelector('#pasalTerkait')?.value || '';

                try {
                    const res = await fetch('../../api/legal/save_analysis.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            laporan_id: caseId,
                            analisis_hukum: analisis,
                            rekomendasi_hukum: rekomendasi,
                            pasal: pasal
                        })
                    });
                    const result = await res.json();
                    if (result.status === 'success') {
                        alert('Analisis hukum berhasil disimpan!');
                        closeModal();
                        window.location.reload();
                    } else {
                        alert('Gagal: ' + result.message);
                        btn.disabled = false;
                        btn.textContent = 'Simpan Analisis';
                    }
                } catch(err) {
                    alert('Terjadi kesalahan.');
                    btn.disabled = false;
                    btn.textContent = 'Simpan Analisis';
                }
            });
        }
    }

    /* =============================================
       EVENT BINDING
       ============================================= */
    function bindEvents() {
        if (DOM.sidebarToggle && DOM.sidebar) {
            DOM.sidebarToggle.addEventListener('click', () => DOM.sidebar.classList.toggle('collapsed'));
        }
        if (DOM.mobileToggle && DOM.sidebar) {
            DOM.mobileToggle.addEventListener('click', () => DOM.sidebar.classList.toggle('mobile-open'));
        }

        DOM.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('data-page');
                DOM.navLinks.forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
                DOM.pages.forEach(p => p.classList.remove('active'));
                const page = document.getElementById('page-' + target);
                if (page) page.classList.add('active');
                if (DOM.pageTitle) DOM.pageTitle.textContent = e.currentTarget.querySelector('span').textContent;
            });
        });

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-view[data-case-id]');
            if (btn && !btn.disabled) openCaseDetail(btn.getAttribute('data-case-id'));
        });

        if (DOM.modalClose) DOM.modalClose.addEventListener('click', closeModal);
        if (DOM.caseModal) DOM.caseModal.addEventListener('click', (e) => { if (e.target === DOM.caseModal) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && DOM.caseModal?.style.display === 'flex') closeModal(); });

        document.addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.tab-btn');
            if (!tabBtn) return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById('tab-' + tabBtn.getAttribute('data-tab'))?.classList.add('active');
        });

        if (DOM.btnLogout) {
            DOM.btnLogout.addEventListener('click', async () => {
                await fetch('../../api/legal/logout.php');
                window.location.href = 'login.html';
            });
        }

        const redactToggle = document.getElementById('redactToggle');
        if (redactToggle) {
            redactToggle.addEventListener('change', (e) => {
                isRedactedMode = e.target.checked;
                if (currentOpenedCase) renderReportDetails(currentOpenedCase);
            });
        }

        const btnCetakBAP = document.getElementById('btnCetakBAP');
        if (btnCetakBAP) {
            btnCetakBAP.addEventListener('click', () => {
                if (!currentOpenedCase) return;
                
                const c = currentOpenedCase;
                const printArea = document.getElementById('printArea');
                
                const bapHTML = `
                    <div style="font-family: 'Times New Roman', Times, serif; color: black; max-width: 800px; margin: 0 auto; line-height: 1.5; padding: 20px;">
                        <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px;">
                            <h2 style="margin: 0; text-transform: uppercase;">BERITA ACARA PEMERIKSAAN (BAP) INTERNAL</h2>
                            <h3 style="margin: 5px 0 0;">SATGAS PPKPT - PENDAMPING HUKUM</h3>
                        </div>
                        
                        <p style="text-align: right;">Kode Laporan: <strong>${c.kode_pelaporan}</strong></p>
                        
                        <p>Pada hari ini, <strong>${new Date().toLocaleDateString('id-ID', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</strong>, telah dilakukan pemeriksaan dan penelaahan hukum terhadap laporan kasus kekerasan/pelanggaran dengan detail sebagai berikut:</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <tr><td style="width: 30%; padding: 5px 0;"><strong>Email Penyintas</strong></td><td>: ${c.email_korban}</td></tr>
                            <tr><td style="padding: 5px 0;"><strong>Usia / Gender</strong></td><td>: ${c.usia_korban || '-'} Tahun / ${c.gender_korban || '-'}</td></tr>
                            <tr><td style="padding: 5px 0;"><strong>Terlapor</strong></td><td>: ${c.pelaku_kekerasan || '-'}</td></tr>
                            <tr><td style="padding: 5px 0;"><strong>Lokasi Kejadian</strong></td><td>: ${c.lokasi_kejadian || '-'}</td></tr>
                            <tr><td style="padding: 5px 0;"><strong>Waktu Kejadian</strong></td><td>: ${c.waktu_kejadian || '-'}</td></tr>
                        </table>
                        
                        <h4 style="margin: 15px 0 5px; border-bottom: 1px solid #ccc;">KRONOLOGI SINGKAT</h4>
                        <p style="text-align: justify; margin-top: 0;">${c.detail_kejadian || '-'}</p>
                        
                        <h4 style="margin: 15px 0 5px; border-bottom: 1px solid #ccc;">ANALISIS & REKOMENDASI HUKUM</h4>
                        <p style="margin-top: 0;">
                            Data di atas telah diverifikasi oleh tim Pendamping Hukum dan akan diproses sesuai dengan peraturan perundang-undangan yang berlaku. Dokumen ini dicetak dari sistem WIECARA secara otomatis.
                        </p>
                        
                        <div style="margin-top: 50px; text-align: right;">
                            <p>Dicetak Oleh,</p>
                            <br><br><br>
                            <p><strong>${sessionStorage.getItem('legal_name') || 'Pendamping Hukum'}</strong><br>Satgas Hukum PPKPT</p>
                        </div>
                    </div>
                `;
                
                printArea.innerHTML = bapHTML;
                window.print();
            });
        }
    }

    /* =============================================
       EXECUTE
       ============================================= */
    init();
});
