/* ===== CHU.LIFE — Shared Scripts ===== */

// Theme Toggle
(function () {
  var t = document.getElementById('themeToggle');
  if (t) {
    var h = document.documentElement;
    if (localStorage.getItem('theme') === 'light') h.classList.add('light');
    t.addEventListener('click', function () {
      h.classList.toggle('light');
      localStorage.setItem('theme', h.classList.contains('light') ? 'light' : 'dark');
    });
  }
})();

// Cursor Glow
(function () {
  var glow = document.getElementById('cursorGlow');
  if (!glow) return;
  var mx = -500, my = -500, cx = -500, cy = -500;
  document.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; });
  (function anim() {
    cx += (mx - cx) * 0.08;
    cy += (my - cy) * 0.08;
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
    requestAnimationFrame(anim);
  })();
  document.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
  document.addEventListener('mouseenter', function () { glow.style.opacity = '1'; });
})();

// Scroll Reveal
(function () {
  if (!('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();

// Lightbox
(function () {
  var lb = document.getElementById('lightbox');
  if (!lb) return;
  var img = document.getElementById('lightboxImg');
  var close = document.getElementById('lightboxClose');
  function openLightbox(src) {
    img.src = src;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }
  close.addEventListener('click', closeLightbox);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

  // Bind to elements with data-full or .photo-item
  document.querySelectorAll('[data-full]').forEach(function (el) {
    el.addEventListener('click', function () { openLightbox(el.dataset.full); });
  });
  document.querySelectorAll('.photo-item').forEach(function (el) {
    el.addEventListener('click', function () {
      var i = el.querySelector('img');
      if (i) openLightbox(i.src);
    });
  });
})();
