// ===== 闫帅专属页：访问校验 =====
(function () {
  var granted = false;
  try {
    granted = localStorage.getItem('ys_vip') === 'granted';
  } catch (e) {}

  if (!granted) {
    // 未通过 PIN 验证 → 送回 VIP 通道
    window.location.replace('vip.html');
  }
})();
