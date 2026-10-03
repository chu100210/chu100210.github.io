// 360° 全景浏览 — 入口(打包进 psv.bundle.js)
// 全景清单读自 js/95-data.js(window.PHOTO95,由 scripts/compress-95.js 生成),
// 照片文件位于 95/web/全景/。新增全景:放入 95/photo/全景/ 后重跑压缩脚本即可。
import { Viewer } from '@photo-sphere-viewer/core';
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

// 文件名时间 → "2025-06-20 19:34"
function panoLabel(file) {
  const m = file.match(/(\d{8})_(\d{6})/);
  if (!m) return file.replace(/\.webp$/i, '');
  const d = m[1];
  const t = m[2];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

function getPanoramas() {
  const data = window.PHOTO95 && window.PHOTO95.categories;
  const cat = data && data.find((c) => c.pano);
  if (cat && cat.files && cat.files.length) {
    return cat.files.map((f) => ({
      file: `95/web/${cat.name}/${f}`,
      label: panoLabel(f),
    }));
  }
  return [{ file: '95/web/全景/CR1420250620_194948575.PHOTOSPHERE.webp', label: '全景' }];
}

const PANORAMAS = getPanoramas();
const urlP = parseInt(new URLSearchParams(location.search).get('p'), 10);
let current = Number.isInteger(urlP) && urlP >= 0 && urlP < PANORAMAS.length
  ? urlP
  : PANORAMAS.length - 1;

const loading = document.getElementById('pano-loading');
const loadingText = loading && loading.querySelector('p');
const switchBtn = document.getElementById('pano-switch');
const switchMenu = document.getElementById('pano-switch-menu');

const viewer = new Viewer({
  container: document.getElementById('viewer'),
  panorama: PANORAMAS[current].file,
  navbar: ['autorotate', 'zoom', 'fullscreen', 'gyroscope'],
  defaultZoomLvl: 50,
  minFov: 20,
  maxFov: 100,
  plugins: [
    [GyroscopePlugin, { touchmove: false }],
    [AutorotatePlugin],
  ],
});

viewer.addEventListener('ready', () => {
  loading.classList.add('hidden');
});

// setPanorama 切换后触发的是 panorama-loaded,ready 只在初始化时触发一次
viewer.addEventListener('panorama-loaded', () => {
  loading.classList.add('hidden');
});

viewer.addEventListener('error', () => {
  if (loadingText) loadingText.textContent = '全景加载失败，请刷新重试';
});

// ---- 照片切换 ----
function buildMenu() {
  switchMenu.innerHTML = '';
  PANORAMAS.forEach((p, i) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'pano-switch-item' + (i === current ? ' active' : '');
    item.textContent = p.label;
    item.addEventListener('click', () => select(i));
    switchMenu.appendChild(item);
  });
}

function select(i) {
  closeMenu();
  if (i === current) return;
  current = i;
  switchBtn.textContent = PANORAMAS[i].label + ' ▾';
  loading.classList.remove('hidden');
  viewer.setPanorama(PANORAMAS[i].file).catch(() => {});
  buildMenu();
}

function closeMenu() {
  switchMenu.hidden = true;
}

switchBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  buildMenu();
  switchMenu.hidden = !switchMenu.hidden;
});

document.addEventListener('click', (e) => {
  if (!switchMenu.hidden && !switchMenu.contains(e.target) && e.target !== switchBtn) {
    closeMenu();
  }
});

switchBtn.textContent = PANORAMAS[current].label + ' ▾';
buildMenu();
