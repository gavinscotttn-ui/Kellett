/* ============================================================
   A small PDF writer.

   Enough of PDF 1.4 to produce a proper board paper: A4 pages,
   the two Helvetica faces, headings, paragraphs, rules, key/value
   blocks and tables, with a running header and page numbers.

   Written by hand because the whole application has to work from
   a single file with no network, and a library would be neither.
   ============================================================ */

(function (KH) {
  'use strict';

  var PAGE = { w: 595.28, h: 841.89 };          // A4 in points
  var M = { top: 64, bottom: 58, left: 52, right: 52 };
  var CONTENT_W = PAGE.w - M.left - M.right;

  /* WinAnsi has most of what a British board paper needs; anything
     else is transliterated rather than silently dropped. */
  var WINANSI = {
    '£': '\\243', '€': '\\200', '©': '\\251', '®': '\\256',
    '—': '\\227', '–': '\\226', '‘': '\\221', '’': '\\222',
    '“': '\\223', '”': '\\224', '•': '\\225', '…': '\\205',
    '·': '\\267', '°': '\\260', '½': '\\275', 'é': '\\351',
    'è': '\\350', 'ç': '\\347', 'ñ': '\\361', 'ü': '\\374',
    'ö': '\\366', 'ä': '\\344', '▲': '+', '▼': '-', '▬': '=',
    ' ': ' '
  };

  function esc(text) {
    var out = '';
    String(text === null || text === undefined ? '' : text).split('').forEach(function (ch) {
      if (ch === '(' || ch === ')' || ch === '\\') { out += '\\' + ch; return; }
      var code = ch.charCodeAt(0);
      if (WINANSI[ch]) { out += WINANSI[ch]; return; }
      if (code < 32) { out += ' '; return; }
      if (code < 127) { out += ch; return; }
      if (code < 256) { out += '\\' + ('000' + code.toString(8)).slice(-3); return; }
      out += '?';
    });
    return out;
  }

  /* Helvetica advance widths, in 1/1000 em. Enough to wrap text and
     right-align a column of figures without guessing. */
  var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  function widthOf(text, size, bold) {
    var table = bold ? W_BOLD : W_REG;
    var total = 0;
    String(text).split('').forEach(function (ch) {
      var c = ch.charCodeAt(0);
      var w = (c >= 32 && c <= 126) ? table[c - 32] : 556;
      total += w;
    });
    return (total / 1000) * size;
  }

  function wrap(text, size, bold, maxWidth) {
    var words = String(text).split(/\s+/).filter(Boolean);
    var lines = [], line = '';
    words.forEach(function (w) {
      var candidate = line ? line + ' ' + w : w;
      if (widthOf(candidate, size, bold) <= maxWidth || !line) line = candidate;
      else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /* ============================================================
     The document
     ============================================================ */

  function create(opts) {
    opts = opts || {};
    var pages = [];
    var ops = [];
    var y = 0;

    var meta = {
      title: opts.title || 'Report',
      subtitle: opts.subtitle || '',
      org: opts.org || 'Kellett Holdings',
      footer: opts.footer || 'Privileged & Confidential — Internal distribution only'
    };

    function newPage() {
      if (ops.length) pages.push(ops.join('\n'));
      ops = [];
      y = PAGE.h - M.top;
      header();
    }

    function text(str, x, yy, size, bold, grey) {
      ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' +
        (grey === undefined ? '0 0 0' : grey + ' ' + grey + ' ' + grey) + ' rg ' +
        x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + esc(str) + ') Tj ET');
    }

    function line(x1, y1, x2, y2, grey, w) {
      ops.push((grey === undefined ? 0.8 : grey) + ' ' + (grey === undefined ? 0.8 : grey) + ' ' +
        (grey === undefined ? 0.8 : grey) + ' RG ' + (w || 0.6) + ' w ' +
        x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S');
    }

    function rect(x, yy, w, hh, grey) {
      ops.push(grey + ' ' + grey + ' ' + grey + ' rg ' +
        x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + hh.toFixed(2) + ' re f');
    }

    function header() {
      text(meta.org.toUpperCase(), M.left, PAGE.h - 38, 8, true, 0.45);
      var right = meta.title;
      text(right, PAGE.w - M.right - widthOf(right, 8, false), PAGE.h - 38, 8, false, 0.55);
      line(M.left, PAGE.h - 46, PAGE.w - M.right, PAGE.h - 46, 0.75);
    }

    function need(h) {
      if (y - h < M.bottom) newPage();
    }

    /* ---------- Public composition API ---------- */

    var api = {};

    api.title = function (str, sub) {
      need(74);
      text(str, M.left, y - 20, 20, true);
      y -= 30;
      if (sub) { text(sub, M.left, y - 10, 9.5, false, 0.4); y -= 18; }
      line(M.left, y, PAGE.w - M.right, y, 0.6, 1.2);
      y -= 20;
      return api;
    };

    api.heading = function (str) {
      need(40);
      y -= 8;
      text(str, M.left, y - 12, 12, true);
      y -= 20;
      line(M.left, y, PAGE.w - M.right, y, 0.85);
      y -= 12;
      return api;
    };

    api.para = function (str, size) {
      var s = size || 9.5;
      wrap(str, s, false, CONTENT_W).forEach(function (l) {
        need(s + 5);
        text(l, M.left, y - s, s, false, 0.18);
        y -= s + 4.4;
      });
      y -= 5;
      return api;
    };

    api.note = function (str) {
      wrap(str, 8.5, false, CONTENT_W).forEach(function (l) {
        need(14);
        text(l, M.left, y - 8.5, 8.5, false, 0.48);
        y -= 12.5;
      });
      y -= 4;
      return api;
    };

    api.kv = function (pairs, cols) {
      var n = cols || 2;
      var colW = CONTENT_W / n;
      var i = 0;
      pairs.forEach(function (p) {
        var col = i % n;
        if (col === 0) need(26);
        var x = M.left + col * colW;
        text(String(p[0]).toUpperCase(), x, y - 8, 7, false, 0.5);
        text(String(p[1]), x, y - 20, 11, true);
        i += 1;
        if (col === n - 1) y -= 30;
      });
      if (i % n !== 0) y -= 30;
      y -= 4;
      return api;
    };

    /** cols: [{ label, width (0-1), align }] ; rows: array of arrays */
    api.table = function (cols, rows) {
      var widths = cols.map(function (c) { return (c.width || 1 / cols.length) * CONTENT_W; });

      function headRow() {
        need(24);
        rect(M.left, y - 15, CONTENT_W, 17, 0.93);
        var x = M.left;
        cols.forEach(function (c, i) {
          var label = String(c.label).toUpperCase();
          var tx = c.align === 'right' ? x + widths[i] - widthOf(label, 7, true) - 5 : x + 5;
          text(label, tx, y - 10, 7, true, 0.35);
          x += widths[i];
        });
        y -= 20;
      }

      headRow();
      rows.forEach(function (row, ri) {
        need(18);
        if (y > PAGE.h - M.top - 4) headRow();
        if (ri % 2 === 1) rect(M.left, y - 12, CONTENT_W, 15, 0.975);
        var x = M.left;
        row.forEach(function (cell, i) {
          if (i >= cols.length) return;
          var str = String(cell === null || cell === undefined ? '' : cell);
          var bold = !!cols[i].bold;
          var maxW = widths[i] - 10;
          while (widthOf(str, 8.5, bold) > maxW && str.length > 3) str = str.slice(0, -2) + '…';
          var tx = cols[i].align === 'right' ? x + widths[i] - widthOf(str, 8.5, bold) - 5 : x + 5;
          text(str, tx, y - 8, 8.5, bold, 0.15);
          x += widths[i];
        });
        y -= 15;
      });
      line(M.left, y + 2, PAGE.w - M.right, y + 2, 0.85);
      y -= 12;
      return api;
    };

    api.spacer = function (h) { y -= (h || 10); return api; };

    api.rule = function () { need(12); line(M.left, y, PAGE.w - M.right, y, 0.85); y -= 12; return api; };

    api.signature = function (name, role) {
      need(70);
      y -= 24;
      line(M.left, y, M.left + 200, y, 0.5);
      y -= 12;
      text(name, M.left, y, 9.5, true);
      y -= 12;
      if (role) text(role, M.left, y, 8.5, false, 0.45);
      y -= 12;
      return api;
    };

    /* ---------- Assembly ---------- */

    function build() {
      if (ops.length) pages.push(ops.join('\n'));
      if (!pages.length) pages.push('');

      // Footers are stamped once the page count is known.
      var stamped = pages.map(function (content, i) {
        var label = meta.footer;
        var num = 'Page ' + (i + 1) + ' of ' + pages.length;
        var foot = 'BT /F1 7 Tf 0.5 0.5 0.5 rg ' + M.left + ' ' + (M.bottom - 22) + ' Td (' + esc(label) + ') Tj ET\n' +
          'BT /F1 7 Tf 0.5 0.5 0.5 rg ' + (PAGE.w - M.right - widthOf(num, 7, false)).toFixed(2) + ' ' + (M.bottom - 22) + ' Td (' + esc(num) + ') Tj ET\n' +
          '0.85 0.85 0.85 RG 0.6 w ' + M.left + ' ' + (M.bottom - 10) + ' m ' + (PAGE.w - M.right) + ' ' + (M.bottom - 10) + ' l S';
        return content + '\n' + foot;
      });

      var objects = [];
      function add(body) { objects.push(body); return objects.length; }   // 1-indexed

      var fontReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      var fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

      /* The page tree's object number is not known until its children
         exist, so pages reference it by token and it is resolved once.
         Patching by number would risk rewriting an unrelated reference
         that happened to share the digits. */
      var PARENT = '%%PAGES%%';
      var pageIds = [];
      stamped.forEach(function (content) {
        var streamId = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
        var pageId = add('<< /Type /Page /Parent ' + PARENT + ' /MediaBox [0 0 ' + PAGE.w.toFixed(2) + ' ' + PAGE.h.toFixed(2) +
          '] /Resources << /Font << /F1 ' + fontReg + ' 0 R /F2 ' + fontBold + ' 0 R >> >> /Contents ' + streamId + ' 0 R >>');
        pageIds.push(pageId);
      });

      var realPagesId = add('<< /Type /Pages /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') +
        '] /Count ' + pageIds.length + ' >>');
      objects = objects.map(function (o) { return o.split(PARENT).join(realPagesId + ' 0 R'); });

      var infoId = add('<< /Title (' + esc(meta.title) + ') /Author (' + esc(meta.org) +
        ') /Creator (' + esc(meta.org + ' Workspace') + ') /Producer (' + esc(meta.org + ' Workspace') + ') >>');
      var catalogId = add('<< /Type /Catalog /Pages ' + realPagesId + ' 0 R >>');

      var out = '%PDF-1.4\n%âãÏÓ\n';
      var offsets = [0];
      objects.forEach(function (body, i) {
        offsets.push(out.length);
        out += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
      });
      var xref = out.length;
      out += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
      for (var i = 1; i <= objects.length; i++) {
        out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
      }
      out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogId + ' 0 R /Info ' + infoId +
        ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
      return out;
    }

    api.blob = function () {
      var str = build();
      var bytes = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
      return new Blob([bytes], { type: 'application/pdf' });
    };

    api.save = function (filename) {
      var blob = api.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || (meta.title.replace(/[^\w.-]+/g, '_') + '.pdf');
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
      return api;
    };

    newPage();
    return api;
  }

  KH.pdf = { create: create, widthOf: widthOf, wrap: wrap };
})(window.KH);
