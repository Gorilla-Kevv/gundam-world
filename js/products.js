document.addEventListener('DOMContentLoaded', function() {
    // 获取所有过滤器
    const seriesFilter = document.getElementById('seriesFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const priceFilter = document.getElementById('priceFilter');
    const searchInput = document.getElementById('searchInput');

    // 获取所有产品卡片
    const productCards = document.querySelectorAll('.product-card');

    // 筛选函数
    function filterProducts() {
        const selectedSeries = seriesFilter.value;
        const selectedGrade = gradeFilter.value;
        const searchTerm = searchInput.value.toLowerCase();

        productCards.forEach(card => {
            const series = card.dataset.series;
            const grade = card.dataset.grade;
            const title = card.querySelector('h3').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();

            // 检查是否符合所有筛选条件
            let matchesSeries = !selectedSeries || series === selectedSeries;
            let matchesGrade = !selectedGrade || grade === selectedGrade;
            let matchesPrice = true;


            // 搜索词匹配
            let matchesSearch = !searchTerm || 
                title.includes(searchTerm) || 
                description.includes(searchTerm);

            // 显示或隐藏产品卡片
            if (matchesSeries && matchesGrade && matchesPrice && matchesSearch) {
                card.style.display = 'block';
                card.classList.add('fade-in');
            } else {
                card.style.display = 'none';
                card.classList.remove('fade-in');
            }
        });

        // 检查是否有显示的产品
        const visibleProducts = document.querySelectorAll('.product-card[style="display: block"]');
        const noResultsMessage = document.querySelector('.no-results-message') || createNoResultsMessage();
        
        if (visibleProducts.length === 0) {
            noResultsMessage.style.display = 'block';
        } else {
            noResultsMessage.style.display = 'none';
        }
    }

    // 创建"无结果"提示
    function createNoResultsMessage() {
        const message = document.createElement('div');
        message.className = 'no-results-message';
        message.innerHTML = `
            <p>抱歉，没有找到符合条件的产品</p>
            <button onclick="resetFilters()">重置筛选条件</button>
        `;
        document.querySelector('.products-grid').appendChild(message);
        return message;
    }

    // 重置筛选条件
    window.resetFilters = function() {
        seriesFilter.value = '';
        gradeFilter.value = '';
        priceFilter.value = '';
        searchInput.value = '';
        filterProducts();
    }

    // 添加事件监听器
    seriesFilter.addEventListener('change', filterProducts);
    gradeFilter.addEventListener('change', filterProducts);
    priceFilter.addEventListener('change', filterProducts);
    searchInput.addEventListener('input', debounce(filterProducts, 300));

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 分页功能
    const pageButtons = document.querySelectorAll('.pagination .page-btn');
    pageButtons.forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', function() {
                pageButtons.forEach(btn => btn.classList.remove('active'));
                if (!this.querySelector('i')) {
                    this.classList.add('active');
                }
                console.log('切换到页码:', this.textContent);
            });
        }
    });
    const images = document.querySelectorAll('.product-card img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));

    priceFilter.addEventListener('change', function () {
        const value = priceFilter.value;
        productCards.forEach(card => {
            const priceText = card.querySelector('.price').textContent;
            const match = priceText.replace(/,/g, '').match(/(\d+)/);
            let price = match ? parseInt(match[1], 10) : 0;

            let show = false;
            if (!value) {
                show = true;
            } else if (value === '2000-5000') {
                show = price >= 2000 && price <= 5000;
            } else if (value === '5000-10000') {
                show = price > 5000 && price <= 10000;
            } else if (value === '10000+') {
                show = price > 10000;
            }
            card.style.display = show ? '' : 'none';
        });
    });
});
