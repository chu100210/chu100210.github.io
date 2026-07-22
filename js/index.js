/* ===== CHU.LIFE — Homepage Scripts ===== */

// Filter Tabs
(function () {
  var btns = document.querySelectorAll('.filter-btn');
  var cards = document.querySelectorAll('.work-card');
  var empty = document.getElementById('emptyState');
  var moreLink = document.getElementById('morePhotoLink');
  if (!btns.length) return;

  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var filter = btn.dataset.filter;
      var count = 0;

      cards.forEach(function (card, i) {
        if (filter === 'all' || card.dataset.cat === filter) {
          card.style.display = '';
          card.style.animation = 'fadeInUp .5s cubic-bezier(.22,1,.36,1) ' + (count * 0.06) + 's both';
          count++;
        } else {
          card.style.display = 'none';
          card.style.animation = '';
        }
      });

      if (count === 0) {
        empty.style.display = '';
        empty.classList.add('visible');
      } else {
        empty.style.display = 'none';
        empty.classList.remove('visible');
      }

      if (filter === 'photo') {
        moreLink.style.display = '';
      } else {
        moreLink.style.display = 'none';
      }
    });
  });

  // Dynamic keyframe
  var s = document.createElement('style');
  s.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(s);
})();
