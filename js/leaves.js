// 落叶引擎 — Canvas 秋叶飘落(单画布,rAF,GPU 友好)
// 自动读取 #leaves 画布;页面不可见时暂停;尊重 prefers-reduced-motion
(function () {
  'use strict';

  var canvas = document.getElementById('leaves');
  if (!canvas) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  var ctx = canvas.getContext('2d');
  var COLORS = ['#c98a3d', '#b56a2a', '#d9a441', '#8f5b2e', '#e0b04f', '#a8692f'];
  var W = 0;
  var H = 0;
  var leaves = [];
  var raf = null;
  var running = true;

  function Leaf(first) {
    this.reset(first);
  }

  Leaf.prototype.reset = function (first) {
    this.x = Math.random() * W;
    this.y = first ? Math.random() * H : -40 - Math.random() * 80;
    this.size = 7 + Math.random() * 10;          // 叶片半长
    this.fall = 0.5 + Math.random() * 1.3;       // 下落速度
    this.swayAmp = 16 + Math.random() * 34;      // 水平摆动幅度
    this.swaySpeed = 0.008 + Math.random() * 0.014;
    this.phase = Math.random() * Math.PI * 2;
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.035;
    this.color = COLORS[(Math.random() * COLORS.length) | 0];
    this.alpha = 0.5 + Math.random() * 0.4;
    this.wobble = 1 + Math.random() * 0.6;       // 侧翻挤压感
  };

  Leaf.prototype.update = function () {
    this.phase += this.swaySpeed;
    this.y += this.fall;
    this.x += Math.sin(this.phase) * this.swayAmp * 0.02 + 0.12;
    this.rot += this.rotSpeed;
    if (this.y > H + 50) this.reset(false);
  };

  Leaf.prototype.draw = function () {
    var s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.scale(this.wobble, 1);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;

    // 叶片:两段贝塞尔
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.75, -s * 0.6, s * 0.7, s * 0.4, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.4, -s * 0.75, -s * 0.6, 0, -s);
    ctx.fill();

    // 主叶脉
    ctx.strokeStyle = 'rgba(110, 62, 28, 0.45)';
    ctx.lineWidth = Math.max(0.6, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.85);
    ctx.lineTo(0, s * 0.85);
    ctx.stroke();

    ctx.restore();
  };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    var count = Math.min(64, Math.max(22, Math.floor(W / 24)));
    if (leaves.length !== count) {
      leaves = [];
      for (var i = 0; i < count; i++) leaves.push(new Leaf(true));
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < leaves.length; i++) {
      leaves[i].update();
      leaves[i].draw();
    }
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  resize();
  start();
})();
