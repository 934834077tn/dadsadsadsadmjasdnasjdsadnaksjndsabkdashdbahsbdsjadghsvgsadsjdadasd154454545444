// Blog Posts Manager - New System
const POSTS_DATA_URL = 'posts-data.json';

let allPosts = [];
let filteredPosts = [];
let currentCategory = 'all';
let currentPage = 1;
const postsPerPage = 9;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadPosts();
    renderCategories();
    renderPosts();
    setupEventListeners();
});

// Load posts from JSON
async function loadPosts() {
    try {
        const response = await fetch(POSTS_DATA_URL);
        const data = await response.json();
        allPosts = data.posts || [];
        filteredPosts = [...allPosts];
    } catch (error) {
        console.error('Error loading posts:', error);
        allPosts = [];
        filteredPosts = [];
    }
}

// Render categories
function renderCategories() {
    const categoriesContainer = document.getElementById('blog-categories');
    if (!categoriesContainer) return;

    const categories = ['all', ...new Set(allPosts.map(post => post.category))];
    const categoryCount = {};
    
    allPosts.forEach(post => {
        categoryCount[post.category] = (categoryCount[post.category] || 0) + 1;
    });

    const html = categories.map(cat => {
        const count = cat === 'all' ? allPosts.length : (categoryCount[cat] || 0);
        const active = cat === currentCategory ? 'active' : '';
        return `
            <button class="category-btn ${active}" data-category="${cat}">
                ${cat === 'all' ? 'All Posts' : cat} (${count})
            </button>
        `;
    }).join('');

    categoriesContainer.innerHTML = html;
}

// Render posts
function renderPosts() {
    const postsContainer = document.getElementById('blog-posts-grid');
    if (!postsContainer) return;

    if (filteredPosts.length === 0) {
        postsContainer.innerHTML = '<div class="no-posts"><p>No posts found.</p></div>';
        return;
    }

    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const postsToShow = filteredPosts.slice(startIndex, endIndex);

    const html = postsToShow.map(post => `
        <article class="blog-card">
            <a href="${post.url}" class="blog-card-link">
                <div class="blog-card-image">
                    <img src="${post.cover}" alt="${post.title}" loading="lazy">
                    <span class="blog-card-category">${post.category}</span>
                </div>
                <div class="blog-card-content">
                    <div class="blog-card-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${formatDate(post.date)}</span>
                        <span><i class="fa-regular fa-user"></i> ${post.author}</span>
                    </div>
                    <h3 class="blog-card-title">${post.title}</h3>
                    <p class="blog-card-description">${post.description}</p>
                    <span class="read-more">Read More <i class="fa-solid fa-arrow-right"></i></span>
                </div>
            </a>
        </article>
    `).join('');

    postsContainer.innerHTML = html;
    renderPagination();
}

// Render pagination
function renderPagination() {
    const paginationContainer = document.getElementById('blog-pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="page-btn" data-page="${currentPage - 1}">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const active = i === currentPage ? 'active' : '';
            html += `<button class="page-btn ${active}" data-page="${i}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-dots">...</span>`;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        html += `<button class="page-btn" data-page="${currentPage + 1}">Next</button>`;
    }

    paginationContainer.innerHTML = html;
}

// Setup event listeners
function setupEventListeners() {
    // Category filter
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-btn')) {
            currentCategory = e.target.dataset.category;
            currentPage = 1;
            
            if (currentCategory === 'all') {
                filteredPosts = [...allPosts];
            } else {
                filteredPosts = allPosts.filter(post => post.category === currentCategory);
            }
            
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            renderPosts();
        }
    });

    // Pagination
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('page-btn')) {
            currentPage = parseInt(e.target.dataset.page);
            renderPosts();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Search
    const searchInput = document.getElementById('blog-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            currentPage = 1;
            
            if (query === '') {
                filteredPosts = currentCategory === 'all' 
                    ? [...allPosts] 
                    : allPosts.filter(post => post.category === currentCategory);
            } else {
                const baseFilter = currentCategory === 'all' 
                    ? allPosts 
                    : allPosts.filter(post => post.category === currentCategory);
                
                filteredPosts = baseFilter.filter(post => 
                    post.title.toLowerCase().includes(query) ||
                    post.description.toLowerCase().includes(query)
                );
            }
            
            renderPosts();
        });
    }
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Get latest posts for homepage
function getLatestPosts(count = 3) {
    return allPosts.slice(0, count);
}

// Export for use in other pages
window.BlogManager = {
    loadPosts,
    getLatestPosts,
    allPosts: () => allPosts
};
