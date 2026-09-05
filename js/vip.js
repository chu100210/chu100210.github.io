// ===== 神秘入口逻辑（恶搞版）=====
(function () {
  var VIP_NAME = '闫帅';
  var VIP_PIN = 'yanshuai666';

  // ---------- 名字验证 ----------
  var nameInput = document.getElementById('nameInput');
  var nameBtn = document.getElementById('nameBtn');
  var nameErr = document.getElementById('nameErr');
  var rejectCount = document.getElementById('rejectCount');
  var pinPanel = document.getElementById('pinPanel');
  var pinCode = document.getElementById('pinCode');
  var nameRow = document.getElementById('nameRow');

  var WRONG_MSGS = [
    '你不是闫帅！这门只认闫帅！',
    '冒牌货，速速退下！',
    '查无此人（除非你叫闫帅）',
    '这通道有洁癖，只让闫帅走',
    '闫帅的替身都比你像闫帅',
    '别试了，这门只给闫帅开',
    '你是谁？这门不认识你',
  ];
  var rejects = 0;

  function shake(el) {
    el.classList.remove('shake');
    void el.offsetWidth; // 重启动画
    el.classList.add('shake');
  }

  function checkName() {
    var val = (nameInput.value || '').trim();
    nameErr.textContent = '';
    if (!val) {
      nameErr.textContent = '你连名字都不敢报？';
      shake(nameRow);
      return;
    }
    if (val === VIP_NAME) {
      pinCode.textContent = VIP_PIN;
      pinPanel.classList.add('show');
    } else {
      rejects += 1;
      nameErr.textContent = WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)];
      rejectCount.textContent = '🚧 已成功拦截 ' + rejects + ' 个试图闯入的闲杂人等';
      shake(nameRow);
    }
  }

  if (nameBtn && nameInput) {
    nameBtn.addEventListener('click', checkName);
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); checkName(); }
    });
  }

  // ---------- 顶部暗号搜索框 ----------
  var pinBar = document.getElementById('pinSearch');
  var pinInput = document.getElementById('pinInput');
  var pinErr = document.getElementById('pinErr');

  function checkPin() {
    var val = (pinInput.value || '').trim();
    pinErr.textContent = '';
    if (val === VIP_PIN) {
      try { localStorage.setItem('ys_vip', 'granted'); } catch (e) {}
      window.location.href = 'yanshuai.html';
    } else {
      pinErr.textContent = val ? '暗号不对！你从哪儿偷来的？' : '暗号呢？空手可进不去';
      shake(pinBar);
      pinInput.focus();
    }
  }

  if (pinBar && pinInput) {
    pinBar.addEventListener('submit', function (e) {
      e.preventDefault();
      checkPin();
    });
  }
})();
