document.addEventListener('DOMContentLoaded', function () {
    // 分类标签切换
    const categoryTabs = document.querySelectorAll('.category-tabs .tab');
    const newsItems = document.querySelectorAll('.news-item');

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            // 切换激活状态
            document.querySelectorAll('.category-tabs .tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const cat = this.getAttribute('data-category');
            document.querySelectorAll('.news-item').forEach(item => {
                if (cat === '全部' || item.getAttribute('data-category') === cat) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // 搜索功能
    const searchInput = document.querySelector('.search-box input');
    const searchButton = document.querySelector('.search-box button');

    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();

        newsItems.forEach(item => {
            const title = item.querySelector('h2').textContent.toLowerCase();
            const content = item.querySelector('p').textContent.toLowerCase();

            if (title.includes(searchTerm) || content.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 分页功能
    const pageButtons = document.querySelectorAll('.pagination .page-btn');
    pageButtons.forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', function () {
                pageButtons.forEach(btn => btn.classList.remove('active'));

                if (!this.querySelector('i')) {
                    this.classList.add('active');
                }
                console.log('切换到页码:', this.textContent);
            });
        }
    });

    // 图片懒加载
    const images = document.querySelectorAll('.news-item img');
    const imageOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px 50px 0px"
    };

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                observer.unobserve(img);
            }
        });
    }, imageOptions);

    images.forEach(img => imageObserver.observe(img));

    // 阅读时间估算
    function estimateReadingTime() {
        const articles = document.querySelectorAll('.news-item');
        articles.forEach(article => {
            const content = article.textContent;
            const wordCount = content.trim().split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // 假设平均阅读速度为每分钟200字

            const metaDiv = article.querySelector('.news-meta');
            const readingTimeSpan = document.createElement('span');
            readingTimeSpan.innerHTML = `<i class="far fa-clock"></i> ${readingTime}分钟阅读`;
            metaDiv.appendChild(readingTimeSpan);
        });
    }

    estimateReadingTime();
});
