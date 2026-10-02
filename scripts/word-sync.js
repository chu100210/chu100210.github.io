// =====================================================================
// word-sync.js —— 读取用户修改后的 Word 文档，把改动同步回各 HTML 文件
// 用法：node scripts/word-sync.js [Word文档路径]
//   默认读取 d:\myweb\CHU.LIFE-网站文字整理.docx
// 规则：
//   - 表格第 4 列「修改后文字」非空 → 以它为准
//   - 否则若「原文」列与网页现状不同 → 视为用户在原文列直接修改
//   - 替换前会校验 HTML 中对应位置仍是原文字，不一致则跳过并提示
// =====================================================================
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const convert = require('xml-js');

const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(__dirname, 'word-sync-map.json');
const DEFAULT_DOCX = path.join(ROOT, 'CHU.LIFE-网站文字整理.docx');

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function collectTexts(node, out) {
  if (!node) return;
  if (node.type === 'text') { out.push(node.text || ''); return; }
  if (Array.isArray(node.elements)) node.elements.forEach((e) => collectTexts(e, out));
}

// 提取表格中一个单元格的文本（多个段落以 \n 连接）
function getCellText(tc) {
  const paras = (tc.elements || []).filter((e) => e.name === 'w:p');
  return paras
    .map((p) => { const t = []; collectTexts(p, t); return t.join(''); })
    .join('\n')
    .trim();
}

async function main() {
  const docxPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DOCX;
  if (!fs.existsSync(docxPath)) {
    console.error(`找不到 Word 文档: ${docxPath}`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

  const buf = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(buf);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) {
    console.error('该文件不是有效的 docx（缺少 word/document.xml）');
    process.exit(1);
  }
  const xml = await xmlFile.async('string');
  const obj = convert.xml2js(xml, { compact: false });

  // 收集所有表格行（跳过每张表的表头行：编号/位置/原文/修改后文字）
  const changes = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node.elements)) {
      for (const el of node.elements) {
        if (el.name === 'w:tbl') {
          const trs = (el.elements || []).filter((e) => e.name === 'w:tr');
          trs.slice(1).forEach((tr) => {
            const tcs = (tr.elements || []).filter((e) => e.name === 'w:tc');
            if (tcs.length < 4) return;
            const id = getCellText(tcs[0]);
            const origCell = getCellText(tcs[2]);
            const newCell = getCellText(tcs[3]);
            changes.push({ id, origCell, newCell });
          });
        } else {
          walk(el);
        }
      }
    }
  };
  walk(obj);

  // 对照映射文件
  const perFile = new Map(); // file -> [{id, oldText, newText}]
  const conflicts = [];
  let skippedEmpty = 0;
  for (const c of changes) {
    const id = c.id.trim();
    if (!id) continue;
    const meta = map.entries[id];
    if (!meta) { conflicts.push(`编号 ${id} 不在映射表中，已跳过`); continue; }
    let newText = c.newCell;
    if (!newText) {
      if (c.origCell && c.origCell !== meta.text) newText = c.origCell;
      else { skippedEmpty++; continue; }
    }
    newText = newText.trim();
    if (!newText || newText === meta.text) { skippedEmpty++; continue; }

    if (!perFile.has(meta.file)) perFile.set(meta.file, []);
    perFile.get(meta.file).push({
      id, loc: meta.loc, attr: meta.attr, kind: meta.kind,
      oldText: meta.text, newText, raw: meta.raw, start: meta.start, end: meta.end,
    });
  }

  // 逐个文件应用（先统一读取，逐条校验偏移）
  const files = {};
  for (const [file, items] of perFile) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) { conflicts.push(`文件不存在: ${file}`); continue; }
    files[file] = fs.readFileSync(filePath, 'utf8');
  }

  const applied = [];
  const report = [];
  for (const [file, items] of perFile) {
    if (!files[file]) continue;
    let html = files[file];
    // 按偏移倒序应用：避免前面的修改改变文件长度导致后面条目偏移失效
    const sorted = [...items].sort((a, b) => b.start - a.start);
    for (const it of sorted) {
      const replacement = it.kind === 'attr'
        ? escapeAttr(it.newText.replace(/\n/g, ' '))
        : escapeText(it.newText).replace(/\n/g, '<br>');

      const current = html.slice(it.start, it.end);
      if (current === it.raw) {
        html = html.slice(0, it.start) + replacement + html.slice(it.end);
        applied.push({ file, id: it.id, loc: it.loc, oldText: it.oldText, newText: it.newText });
        report.push(`[应用] ${file} ${it.id} (${it.loc}):\n   旧: ${it.oldText}\n   新: ${it.newText}`);
        continue;
      }
      if (current === replacement) {
        report.push(`[跳过] ${file} ${it.id} (${it.loc}): 该修改已应用过`);
        continue;
      }
      // 偏移已失效：尝试在文件中重新定位唯一出现的原文字
      const first = html.indexOf(it.raw);
      if (it.raw && first !== -1 && html.indexOf(it.raw, first + 1) === -1) {
        html = html.slice(0, first) + replacement + html.slice(first + it.raw.length);
        applied.push({ file, id: it.id, loc: it.loc, oldText: it.oldText, newText: it.newText });
        report.push(`[应用(重定位)] ${file} ${it.id} (${it.loc}):\n   旧: ${it.oldText}\n   新: ${it.newText}`);
        continue;
      }
      conflicts.push(`[${file}] ${it.id}（${it.loc}）：网页中该处文字已变化且无法自动定位，请手动处理`);
    }
    files[file] = html;
  }

  for (const file of Object.keys(files)) {
    fs.writeFileSync(path.join(ROOT, file), files[file], 'utf8');
  }

  console.log('========== 同步结果 ==========');
  if (report.length) {
    console.log(report.join('\n'));
  } else {
    console.log('未发现需要同步的修改。');
  }
  console.log('------------------------------');
  console.log(`共应用 ${applied.length} 处修改，涉及 ${Object.keys(files).length} 个文件`);
  console.log(`跳过 ${skippedEmpty} 条（未填写修改内容或与原文字相同）`);
  if (conflicts.length) {
    console.log(`\n⚠ 有 ${conflicts.length} 处冲突：`);
    conflicts.forEach((c) => console.log('  - ' + c));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
