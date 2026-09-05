// ===== 闫帅专属页：访问校验 + 今日特权 =====
(function () {
  var granted = false;
  try {
    granted = localStorage.getItem('ys_vip') === 'granted';
  } catch (e) {}

  if (!granted) {
    // 未通过 PIN 验证 → 送回神秘入口
    window.location.replace('vip.html');
    return;
  }

  // 今日特权轮播
  var TIPS = [
    '今日特权：可以随时访问本页',
    '今日特权：多呼吸一口空气',
    '今日特权：走路可以抬头挺胸',
    '今日特权：上厕所可以不排队（自己家的）',
    '今日特权：心情不好可以找褚俊熙',
    '今日特权：以上特权均不可兑现',
  ];
  var tipEl = document.getElementById('ysTip');
  if (tipEl) {
    var i = 0;
    setInterval(function () {
      i = (i + 1) % TIPS.length;
      tipEl.textContent = TIPS[i];
    }, 4000);
  }
})();
