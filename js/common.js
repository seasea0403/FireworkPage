/* ============================================================
   全站通用脚本：导航高亮 / 轮播组件 / 数字滚动 / 视频交互
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 导航当前页高亮 ---------- */
  function setActiveNav() {
    var page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === page) a.classList.add('active');
    });
  }

  /* ---------- 通用轮播组件 ----------
     用法：
     <div class="carousel" data-autoplay="4000">
       <div class="carousel-track">
         <div class="carousel-slide"><img src="..."><div class="carousel-caption">...</div></div>
         ...
       </div>
     </div>
     脚本自动补左右箭头与圆点。 */
  function initCarousel(root) {
    var track = root.querySelector('.carousel-track');
    var slides = root.querySelectorAll('.carousel-slide');
    if (!track || slides.length === 0) return;

    var index = 0;
    var timer = null;
    var autoplay = parseInt(root.dataset.autoplay || '0', 10);

    // 箭头
    var prev = document.createElement('button');
    prev.className = 'carousel-btn prev';
    prev.setAttribute('aria-label', '上一张');
    prev.textContent = '‹';
    var next = document.createElement('button');
    next.className = 'carousel-btn next';
    next.setAttribute('aria-label', '下一张');
    next.textContent = '›';
    root.appendChild(prev);
    root.appendChild(next);

    // 圆点
    var dotsBox = document.createElement('div');
    dotsBox.className = 'carousel-dots';
    var dots = [];
    for (var i = 0; i < slides.length; i++) {
      (function (i) {
        var d = document.createElement('button');
        d.className = 'carousel-dot';
        d.setAttribute('aria-label', '第 ' + (i + 1) + ' 张');
        d.addEventListener('click', function () { go(i); restart(); });
        dotsBox.appendChild(d);
        dots.push(d);
      })(i);
    }
    root.appendChild(dotsBox);

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + index * 100 + '%)';
      dots.forEach(function (d, j) { d.classList.toggle('on', j === index); });
    }
    function restart() {
      if (!autoplay) return;
      clearInterval(timer);
      timer = setInterval(function () { go(index + 1); }, autoplay);
    }

    prev.addEventListener('click', function () { go(index - 1); restart(); });
    next.addEventListener('click', function () { go(index + 1); restart(); });
    root.addEventListener('mouseenter', function () { clearInterval(timer); });
    root.addEventListener('mouseleave', restart);

    // 触屏滑动
    var startX = 0;
    root.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
      restart();
    }, { passive: true });

    go(0);
    restart();
  }

  /* ---------- 数字滚动（进入视口时从 0 涨到目标值） ----------
     用法：<span class="stat-num" data-count="1280000">0</span>
     接真实数据时：fetch 接口后把返回值写入 data-count 再触发动画即可。 */
  function animateCount(el) {
    var target = parseInt(el.dataset.count || '0', 10);
    var duration = 1600;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(target * eased).toLocaleString('zh-CN');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in window)) {
      nums.forEach(animateCount);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---------- 全局背景视频：加载失败时隐藏，露出 CSS 夜空兜底 ---------- */
  function initBgVideo() {
    var video = document.querySelector('.bg-video');
    if (!video) return;
    video.addEventListener('error', hide, true); // source 错误会冒泡到 capture 阶段
    function hide() { video.style.display = 'none'; }
  }

  /* ---------- 开局动画：点击封面播放 ---------- */
  function initOpeningVideo() {
    var box = document.querySelector('.opening-video');
    if (!box) return;
    var video = box.querySelector('video');
    var cover = box.querySelector('.video-cover');
    var tip = document.querySelector('.video-tip');
    if (!video || !cover) return;

    video.addEventListener('error', function () {
      if (tip) tip.textContent = '视频文件缺失：请将开局动画放入 assets/video/opening.mp4';
    }, true);

    cover.addEventListener('click', function () {
      var p = video.play();
      if (p && p.catch) {
        p.catch(function () {
          if (tip) tip.textContent = '视频文件缺失：请将开局动画放入 assets/video/opening.mp4';
        });
      }
    });
    video.addEventListener('play', function () { cover.style.display = 'none'; });
    video.addEventListener('pause', function () { cover.style.display = 'flex'; });
    video.addEventListener('ended', function () { cover.style.display = 'flex'; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setActiveNav();
    document.querySelectorAll('.carousel').forEach(initCarousel);
    initCounters();
    initBgVideo();
    initOpeningVideo();
  });
})();
