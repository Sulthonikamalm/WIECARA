// Konfigurasi
const CONFIG = {
    ARTICLE_LIMIT: 6,
    DEFAULT_IMAGE: 'https://via.placeholder.com/400x250/e07b8a/ffffff?text=Image+Not+Found'
};

// Format tanggal ke bahasa Indonesia
function formatDate(dateStr) {
    if (!dateStr) return '';
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    try {
        return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch (e) {
        return dateStr;
    }
}

// Render empty state
function renderEmptyState() {
    const container = document.getElementById('blog-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state text-center" style="width: 100%; padding: 3rem;">
            <i class="fas fa-newspaper fa-3x text-muted mb-3"></i>
            <h3 class="h4">Belum Ada Kabar Wiecara</h3>
            <p class="text-muted">Saat ini belum ada artikel yang dipublikasikan. Silakan cek kembali nanti.</p>
        </div>
    `;
}

// Render artikel ke DOM
function renderArticles(blogs) {
    const container = document.getElementById('blog-grid');
    if (!container) return;

    if (!Array.isArray(blogs) || blogs.length === 0) {
        renderEmptyState();
        return;
    }

    // Add carousel wrapper if it doesn't have one
    container.classList.add('carousel-container');

    container.innerHTML = blogs.map((blog, index) => {
        const title = blog.title || blog.judul || 'Tanpa Judul';
        const category = blog.kategori || 'Berita';
        let imageUrl = blog.image || blog.gambar_header_url || CONFIG.DEFAULT_IMAGE;
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('../')) {
             if (imageUrl.startsWith('/')) {
                imageUrl = '..' + imageUrl;
            } else {
                imageUrl = '../' + imageUrl;
            }
        }
        const date = formatDate(blog.date || blog.created_at);
        const excerpt = blog.summary || blog.excerpt || '';
        
        const delay = (index + 1) * 100;

        // NON-CLICKABLE CARD (Hanya untuk Tampilan Saja)
        // Removed data-aos="fade-up" to prevent mobile blank card bug due to hidden opacity in horizontal scroll
        return `
        <article class="artikel-card carousel-item" style="cursor: default; pointer-events: none; min-width: 300px; flex-shrink: 0;">
            <div class="artikel-image">
                <img src="${imageUrl}" 
                     alt="${title}" 
                     loading="lazy"
                     onerror="this.onerror=null; this.src='${CONFIG.DEFAULT_IMAGE}';">
            </div>
            <div class="artikel-content">
                <div class="artikel-category">${category}</div>
                <div class="artikel-meta">
                    <span><i class="far fa-calendar"></i> ${date}</span>
                </div>
                <h3 class="artikel-title">${title}</h3>
                <p class="artikel-excerpt">
                    ${excerpt}
                </p>
            </div>
        </article>
        `;
    }).join('');

    if (window.AOS) {
        setTimeout(() => {
            window.AOS.refresh();
        }, 100);
    }
}

// Fetch artikel dari API Mock
async function fetchArticles() {
    try {
        const res = await fetch('../api/blog/get_blogs.php');
        const data = await res.json();
        if (data.status === 'success') {
            const blogs = data.data.slice(0, CONFIG.ARTICLE_LIMIT);
            renderArticles(blogs);
        } else {
            renderEmptyState();
        }
    } catch(e) {
        console.error('Failed to fetch articles:', e);
        renderEmptyState();
    }
}

// Inisialisasi saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    fetchArticles();
});
