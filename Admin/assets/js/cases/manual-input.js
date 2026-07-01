/**
 * Admin Manual Input — Mock Data Version (demo only)
 */
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('manualInputForm');
    const btnSubmit = document.getElementById('btnSubmit');

    // Upload area interaction
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const filePreviewList = document.getElementById('filePreviewList');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
        fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    }

    function handleFiles(files) {
        if (!filePreviewList) return;
        Array.from(files).forEach(f => {
            const div = document.createElement('div');
            div.className = 'file-preview-item';
            div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8f9fa;border-radius:6px;margin-top:8px;';
            div.innerHTML = `<i class="bi bi-file-earmark-image" style="color:#6366f1;"></i><span style="flex:1;">${f.name}</span><span style="color:#999;font-size:0.8rem;">${(f.size / 1024).toFixed(1)} KB</span><button type="button" onclick="this.parentElement.remove()" style="background:none;border:none;color:#ef4444;cursor:pointer;"><i class="bi bi-x-lg"></i></button>`;
            filePreviewList.appendChild(div);
        });
    }

    // Form submit (demo)
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const kode = 'PPKPT' + String(Math.floor(100 + Math.random() * 900));
            showToast(`Kasus berhasil disimpan dengan kode ${kode} (demo)`, 'success');
            setTimeout(() => { window.location.href = 'cases.html'; }, 2000);
        });
    }

    // Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', () => { window.location.href = '../../../index.html'; });

    function showToast(msg, type) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.style.cssText = 'padding:12px 20px;background:#117c6f;color:white;border-radius:8px;margin-bottom:8px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);position:fixed;bottom:20px;right:20px;z-index:9999;animation:fadeInUp 0.3s ease;';
        toast.innerHTML = `<i class="bi bi-check-circle" style="color:#22c55e;"></i> ${msg}`;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    }
});
