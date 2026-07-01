document.addEventListener('DOMContentLoaded', async function () {
    const activeList = document.getElementById('list-active');
    const completedList = document.getElementById('list-completed');
    const countActive = document.getElementById('count-active');
    const countCompleted = document.getElementById('count-completed');
    const rawStorage = document.getElementById('raw-data-storage');

    if (rawStorage) rawStorage.style.display = 'none';

    // Auth Check
    try {
        const authRes = await fetch('../../../api/auth/check.php');
        const authData = await authRes.json();
        if (authData.status !== 'authenticated') {
            window.location.href = '../auth/login.html';
            return;
        }
    } catch (e) {
        window.location.href = '../auth/login.html';
        return;
    }

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            if (tab === 'active') {
                activeList.style.display = '';
                completedList.style.display = 'none';
            } else {
                activeList.style.display = 'none';
                completedList.style.display = '';
            }
        });
    });

    // Fetch from real backend
    let activeCount = 0, completedCount = 0;
    try {
        const res = await fetch('../../../api/cases/get_cases.php?limit=100');
        const result = await res.json();
        if (result.status === 'success') {
            const cases = result.data.cases;
            
            cases.forEach(c => {
                const isCompleted = c.status_laporan === 'Completed' || c.status_laporan === 'Closed';
                if (isCompleted) completedCount++;
                else activeCount++;

                const statusClass = c.status_laporan === 'Completed' ? 'status-completed'
                    : c.status_laporan === 'Investigasi' ? 'status-investigation'
                    : 'status-process';

                let worryClass = 'sedikit';
                if (c.tingkat_kekhawatiran && c.tingkat_kekhawatiran.toLowerCase().includes('sangat')) worryClass = 'sangat';
                else if (c.tingkat_kekhawatiran && c.tingkat_kekhawatiran.toLowerCase().includes('khawatir')) worryClass = 'khawatir';
                
                const html = `
                    <a href="case-detail.html?id=${c.id}" class="case-item-link" data-status="${isCompleted ? 'completed' : 'active'}">
                        <div class="case-item">
                            <div class="case-content">
                                <div class="case-checkbox">
                                    <input class="form-check-input" type="checkbox" onclick="event.stopPropagation()">
                                </div>
                                <div class="case-id">#${c.kode_pelaporan}</div>
                                <div class="case-worry">
                                    <div class="khawatir-bar ${worryClass}"></div>
                                </div>
                                <div class="case-email">
                                    <i class="bi bi-envelope-fill"></i>
                                    <span>${c.email_korban}</span>
                                </div>
                                <div class="case-date">
                                    <i class="bi bi-calendar-event-fill"></i>
                                    <span>${c.formatted_date.split(' ')[0]}</span>
                                </div>
                                <div class="case-status">
                                    <span class="status-badge ${statusClass}">${c.status_laporan}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                `;

                if (isCompleted) completedList.insertAdjacentHTML('beforeend', html);
                else activeList.insertAdjacentHTML('beforeend', html);
            });

            countActive.textContent = activeCount;
            countCompleted.textContent = completedCount;

            if (activeCount === 0) activeList.innerHTML = '<div class="empty-state"><p>Tidak ada kasus aktif</p></div>';
            if (completedCount === 0) completedList.innerHTML = '<div class="empty-state"><p>Tidak ada riwayat selesai</p></div>';
        }
    } catch (e) {
        console.error('Failed to load cases', e);
    }

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await fetch('../../../api/auth/logout.php');
            window.location.href = '../auth/login.html';
        });
    }
});
