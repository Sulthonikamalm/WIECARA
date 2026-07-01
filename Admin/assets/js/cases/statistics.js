document.addEventListener('DOMContentLoaded', async function () {
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
            await fetch('../../../api/auth/logout.php');
            window.location.href = '../auth/login.html';
        });
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
});
