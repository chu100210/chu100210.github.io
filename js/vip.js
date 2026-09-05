// ===== VIP 通道逻辑 =====
(function () {
  var VIP_NAME = '闫帅';
  var VIP_PIN = 'yanshuai666';

  // ---------- 名字验证 ----------
  var nameInput = document.getElementById('nameInput');
  var nameBtn = document.getElementById('nameBtn');
  var nameErr = document.getElementById('nameErr');
  var pinPanel = document.getElementById('pinPanel');
  var pinCode = document.getElementById('pinCode');

  function checkName() {
    var val = (nameInput.value || '').trim();
    nameErr.textContent = '';
    if (val === VIP_NAME) {
      pinCode.textContent = VIP_PIN;
      pinPanel.classList.add('show');
    } else {
      nameErr.textContent = '此通道不对你开放';
      var row = nameInput.closest('.vip-input-row');
      row.classList.remove('vip-shake');
      void row.offsetWidth; // 重启动画
      row.classList.add('vip-shake');
    }
  }

  if (nameBtn && nameInput) {
    nameBtn.addEventListener('click', checkName);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); checkName(); }
    });
  }

  // ---------- 顶部 PIN 搜索框 ----------
  var pinSearch = document.getElementById('pinSearch');
  var pinInput = document.getElementById('pinInput');
  var pinErr = document.getElementById('pinErr');

  function checkPin() {
    var val = (pinInput.value || '').trim();
    pinErr.textContent = '';
    if (val === VIP_PIN) {
      try { localStorage.setItem('ys_vip', 'granted'); } catch (e) {}
      window.location.href = 'yanshuai.html';
    } else {
      pinErr.textContent = '密钥无效，请重试';
      pinInput.value = '';
      pinInput.focus();
    }
  }

  if (pinSearch && pinInput) {
    pinSearch.addEventListener('submit', function (e) {
      e.preventDefault();
      checkPin();
    });
  }
})();
