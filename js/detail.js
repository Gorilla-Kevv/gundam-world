document.addEventListener('DOMContentLoaded', function() {
    const mainImage = document.getElementById('mainImage');
    const thumbnails = document.querySelectorAll('.thumbnail-container img');
    const prevBtn = document.querySelector('.showcase-nav .prev');
    const nextBtn = document.querySelector('.showcase-nav .next');
    let currentIndex = 0;

    // 切换主图和高亮缩略图
    function updateMainImage(index) {
        thumbnails.forEach(img => img.classList.remove('active'));
        thumbnails[index].classList.add('active');
        mainImage.src = thumbnails[index].src;
        currentIndex = index;
    }

    // 左右按钮事件
    prevBtn.addEventListener('click', function () {
        let idx = (currentIndex - 1 + thumbnails.length) % thumbnails.length;
        updateMainImage(idx);
    });
    nextBtn.addEventListener('click', function () {
        let idx = (currentIndex + 1) % thumbnails.length;
        updateMainImage(idx);
    });

    // 缩略图点击事件
    thumbnails.forEach((img, idx) => {
        img.addEventListener('click', function () {
            updateMainImage(idx);
        });
    });

    // 标签页切换功能
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            // 按钮高亮
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // 内容切换
            const tab = this.getAttribute('data-tab');
            tabContents.forEach(content => {
                if (content.id === tab) {
                    content.style.display = '';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });
});