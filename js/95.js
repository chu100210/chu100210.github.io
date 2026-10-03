// 九五 · 时光册 — 照片渲染、懒加载、灯箱、分类导航
(function () {
  'use strict';

  document.documentElement.classList.replace('no-js', 'js');

  var CATS = (window.PHOTO95 && window.PHOTO95.categories) || [];
  var JSD_BASE = 'https://cdn.jsdelivr.net/gh/chu100210/chu100210.github.io@main';
  var LOCAL_BASE = ''; // 相对站内路径回退

  // ---------- 工具 ----------
  function enc(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  // 构造 jsDelivr 优先、本地回退的图片
  function buildImg(src, alt) {
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = alt || '';
    img.src = JSD_BASE + '/' + enc(src);
    img.addEventListener('error', function () {
      if (img.dataset.fb) return;
      img.dataset.fb = '1';
      img.src = enc(src);
    });
    return img;
  }

  // 全景文件名中的时间 → "2025-06-20 19:34"
  function panoLabel(file) {
    var m = file.match(/(\d{8})_(\d{6})/);
    if (!m) return file.replace(/\.webp$/i, '');
    var d = m[1];
    var t = m[2];
    return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + ' ' + t.slice(0, 2) + ':' + t.slice(2, 4);
  }

  // ---------- 灯箱数据 ----------
  var gallery = []; // { src(full), alt }
  var lbIndex = -1;

  function openLightbox(i) {
    if (i < 0 || i >= gallery.length) return;
    lbIndex = i;
    var lb = document.getElementById('m95Lightbox');
    var img = document.getElementById('m95LbImg');
    var count = document.getElementById('m95LbCount');
    var item = gallery[i];

    img.onerror = function () {
      if (img.dataset.fb) return;
      img.dataset.fb = '1';
      img.src = enc(item.src);
    };
    img.dataset.fb = '';
    img.src = JSD_BASE + '/' + enc(item.src);

    img.alt = item.alt;
    count.textContent = (i + 1) + ' / ' + gallery.length;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('m95Lightbox').hidden = true;
    document.body.style.overflow = '';
  }

  function stepLightbox(delta) {
    if (lbIndex < 0) return;
    openLightbox((lbIndex + delta + gallery.length) % gallery.length);
  }

  function bindLightbox() {
    var lb = document.getElementById('m95Lightbox');
    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });
    document.getElementById('m95LbClose').addEventListener('click', closeLightbox);
    document.getElementById('m95LbPrev').addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(-1); });
    document.getElementById('m95LbNext').addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(1); });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });

    // 移动端滑动切换
    var startX = 0;
    lb.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 48) stepLightbox(dx > 0 ? -1 : 1);
    }, { passive: true });
  }

  // ---------- 照片墙渲染 ----------
  function renderCategory(cat) {
    var grid = document.getElementById('grid-' + cat.key);
    if (!grid) return;
    cat.files.forEach(function (file, i) {
      var card = document.createElement('figure');
      card.className = 'm95-card pending';
      var src = '95/web/thumb/' + cat.name + '/' + file;
      var full = '95/web/' + cat.name + '/' + file;
      var img = buildImg(src, cat.name + ' 照片');
      card.appendChild(img);

      var index = gallery.length;
      gallery.push({ src: full, alt: cat.name + ' 照片' });
      card.addEventListener('click', function () { openLightbox(index); });

      grid.appendChild(card);
      card.dataset.index = String(i);
    });
  }

  function renderPano(cat) {
    var grid = document.getElementById('grid-pano');
    if (!grid) return;
    cat.files.forEach(function (file, i) {
      var a = document.createElement('a');
      a.className = 'm95-pano-card pending';
      a.href = 'pano.html?p=' + i;

      var img = buildImg('95/web/thumb/' + cat.name + '/' + file, '360° 全景 ' + panoLabel(file));
      var badge = document.createElement('span');
      badge.className = 'm95-pano-badge';
      badge.textContent = '360°';
      var caption = document.createElement('span');
      caption.className = 'm95-pano-caption';
      caption.textContent = panoLabel(file);

      a.appendChild(img);
      a.appendChild(badge);
      a.appendChild(caption);
      grid.appendChild(a);
    });
  }

  // 「他们现在」同学卡:照片 + 姓名(文件名)+ 近况(js/95-notes.js)
  function renderNow(cat) {
    var grid = document.getElementById('grid-xianzhuang');
    if (!grid) return;
    if (!cat || !cat.files || !cat.files.length) {
      var empty = document.createElement('p');
      empty.className = 'm95-now-empty';
      empty.textContent = '还没有同学近照 —— 把照片放进 95/photo/现状/ 文件夹(文件名建议用同学名字),跑一次压缩脚本就会出现在这里';
      grid.appendChild(empty);
      return;
    }
    var notes = window.XZ_NOTES || {};
    cat.files.forEach(function (file) {
      var name = file.replace(/\.webp$/i, '');
      var card = document.createElement('figure');
      card.className = 'm95-now-card pending';

      var photo = document.createElement('div');
      photo.className = 'm95-now-photo';
      photo.appendChild(buildImg('95/web/thumb/' + cat.name + '/' + file, name));

      var cap = document.createElement('figcaption');
      var nameEl = document.createElement('strong');
      nameEl.className = 'm95-now-name';
      nameEl.textContent = name;
      var desc = document.createElement('span');
      desc.className = 'm95-now-desc';
      desc.textContent = notes[name] || 'TA 的近况,等你来填';
      cap.appendChild(nameEl);
      cap.appendChild(desc);

      card.appendChild(photo);
      card.appendChild(cap);

      var index = gallery.length;
      gallery.push({ src: '95/web/' + cat.name + '/' + file, alt: name });
      card.addEventListener('click', function () { openLightbox(index); });

      grid.appendChild(card);
    });
  }

  // ---------- 分类导航 ----------
  function buildNav() {
    var nav = document.getElementById('m95Nav');
    if (!nav) return;
    var items = [];
    CATS.forEach(function (cat) {
      if (cat.pano || cat.now) return; // 全景与现状不进顶部导航
      var a = document.createElement('a');
      a.href = '#cat-' + cat.key;
      a.textContent = cat.name;
      nav.appendChild(a);
      items.push(a);
    });
    var aPano = document.createElement('a');
    aPano.href = '#cat-pano';
    aPano.textContent = '全景时空';
    nav.appendChild(aPano);
    items.push(aPano);

    // 滚动高亮
    var sections = ['geren', 'jiti', 'laoshi', 'biye', 'pano'].map(function (k) {
      return document.getElementById('cat-' + k);
    }).filter(Boolean);

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var key = en.target.getAttribute('data-cat') || en.target.id.replace('cat-', '');
        items.forEach(function (a, idx) {
          var target = sections[idx];
          var tkey = target.getAttribute('data-cat') || target.id.replace('cat-', '');
          a.classList.toggle('active', tkey === key);
        });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }

  // ---------- 入场动画 ----------
  function bindReveal() {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in-view');
        obs.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });

    var cardObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.remove('pending');
        cardObs.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.02 });

    // 先观察已渲染的照片卡,再兜底后续新增
    document.querySelectorAll('.m95-card.pending, .m95-pano-card.pending, .m95-now-card.pending').forEach(function (el) {
      cardObs.observe(el);
    });

    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('pending')) {
            cardObs.observe(n);
          }
        });
      });
    });
    document.querySelectorAll('.m95-main').forEach(function (el) { mo.observe(el, { childList: true, subtree: true }); });
  }

  // ---------- 启动 ----------
  function init() {
    var nowCat = null;
    CATS.forEach(function (cat) {
      if (cat.pano) renderPano(cat);
      else if (cat.now) {
        nowCat = cat;
        renderNow(cat);
      } else {
        renderCategory(cat);
      }
    });
    // 尚无现状照片时也渲染空态提示
    if (!nowCat) renderNow(null);
    buildNav();
    bindLightbox();
    bindReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
