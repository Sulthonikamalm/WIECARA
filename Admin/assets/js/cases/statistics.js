document.addEventListener('DOMContentLoaded', async function () {
    // Auth check removed — demo front-end only

    try {
        const res = await fetch('../../../api/cases/get_statistics.php');
        const result = await res.json();
        if (result.status === 'success') {
            const stats = result.data;

            // Summary Cards
            setText('totalReports', stats.total_cases);
            setText('summaryProcess', stats.active_cases);
            setText('summaryInProgress', 0); // Placeholder
            setText('summaryCompleted', stats.resolved_cases);

            // Minimal Charts to avoid crashing
            setText('stat-process-count', stats.active_cases);
            setText('stat-completed-count', stats.resolved_cases);
        }
    } catch (e) {
        console.error('Failed to load stats', e);
    }

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try { await fetch('../../../api/auth/logout.php'); } catch(e) {}
            window.location.href = '../../../index.html';
        });
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
});
