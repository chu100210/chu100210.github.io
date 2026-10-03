// 压缩 95/photo 照片为 WebP(全尺寸高画质 + 960px 缩略图),并生成 js/95-data.js
// 用法: node scripts/compress-95.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, '95', 'photo');
const OUT = path.join(ROOT, '95', 'web');
const THUMB_DIR = path.join(OUT, 'thumb');
const DATA_FILE = path.join(ROOT, 'js', '95-data.js');

const CATS = [
  { key: 'geren', dir: '个人', name: '个人', quality: 88 },
  { key: 'jiti', dir: '集体', name: '集体', quality: 88 },
  { key: 'laoshi', dir: '老师', name: '老师', quality: 88 },
  { key: 'biye', dir: '毕业后', name: '毕业后', quality: 88 },
  { key: 'xianzhuang', dir: '现状', name: '现状', quality: 88, now: true },
  { key: 'pano', dir: '全景', name: '全景', quality: 90, pano: true },
];

const IMG_RE = /\.(jpe?g|png)$/i;

function human(mb) {
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(mb * 1024)} KB`;
}

async function main() {
  const result = { categories: [] };
  let totalIn = 0;
  let totalOut = 0;

  for (const cat of CATS) {
    const dir = path.join(SRC, cat.dir);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => IMG_RE.test(f)).sort();
    if (!files.length) continue;

    const outDir = path.join(OUT, cat.dir);
    const thumbDir = path.join(THUMB_DIR, cat.dir);
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(thumbDir, { recursive: true });

    const outFiles = [];
    let catIn = 0;
    let catOut = 0;

    for (const f of files) {
      const base = f.replace(IMG_RE, '') + '.webp';
      const srcPath = path.join(dir, f);
      const srcSize = fs.statSync(srcPath).size;
      catIn += srcSize;

      // 全尺寸(视觉无损画质)
      await sharp(srcPath)
        .rotate()
        .webp({ quality: cat.quality, effort: 5 })
        .toFile(path.join(outDir, base));

      // 缩略图(网格展示用)
      await sharp(srcPath)
        .rotate()
        .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toFile(path.join(thumbDir, base));

      catOut += fs.statSync(path.join(outDir, base)).size + fs.statSync(path.join(thumbDir, base)).size;
      outFiles.push(base);
      process.stdout.write(`✓ ${cat.dir}/${base}\n`);
    }

    totalIn += catIn;
    totalOut += catOut;
    result.categories.push({ key: cat.key, name: cat.name, pano: !!cat.pano, now: !!cat.now, files: outFiles });
    process.stdout.write(`${cat.dir}: ${files.length} 张, ${human(catIn / 1e6)} → ${human(catOut / 1e6)}\n\n`);
  }

  const js = `// 由 scripts/compress-95.js 自动生成，请勿手动编辑
// 照片清单：95/web/ 为全尺寸 WebP，95/web/thumb/ 为缩略图
window.PHOTO95 = ${JSON.stringify(result, null, 2)};
`;
  fs.writeFileSync(DATA_FILE, js, 'utf8');

  process.stdout.write(`\n完成：总输入 ${human(totalIn / 1e6)} → 输出 ${human(totalOut / 1e6)}（体积减少 ${(100 * (1 - totalOut / totalIn)).toFixed(0)}%）\n`);
  process.stdout.write(`数据清单：${DATA_FILE}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
