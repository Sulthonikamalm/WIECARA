document.addEventListener('DOMContentLoaded', async function () {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;

    try {
        const res = await fetch('../../api/blog/get_blogs.php');
        const result = await res.json();
        if (result.status === 'success') {
            const blogs = result.data;
            if (blogs.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Belum ada artikel dipublikasikan.</p>';
            } else {
                grid.innerHTML = blogs.map(b => `
                    <div class="blog-card">
                        <img src="${b.thumbnail || '../../assets/images/default-blog.jpg'}" alt="${b.title}" class="blog-image">
                        <div class="blog-content">
                            <span class="blog-category">Edukasi</span>
                            <h3 class="blog-title">${b.title}</h3>
                            <p class="blog-excerpt">${b.content.substring(0, 100)}...</p>
                            <div class="blog-meta">
                                <span>${b.created_at}</span>
                                <a href="blog-detail.html?id=${b.id}" class="read-more">Baca Selengkapnya <i class="bi bi-arrow-right"></i></a>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Failed to load blogs', e);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Gagal memuat artikel.</p>';
    }
});
