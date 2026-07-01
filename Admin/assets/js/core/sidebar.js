/**
 * WIECARA PPKPT - Sidebar & Auth Global Logic (Final Version)
 * File: Admin/assets/js/sidebar.js
 */

const ADMIN_EMERGENCY_SCRIPT_URL = document.currentScript?.src || window.location.href;

document.addEventListener('DOMContentLoaded', function () {
    // ============================================
    // 1. LOGIKA TAMPILAN SIDEBAR (DARI KODE LAMA ANDA)
    // ============================================
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebarToggle');
    const mainContent = document.getElementById('mainContent');

    if (sidebar && toggleButton) {
        toggleButton.addEventListener('click', function (event) {
            event.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    // Tutup sidebar jika klik di luar (untuk mobile)
    if (mainContent) {
        mainContent.addEventListener('click', function () {
            if (window.innerWidth <= 991 && sidebar && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Reset sidebar saat layar dibesarkan
    window.addEventListener('resize', function () {
        if (window.innerWidth > 991 && sidebar) {
            sidebar.classList.remove('active');
        }
    });

    // ============================================
    // 1B. USER PROFILE DROPDOWN TOGGLE
    // ============================================
    const userProfileToggle = document.getElementById('userProfileToggle');
    const userDropdownMenu = document.getElementById('userDropdownMenu');

    if (userProfileToggle && userDropdownMenu) {
        userProfileToggle.addEventListener('click', function (event) {
            event.stopPropagation();
            userDropdownMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (event) {
            if (!userProfileToggle.contains(event.target) && !userDropdownMenu.contains(event.target)) {
                userDropdownMenu.classList.remove('show');
            }
        });
    }

    // ============================================
    // 2. LOGIKA KEAMANAN (BARU)
    // ============================================

    // LOGIC TOMBOL LOGOUT (MOCK DATA VERSION)
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', function (e) {
            e.preventDefault();
            handleLogout();
        });
    }

    initAdminEmergencyAlarm();
});

// Fungsi Logout - Mock Version
function handleLogout() {
    const confirmLogout = confirm("Apakah Anda yakin ingin keluar?");
    if (!confirmLogout) return;

    const btnLogout = document.getElementById('btnLogout');
    const originalText = btnLogout ? btnLogout.innerHTML : '';

    if (btnLogout) {
        btnLogout.disabled = true;
        btnLogout.innerHTML = '<i class="bi bi-hourglass-split me-2"></i><span>Keluar...</span>';
    }

    setTimeout(() => {
        window.location.href = '../../../index.html';
    }, 500);
}

function initAdminEmergencyAlarm() {
    const scriptUrl = ADMIN_EMERGENCY_SCRIPT_URL;
    const apiUrl = new URL('../../../../api/emergency/admin_watch_cases.php', scriptUrl).href;
    const audioUrl = new URL('../../audio/alert-sound-effect.mp3', scriptUrl).href;
    const POLL_INTERVAL_MS = 3000;

    injectAdminEmergencyStyles();

    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.preload = 'auto';

    const overlay = document.createElement('div');
    overlay.className = 'admin-emergency-overlay';
    overlay.innerHTML = `
        <div class="admin-emergency-panel">
            <div class="admin-emergency-pulse"></div>
            <div class="admin-emergency-content">
                <span>EMERGENCY AKTIF</span>
                <strong id="adminEmergencyTitle">DARURAT MASUK</strong>
                <p id="adminEmergencyText">Ada sinyal darurat baru. Buka dashboard responder atau cek active case sekarang.</p>
                <div class="admin-emergency-actions">
                    <a href="#" target="_blank" rel="noopener" id="adminEmergencyMapsLink" class="admin-primary-action">Buka Google Maps</a>
                    <button type="button" id="btnAdminAcceptEmergency" class="admin-primary-action">Saya segera ke lokasi</button>
                    <a href="../../../Emergency/dashboard.html" target="_blank" rel="noopener">Dashboard Pihak Berwajib</a>
                    <button type="button" id="btnEnableAdminAlarm">Aktifkan Suara</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const title = overlay.querySelector('#adminEmergencyTitle');
    const text = overlay.querySelector('#adminEmergencyText');
    const btnEnableAudio = overlay.querySelector('#btnEnableAdminAlarm');
    const mapsLink = overlay.querySelector('#adminEmergencyMapsLink');
    const btnAcceptEmergency = overlay.querySelector('#btnAdminAcceptEmergency');
    let currentCaseId = null;

    btnEnableAudio?.addEventListener('click', async () => {
        try {
            await audio.play();
            btnEnableAudio.classList.add('is-hidden');
        } catch (error) {
            btnEnableAudio.textContent = 'Klik lagi untuk suara';
        }
    });

    btnAcceptEmergency?.addEventListener('click', async () => {
        if (!currentCaseId) return;

        btnAcceptEmergency.disabled = true;
        btnAcceptEmergency.textContent = 'Memproses...';

        try {
            const acceptUrl = new URL('../../../../api/emergency/admin_accept_case.php', scriptUrl).href;
            const response = await fetch(acceptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    case_id: currentCaseId,
                    admin_label: 'Admin PPKPT'
                })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Gagal menghentikan alert admin');
            }
            await pollEmergencyCases();
        } catch (error) {
            window.alert(error.message);
        } finally {
            btnAcceptEmergency.disabled = false;
            btnAcceptEmergency.textContent = 'Saya segera ke lokasi';
        }
    });

    async function pollEmergencyCases() {
        try {
            const response = await fetch(apiUrl, {
                credentials: 'include',
                cache: 'no-store'
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') return;

            const cases = Array.isArray(result.data) ? result.data : [];
            const hasEmergency = cases.length > 0;
            document.body.classList.toggle('admin-has-emergency', hasEmergency);
            overlay.classList.toggle('is-active', hasEmergency);

            if (hasEmergency) {
                const latest = cases[0];
                currentCaseId = latest.id;
                title.textContent = `${cases.length} DARURAT AKTIF`;
                text.textContent = `${latest.kode_darurat || 'CASE DARURAT'} - ${latest.trigger_message || 'Sinyal darurat diterima.'}`;
                const hasLocation = latest.latitude !== null && latest.latitude !== undefined &&
                    latest.longitude !== null && latest.longitude !== undefined;
                if (hasLocation) {
                    mapsLink.href = `https://www.google.com/maps?q=${encodeURIComponent(latest.latitude)},${encodeURIComponent(latest.longitude)}`;
                    mapsLink.textContent = 'Buka Google Maps';
                    mapsLink.classList.remove('is-disabled');
                } else {
                    mapsLink.href = '#';
                    mapsLink.textContent = 'Lokasi GPS belum tersedia';
                    mapsLink.classList.add('is-disabled');
                }
                btnAcceptEmergency.classList.remove('is-hidden');
                audio.play().then(() => {
                    btnEnableAudio?.classList.add('is-hidden');
                }).catch(() => {
                    btnEnableAudio?.classList.remove('is-hidden');
                });
            } else {
                currentCaseId = null;
                audio.pause();
                audio.currentTime = 0;
                mapsLink.href = '#';
                mapsLink.classList.add('is-disabled');
                btnAcceptEmergency?.classList.add('is-hidden');
                btnEnableAudio?.classList.add('is-hidden');
            }
        } catch (error) {
            // Admin tetap dapat bekerja; polling berikutnya akan mencoba lagi.
        }
    }

    pollEmergencyCases();
    window.setInterval(pollEmergencyCases, POLL_INTERVAL_MS);
}

function injectAdminEmergencyStyles() {
    if (document.getElementById('adminEmergencyStyles')) return;

    const style = document.createElement('style');
    style.id = 'adminEmergencyStyles';
    style.textContent = `
        body.admin-has-emergency {
            animation: adminEmergencyBodyFlash 0.38s steps(2, start) infinite;
        }

        @keyframes adminEmergencyBodyFlash {
            0% { background-color: #610000; }
            100% { background-color: #ff0000; }
        }

        .admin-emergency-overlay {
            position: fixed;
            inset: 0;
            z-index: 2147483000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            pointer-events: none;
            background: rgba(127, 0, 0, 0.22);
        }

        .admin-emergency-overlay.is-active {
            display: flex;
            animation: adminEmergencyOverlayFlash 0.38s steps(2, start) infinite;
        }

        @keyframes adminEmergencyOverlayFlash {
            0% { background: rgba(90, 0, 0, 0.72); }
            100% { background: rgba(255, 0, 0, 0.72); }
        }

        .admin-emergency-panel {
            width: min(760px, 100%);
            display: flex;
            align-items: center;
            gap: 22px;
            padding: 28px;
            border: 5px solid #fff;
            border-radius: 14px;
            background: #a00000;
            color: #fff;
            pointer-events: auto;
            box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45), 0 0 0 10px rgba(255, 255, 255, 0.18);
        }

        .admin-emergency-pulse {
            width: 44px;
            height: 44px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: #fff;
            box-shadow: 0 0 0 14px rgba(255, 255, 255, 0.18), 0 0 38px rgba(255, 255, 255, 0.85);
            animation: adminEmergencyPulse 0.5s ease-in-out infinite;
        }

        @keyframes adminEmergencyPulse {
            0%, 100% { transform: scale(0.85); opacity: 0.55; }
            50% { transform: scale(1.15); opacity: 1; }
        }

        .admin-emergency-content span {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
        }

        .admin-emergency-content strong {
            display: block;
            font-size: clamp(34px, 7vw, 64px);
            line-height: 0.95;
            font-weight: 900;
        }

        .admin-emergency-content p {
            margin: 12px 0 18px;
            font-size: 16px;
            font-weight: 700;
            line-height: 1.45;
        }

        .admin-emergency-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .admin-emergency-actions a,
        .admin-emergency-actions button {
            min-height: 44px;
            border: none;
            border-radius: 8px;
            padding: 11px 14px;
            background: #fff;
            color: #9f0000;
            font: inherit;
            font-weight: 900;
            text-decoration: none;
            cursor: pointer;
        }

        .admin-emergency-actions .admin-primary-action {
            background: #117c6f;
            color: #fff;
        }

        .admin-emergency-actions .is-disabled {
            pointer-events: none;
            opacity: 0.65;
        }

        .admin-emergency-actions .is-hidden {
            display: none;
        }

        @media (max-width: 640px) {
            .admin-emergency-panel {
                align-items: flex-start;
                flex-direction: column;
                padding: 20px;
            }

            .admin-emergency-actions,
            .admin-emergency-actions a,
            .admin-emergency-actions button {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}
