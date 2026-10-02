// =====================================================================
// word-export.js —— 从网站所有 HTML 页面提取全部可见文字，生成 Word 文档
// 输出：
//   1. CHU.LIFE-网站文字整理.docx（供用户修改）
//   2. scripts/word-sync-map.json（编号 → 文件/偏移映射，供回写使用）
// 用法：node scripts/word-export.js
// =====================================================================
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, HeadingLevel, ShadingType,
} = require('docx');

const ROOT = path.resolve(__dirname, '..');

const PAGES = [
  { file: 'index.html', title: '首页 · index.html' },
  { file: 'photo.html', title: '摄影作品页 · photo.html' },
  { file: 'security.html', title: '安全认证页 · security.html' },
  { file: 'projects/modular-diary.html', title: 'codiary 产品页 · projects/modular-diary.html' },
  { file: 'projects/mj.html', title: 'MJ 产品页 · projects/mj.html' },
  { file: 'projects/vip.html', title: '神秘入口页 · projects/vip.html' },
  { file: 'projects/yanshuai.html', title: '闫帅 VIP 页 · projects/yanshuai.html' },
];

const SKIP_TAGS = new Set(['script', 'style', 'textarea', 'template', 'noscript']);
const VOID_TAGS = new Set(['img', 'br', 'meta', 'link', 'input', 'hr', 'source', 'wbr']);
const ATTR_RE = /(alt|title|placeholder|aria-label)\s*=\s*"([^"]*)"/gi;
const CLS_RE = /class\s*=\s*"([^"]*)"/i;
const ID_RE = /id\s*=\s*"([^"]*)"/i;

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, '\u00a0');
}

// 扫描单个 HTML 文件，返回文字条目数组
function scanHtml(html, file) {
  const entries = [];
  const stack = []; // { tag, loc, parts:[{raw,start,end}], dirty }
  let i = 0;
  const n = html.length;

  const pushEntry = (kind, loc, text, raw, start, end, attr) => {
    const t = text.trim();
    if (!t) return;
    if (!/[\p{L}\p{N}]/u.test(t)) return; // 纯装饰符号（箭头/emoji 单独出现）不收入
    entries.push({
      file, kind, loc, attr: attr || '',
      text: t, raw, start, end,
    });
  };

  const flushParts = (frame) => {
    for (const p of frame.parts) {
      pushEntry('text', frame.loc, decodeEntities(p.raw), p.raw, p.start, p.end);
    }
    frame.parts = [];
  };

  const tagRe = /^<(\/?)([A-Za-z][A-Za-z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/;

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      if (stack.length && html.slice(i).trim()) {
        stack[stack.length - 1].parts.push({ raw: html.slice(i), start: i, end: n });
      }
      break;
    }
    // 文本节点
    if (lt > i) {
      const txt = html.slice(i, lt);
      if (stack.length && txt.trim()) stack[stack.length - 1].parts.push({ raw: txt, start: i, end: lt });
    }
    // 注释
    if (html.startsWith('<!--', lt)) {
      const ce = html.indexOf('-->', lt + 4);
      i = ce === -1 ? n : ce + 3;
      continue;
    }
    const m = tagRe.exec(html.slice(lt));
    if (!m) { i = lt + 1; continue; }
    const full = m[0];
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrsStr = m[3];
    const selfClose = m[4] === '/' || VOID_TAGS.has(tag);

    if (closing) {
      if (stack.length) {
        const frame = stack.pop();
        if (frame.parts.length && !frame.dirty) {
          // 叶元素：内容无任何子标签，整体作为一条（范围覆盖全部内容文本）
          const s = frame.parts[0].start;
          const e = frame.parts[frame.parts.length - 1].end;
          pushEntry('text', frame.loc, decodeEntities(html.slice(s, e)), html.slice(s, e), s, e);
        } else if (frame.parts.length) {
          flushParts(frame);
        }
        if (stack.length) stack[stack.length - 1].dirty = true;
      }
      i = lt + full.length;
      continue;
    }

    // ---- 开标签 ----
    if (SKIP_TAGS.has(tag)) {
      const openEnd = lt + full.length;
      const closeIdx = html.toLowerCase().indexOf('</' + tag, openEnd);
      i = closeIdx === -1 ? n : closeIdx;
      continue;
    }

    // 属性文字（alt / title / placeholder / aria-label）
    ATTR_RE.lastIndex = 0;
    let am;
    // attrsStr 在整标签内的偏移：'<' + 可选'/' + tag 名
    const attrsStart = lt + m[1].length + m[2].length;
    while ((am = ATTR_RE.exec(attrsStr))) {
      const name = am[1];
      const val = am[2];
      if (!val.trim()) continue;
      const nameIdx = attrsStr.toLowerCase().indexOf(name.toLowerCase(), am.index);
      const qpos = attrsStr.indexOf('"', nameIdx + name.length);
      const valStart = attrsStart + qpos + 1;
      const valEnd = valStart + val.length;
      let loc = tag;
      const idM = ID_RE.exec(attrsStr); if (idM) loc += '#' + idM[1];
      const clsM = CLS_RE.exec(attrsStr); if (clsM) loc += '.' + clsM[1].split(/\s+/)[0];
      pushEntry('attr', loc, decodeEntities(val), val, valStart, valEnd, name);
    }

    if (tag === 'br' || selfClose) {
      if (stack.length) { const top = stack[stack.length - 1]; top.dirty = true; flushParts(top); }
      i = lt + full.length;
      continue;
    }

    let loc = tag;
    const idM = ID_RE.exec(attrsStr); if (idM) loc += '#' + idM[1];
    const clsM = CLS_RE.exec(attrsStr); if (clsM) loc += '.' + clsM[1].split(/\s+/)[0];
    stack.push({ tag, loc, parts: [], dirty: false });
    i = lt + full.length;
  }
  return entries;
}

// ---------- 汇总 ----------
const all = [];
for (const page of PAGES) {
  const filePath = path.join(ROOT, page.file);
  const html = fs.readFileSync(filePath, 'utf8');
  const entries = scanHtml(html, page.file);
  entries.forEach((e, idx) => {
    e.page = page.title;
    e.id = 'T' + String(all.length + 1).padStart(4, '0');
    all.push(e);
  });
  console.log(`[ok] ${page.file}: ${entries.length} 条文字`);
}
console.log(`[total] ${all.length} 条`);

// ---------- 生成 Word ----------
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const TABLE_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

// 把文本切成多个 run：emoji 单独用系统 emoji 字体（避免方框/问号占位符）
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}](?:\u{FE0F}|\u{200D}[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}])*/gu;
const EMOJI_FONT = { ascii: 'Segoe UI Emoji', hAnsi: 'Segoe UI Emoji', eastAsia: 'Segoe UI Emoji' };

function runsFromText(text, size, color, bold) {
  const out = [];
  let last = 0;
  let m;
  EMOJI_RE.lastIndex = 0;
  while ((m = EMOJI_RE.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), size, color, bold: !!bold }));
    out.push(new TextRun({ text: m[0], size, color, bold: !!bold, font: EMOJI_FONT }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), size, color, bold: !!bold }));
  return out;
}

function cell(text, widthPct, opts = {}) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { line: 264 },
      children: text
        ? runsFromText(text, opts.size || 18, opts.color || '333333', opts.bold)
        : [new TextRun({ text: '', size: 18 })],
    })],
  });
}

function pageTable(pageTitle, entries) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell('编号', 8, { center: true, shading: 'EEEEEE', bold: true, size: 18 }),
        cell('位置', 18, { shading: 'EEEEEE', bold: true, size: 18 }),
        cell('原文', 44, { shading: 'EEEEEE', bold: true, size: 18 }),
        cell('修改后文字（在此填写；不修改请留空）', 30, { shading: 'EEEEEE', bold: true, size: 18 }),
      ],
    }),
  ];
  for (const e of entries) {
    const loc = e.kind === 'attr' ? `${e.loc} 的 ${e.attr} 属性` : e.loc;
    rows.push(new TableRow({
      children: [
        cell(e.id, 8, { center: true, size: 16, color: '777777' }),
        cell(loc, 18, { size: 16, color: '555555' }),
        cell(e.text, 44, { size: 18 }),
        cell('', 30, { size: 18 }),
      ],
    }));
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows });
}

const children = [
  new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'CHU.LIFE 网站文字整理', bold: true, size: 44 })],
  }),
  new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: '修改说明（请先阅读）', bold: true, size: 24 })] }),
  new Paragraph({ spacing: { line: 300 }, children: [new TextRun({ text: '1. 本文档收录了网站 7 个页面上的全部文字，按页面分节、以表格列出。', size: 20 })] }),
  new Paragraph({ spacing: { line: 300 }, children: [new TextRun({ text: '2. 每一行对应网页中的一处文字：「编号」用于定位（请勿修改编号列），「位置」说明它出现在页面的哪个元素里，「原文」是当前网页上的文字。', size: 20 })] }),
  new Paragraph({ spacing: { line: 300 }, children: [new TextRun({ text: '3. 修改方式：请在最后一列「修改后文字」中填写新的文字；不修改的条目请留空。也可以直接修改「原文」列的文字（两处都改了时，以「修改后文字」列为准）。', size: 20 })] }),
  new Paragraph({ spacing: { line: 300 }, children: [new TextRun({ text: '4. 改完保存文档，然后把文件发回给我，我会逐条把改动同步回对应的网页文件中。', size: 20 })] }),
  new Paragraph({ spacing: { before: 200, line: 280 }, children: [new TextRun({ text: `共 ${all.length} 处文字，涉及 7 个页面。`, size: 20, color: '666666', italics: true })] }),
];

for (const page of PAGES) {
  const entries = all.filter((e) => e.page === page.title);
  if (!entries.length) continue;
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text: page.title, size: 28, bold: true })],
  }));
  children.push(pageTable(page.title, entries));
}

const doc = new Document({
  styles: {
    default: {
      document: {
        // 不显式指定字体：让 Word/WPS 使用默认字体（等线 + Calibri），
        // emoji 才能自动回退到系统的 Segoe UI Emoji 正常显示
        run: { size: 20 },
      },
    },
  },
  sections: [{ properties: {}, children }],
});

const OUT_DOCX = path.join(ROOT, 'CHU.LIFE-网站文字整理.docx');
const OUT_MAP = path.join(__dirname, 'word-sync-map.json');
const MAP_ONLY = process.argv.includes('--map-only');

function saveMap() {
  fs.writeFileSync(OUT_MAP, JSON.stringify({
    version: 1,
    generated: new Date().toISOString(),
    docx: 'CHU.LIFE-网站文字整理.docx',
    entries: Object.fromEntries(all.map((e) => [e.id, {
      file: e.file, kind: e.kind, loc: e.loc, attr: e.attr, text: e.text, raw: e.raw, start: e.start, end: e.end,
    }])),
  }, null, 2), 'utf8');
  console.log(`[done] 映射文件: ${OUT_MAP}`);
}

if (MAP_ONLY) {
  saveMap();
  return;
}

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT_DOCX, buf);
  saveMap();
  console.log(`[done] Word 文档: ${OUT_DOCX}`);
}).catch((err) => { console.error(err); process.exit(1); });
