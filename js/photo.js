/* ===== CHU.LIFE — Photo Page Carousel ===== */

(function () {
  var photos = [
    "images/photo/IMG20240813181722.webp",
    "images/photo/IMG_20250807_151850_1784626771606edit.webp",
    "images/photo/IMG_20260313_174455_1.webp",
    "images/photo/IMG_20260321_193034.webp",
    "images/photo/IMG_20260322_104849_1.webp",
    "images/photo/IMG_20260502_140116.webp",
    "images/photo/IMG_20260502_140541.webp",
    "images/photo/IMG_20260502_210321.webp",
    "images/photo/CR1420250627_180319745.webp",
    "images/photo/CR1420250628_154138144.webp",
    "images/photo/CR1420250628_161915809.webp",
    "images/photo/CR1420250628_164222457.webp",
    "images/photo/CR1420250628_164245153.webp",
    "images/photo/CR1420250628_170725099.webp",
    "images/photo/CR1420250629_093635227.webp",
    "images/photo/CR1420250629_142459996.webp",
    "images/photo/CR1420250629_145210379.webp",
    "images/photo/CR1420250629_185406386.webp",
    "images/photo/CR1420250629_191258477.webp"
  ];

  var track = document.getElementById('carouselTrack');
  var dotsContainer = document.getElementById('carouselDots');
  if (!track || !dotsContainer) return;

  var slides, dots, current = 0, total, interval;

  photos.forEach(function (src, i) {
    var img = document.createElement('img');
    if (i < 3) img.src = src;
    else img.dataset.src = src;
    img.loading = 'lazy';
    img.className = 'carousel-slide' + (i === 0 ? ' active' : '');
    img.alt = '摄影作品';
    track.appendChild(img);

    var dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.dataset.index = i;
    dotsContainer.appendChild(dot);
  });

  slides = document.querySelectorAll('.carousel-slide');
  dots = document.querySelectorAll('.carousel-dot');
  total = slides.length;

  function preload(i) {
    var img = slides[i];
    if (img && img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  }

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = index;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    preload((current + 1) % total);
    preload((current + 2) % total);
  }

  function next() { goTo((current + 1) % total); }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      goTo(parseInt(dot.dataset.index));
      resetTimer();
    });
  });

  function resetTimer() {
    clearInterval(interval);
    interval = setInterval(next, 4000);
  }
  interval = setInterval(next, 4000);

  var hero = document.getElementById('photoHero');
  if (hero) {
    hero.addEventListener('mouseenter', function () { clearInterval(interval); });
    hero.addEventListener('mouseleave', function () { interval = setInterval(next, 4000); });
  }
})();
