// 360° 全景浏览 — 入口(打包进 psv.bundle.js)
import { Viewer } from '@photo-sphere-viewer/core';
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

// 全景照片列表(新增照片只需在末尾追加一项)
const PANORAMAS = [
  { file: 'CR1420250620_193454059.PHOTOSPHERE.jpg', label: '2025-06-20 19:34' },
  { file: 'CR1420250620_194948575.PHOTOSPHERE.jpg', label: '2025-06-20 19:48' },
];

const loading = document.getElementById('pano-loading');
const loadingText = loading && loading.querySelector('p');
const switchBtn = document.getElementById('pano-switch');
const switchMenu = document.getElementById('pano-switch-menu');

let current = PANORAMAS.length - 1;

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
