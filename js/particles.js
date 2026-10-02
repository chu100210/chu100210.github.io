/* ============================================================
   CHU.LIFE — Particle Field（水感版）
   仿 DeepSeek Harness 首页背景：鼠标经过，粒子如水般散开、缓缓回流
   ------------------------------------------------------------
   用法（页面里放一个 canvas 即自动初始化）：
     <canvas class="particle-field" aria-hidden="true"></canvas>
     <script src="js/particles.js"></script>

   可选 data-* 配置：
     data-spacing    网格间距 px（默认 0 = 自适应）
     data-radius     鼠标作用半径 px（默认 180）
     data-force      拨开力度 px/帧（默认 1.6）
     data-spring     回流速率（默认 .025，越小回流越慢、越水感）
     data-dot-size   粒子半径 px（默认 1.6）
     data-alpha      粒子透明度（默认 .5）
     data-color      粒子颜色（默认读 CSS 变量 --accent）
     data-links      "0" 关闭邻近连线（默认开）
     data-link-dist  连线距离 px（默认 110）
     data-link-alpha 连线透明度（默认 .12）

   可选调参控件（自动绑定，CSP 友好、无内联脚本）：
     <input type="range"  data-pf="spacing">
     <input type="checkbox" data-pf="links">
     <output data-pf-value="spacing"></output>
     <button data-pf-reset>恢复默认</button>

   JS API：window.ParticleField.create(canvas, opts) → { setOptions, destroy }
   ============================================================ */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  var DEFAULTS = {
    spacing: 0,       // 0 = 按屏幕自适应
    radius: 180,      // 鼠标作用半径
    force: 1.6,       // 拨开力度（每帧位移 px）
    spring: 0.025,    // 回流速率（越小回流越慢，水中漂散感）
    dotSize: 1.6,     // 粒子半径
    alpha: 0.5,       // 粒子透明度
    color: '',        // 空 = 读取 CSS 变量 --accent
    links: true,      // 邻近连线（默认开启）
    linkDist: 110,
    linkAlpha: 0.12
  };

  /* ---- 读取 CSS 变量（自动适配明暗主题） ---- */
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      if (v && v.trim()) return v.trim();
    } catch (e) { /* ignore */ }
    return fallback;
  }

  /* ---- 从 canvas 的 data-* 属性读取配置 ---- */
  function readData(canvas) {
    var opts = {};
    var map = {
      spacing: 'spacing', radius: 'radius', force: 'force',
      spring: 'spring', 'dot-size': 'dotSize',
      alpha: 'alpha', color: 'color', links: 'links',
      'link-dist': 'linkDist', 'link-alpha': 'linkAlpha'
    };
    for (var key in map) {
      var v = canvas.getAttribute('data-' + key);
      if (v === null || v === '') continue;
      var t = map[key];
      if (t === 'color') opts[t] = v;
      else if (t === 'links') opts[t] = v !== '0';
      else opts[t] = parseFloat(v);
    }
    return opts;
  }

  /* ---- 创建粒子场 ---- */
  function create(canvas, opts) {
    if (!canvas) return null;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;

    var o = {};
    var k, k2;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    if (opts) for (k2 in opts) o[k2] = opts[k2];

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, dots = [];
    var mx = -1e4, my = -1e4;      // 真实鼠标位置
    var smx = -1e4, smy = -1e4;    // 平滑后的位置（形成拖尾）
    var color = o.color || cssVar('--accent', '#d4a853');
    var raf = null, destroyed = false, resizeTimer = null;

    var reduceMotion = false;
    try {
      reduceMotion = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { /* ignore */ }

    function gridSpacing() {
      if (o.spacing > 0) return o.spacing;
      var v = Math.min(W || window.innerWidth, H || window.innerHeight) / 16;
      return Math.max(44, Math.min(110, v));
    }

    function build() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = gridSpacing();
      dots = [];
      for (var y = s * 0.5; y <= H + s * 0.5; y += s) {
        for (var x = s * 0.5; x <= W + s * 0.5; x += s) {
          dots.push({
            hx: x, hy: y,        // 网格原位
            x: x, y: y,          // 当前位置
            r: o.dotSize * (0.75 + Math.random() * 0.5)
          });
        }
      }
    }

    /* 水感物理：直接位移、无速度存储——
       粒子像被水波拨开，再指数回流到网格原位，零弹跳 */
    function physics() {
      var R = o.radius, R2 = R * R;
      var push = o.force, flow = o.spring;
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        var dx = p.x - smx, dy = p.y - smy;
        var d2 = dx * dx + dy * dy;
        // 越靠近鼠标拨得越开，边缘平滑过渡
        if (d2 < R2 && d2 > 1e-4) {
          var d = Math.sqrt(d2);
          var f = (1 - d / R) * push;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
        // 指数回流：平滑无弹跳
        p.x += (p.hx - p.x) * flow;
        p.y += (p.hy - p.y) * flow;
      }
    }

    /* 邻近粒子连线（均匀网格哈希，避免 O(n²)） */
    function drawLinks() {
      var cell = o.linkDist;
      var cols = Math.max(1, Math.ceil(W / cell));
      var rows = Math.max(1, Math.ceil(H / cell));
      var buckets = new Array(cols * rows);
      var i, p;
      for (i = 0; i < dots.length; i++) {
        p = dots[i];
        var c = Math.min(cols - 1, Math.max(0, Math.floor(p.x / cell)));
        var r = Math.min(rows - 1, Math.max(0, Math.floor(p.y / cell)));
        var b = r * cols + c;
        (buckets[b] = buckets[b] || []).push(p);
      }
      var max2 = o.linkDist * o.linkDist;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (var bi = 0; bi < buckets.length; bi++) {
        var arr = buckets[bi];
        if (!arr) continue;
        var br = Math.floor(bi / cols), bc = bi % cols;
        for (var ai = 0; ai < arr.length; ai++) {
          var a = arr[ai];
          // 同格内配对
          for (var j = ai + 1; j < arr.length; j++) {
            var same = arr[j];
            var dx0 = same.x - a.x, dy0 = same.y - a.y;
            var d20 = dx0 * dx0 + dy0 * dy0;
            if (d20 < max2) {
              ctx.globalAlpha = o.linkAlpha * (1 - d20 / max2);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(same.x, same.y);
              ctx.stroke();
            }
          }
          // 右、左下、下、右下邻格
          for (var dr = 0; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc <= 0) continue;
              var nr = br + dr, nc = bc + dc;
              if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
              var nbr = buckets[nr * cols + nc];
              if (!nbr) continue;
              for (var m = 0; m < nbr.length; m++) {
                var q = nbr[m];
                var dx = q.x - a.x, dy = q.y - a.y;
                var d2 = dx * dx + dy * dy;
                if (d2 < max2) {
                  ctx.globalAlpha = o.linkAlpha * (1 - d2 / max2);
                  ctx.beginPath();
                  ctx.moveTo(a.x, a.y);
                  ctx.lineTo(q.x, q.y);
                  ctx.stroke();
                }
              }
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      var R2 = o.radius * o.radius;
      ctx.clearRect(0, 0, W, H);
      if (o.links) drawLinks();

      // 全部粒子
      ctx.fillStyle = color;
      ctx.globalAlpha = o.alpha;
      ctx.beginPath();
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, TAU);
      }
      ctx.fill();

      // 鼠标附近的粒子提亮
      ctx.beginPath();
      var n = 0;
      for (var j = 0; j < dots.length; j++) {
        var q = dots[j];
        var dx = q.x - smx, dy = q.y - smy;
        if (dx * dx + dy * dy < R2) {
          ctx.moveTo(q.x + q.r, q.y);
          ctx.arc(q.x, q.y, q.r, 0, TAU);
          n++;
        }
      }
      if (n > 0) {
        ctx.globalAlpha = Math.min(1, o.alpha + 0.4);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function tick() {
      if (destroyed) return;
      if (!document.hidden && !reduceMotion) {
        smx += (mx - smx) * 0.3;
        smy += (my - smy) * 0.3;
        physics();
        draw();
      }
      raf = requestAnimationFrame(tick);
    }

    function onMove(e) { mx = e.clientX; my = e.clientY; }
    function onTouch(e) {
      if (e.touches && e.touches.length) {
        mx = e.touches[0].clientX;
        my = e.touches[0].clientY;
      }
    }
    function onLeave() { mx = my = -1e4; }
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        build();
        if (reduceMotion) draw();
      }, 150);
    }
    function onTheme() {
      color = o.color || cssVar('--accent', '#d4a853');
      if (reduceMotion) draw();
    }

    var themeObserver = null;
    if (window.MutationObserver) {
      themeObserver = new MutationObserver(onTheme);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
      });
    }

    function destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onTouch);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisible);
      if (themeObserver) themeObserver.disconnect();
      canvas.__pf = null;
    }
    function onVisible() { /* 可见性变化时 rAF 自动暂停绘制，无需处理 */ }

    build();
    if (reduceMotion) {
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('touchmove', onTouch, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisible);

    var ctrl = {
      options: o,
      setOptions: function (patch) {
        var rebuild = false;
        for (var key in patch) {
          if (key === 'spacing' && patch[key] !== o.spacing) rebuild = true;
          o[key] = patch[key];
        }
        if (rebuild) build();
        if (reduceMotion) draw();
      },
      destroy: destroy
    };
    canvas.__pf = ctrl;
    return ctrl;
  }

  /* ---- 绑定 data-pf 调参控件 ---- */
  function bindControls(root) {
    root = root || document;
    var canvas = root.querySelector('canvas.particle-field');
    var ctrl = canvas && canvas.__pf ? canvas.__pf : null;

    var inputs = root.querySelectorAll('[data-pf]');
    var i;
    for (i = 0; i < inputs.length; i++) {
      (function (el) {
        var key = el.getAttribute('data-pf');
        function apply() {
          if (!ctrl) return;
          var val;
          if (el.type === 'checkbox') val = el.checked;
          else if (el.type === 'range' || el.type === 'number') val = parseFloat(el.value);
          else val = el.value;
          var patch = {};
          patch[key] = val;
          ctrl.setOptions(patch);
          var out = root.querySelector('[data-pf-value="' + key + '"]');
          if (out) out.textContent = (el.type === 'checkbox')
            ? (el.checked ? '开' : '关') : el.value;
        }
        el.addEventListener('input', apply);
        el.addEventListener('change', apply);
        apply();
      })(inputs[i]);
    }

    var resets = root.querySelectorAll('[data-pf-reset]');
    for (i = 0; i < resets.length; i++) {
      resets[i].addEventListener('click', function () {
        if (!ctrl) return;
        ctrl.setOptions({
          spacing: DEFAULTS.spacing,
          radius: DEFAULTS.radius,
          force: DEFAULTS.force,
          spring: DEFAULTS.spring,
          links: DEFAULTS.links
        });
        var list = root.querySelectorAll('[data-pf]');
        for (var j = 0; j < list.length; j++) {
          var el = list[j];
          var key = el.getAttribute('data-pf');
          if (typeof DEFAULTS[key] === 'undefined') continue;
          if (el.type === 'checkbox') el.checked = !!DEFAULTS[key];
          else el.value = DEFAULTS[key];
          var out = root.querySelector('[data-pf-value="' + key + '"]');
          if (out) out.textContent = (el.type === 'checkbox')
            ? (DEFAULTS[key] ? '开' : '关') : String(DEFAULTS[key]);
        }
      });
    }
  }

  /* ---- 启动 ---- */
  function boot() {
    var nodes = document.querySelectorAll('canvas.particle-field');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__pf) create(nodes[i], readData(nodes[i]));
    }
    bindControls(document);
  }

  window.ParticleField = { create: create, defaults: DEFAULTS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
