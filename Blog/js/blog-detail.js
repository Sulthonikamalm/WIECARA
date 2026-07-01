document.addEventListener('DOMContentLoaded', async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const blogId = urlParams.get('id');

    if (!blogId) {
        window.location.href = 'blog-list.html';
        return;
    }

    try {
        const res = await fetch(`../../api/blog/get_blog_detail.php?id=${blogId}`);
        const result = await res.json();
        if (result.status === 'success' && result.data) {
            const b = result.data;
            
            document.getElementById('blogTitle').textContent = b.title;
            document.getElementById('blogDate').textContent = b.created_at;
            document.getElementById('blogContent').innerHTML = b.content;
            
            const img = document.getElementById('blogImage');
            if (img && b.thumbnail) img.src = b.thumbnail;
        } else {
            alert('Artikel tidak ditemukan.');
            window.location.href = 'blog-list.html';
        }
    } catch (e) {
        console.error('Failed to load blog detail', e);
    }
});
