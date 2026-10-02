// 360° 全景浏览 — 入口(打包进 psv.bundle.js)
import { Viewer } from '@photo-sphere-viewer/core';
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';

const loading = document.getElementById('pano-loading');
const loadingText = loading && loading.querySelector('p');

const viewer = new Viewer({
  container: document.getElementById('viewer'),
  panorama: 'CR1420250620_194948575.PHOTOSPHERE.jpg',
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

viewer.addEventListener('error', () => {
  if (loadingText) loadingText.textContent = '全景加载失败，请刷新重试';
});
