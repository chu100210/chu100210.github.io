// =====================================================================
// optimize-images.js —— 生成网页用的压缩版图片(不改动原图)
// 用法:node scripts/optimize-images.js
// 输出:
//   wbbg/opt/*.webp         五班页面轮播用的压缩图(最长边 1920、质量 78)
//   images/opt/*.webp       首页卡片/首屏用的压缩图
// 原图保持不动,灯箱仍用原图
// =====================================================================
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

const TASKS = [];

// 五班背景照片:wbbg/*.jpg → wbbg/opt/*.webp
const wbbgDir = path.join(ROOT, 'wbbg');
if (fs.existsSync(wbbgDir)) {
  fs.readdirSync(wbbgDir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .forEach((f) => {
      TASKS.push({
        src: `wbbg/${f}`,
        out: `wbbg/opt/${f.replace(/\.(jpe?g|png)$/i, '.webp')}`,
        width: 1920,
        quality: 78,
      });
    });
}

// 首页用图(名字不变,输出到 images/opt/)
const INDEX_IMAGES = [
  { src: 'images/photo/IMG_20250807_151850_1784626771606edit.webp', width: 1920, quality: 76 },
  { src: 'images/photo/CR1420250628_164245153.webp', width: 900, quality: 74 },
  { src: 'images/photo/IMG_20260502_140541.webp', width: 900, quality: 74 },
  { src: 'images/photo/CR1420250628_161915809.webp', width: 900, quality: 74 },
];
INDEX_IMAGES.forEach((it) => {
  TASKS.push({
    src: it.src,
    out: it.src.replace('images/photo/', 'images/opt/'),
    width: it.width,
    quality: it.quality,
  });
});

function kb(n) {
  return (n / 1024).toFixed(0) + 'KB';
}

(async () => {
  let savedBytes = 0;
  let savedCount = 0;

  for (const t of TASKS) {
    const srcPath = path.join(ROOT, t.src);
    const outPath = path.join(ROOT, t.out);
    if (!fs.existsSync(srcPath)) {
      console.log(`跳过(源文件不存在):${t.src}`);
      continue;
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const srcStat = fs.statSync(srcPath);
    // 已存在且不旧于源文件 → 跳过
    if (fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= srcStat.mtimeMs) {
      console.log(`已是最新:${t.out}`);
      continue;
    }

    await sharp(srcPath)
      .rotate()
      .resize({ width: t.width, withoutEnlargement: true })
      .webp({ quality: t.quality, effort: 5 })
      .toFile(outPath);

    const outStat = fs.statSync(outPath);
    savedBytes += srcStat.size - outStat.size;
    savedCount++;
    console.log(`${t.src}  ${kb(srcStat.size)} → ${t.out}  ${kb(outStat.size)}`);
  }

  console.log(`\n完成:${savedCount} 张,共节省 ${(savedBytes / 1048576).toFixed(2)} MB`);
})();
