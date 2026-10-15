/* News At Noire — tiny Markdown <-> HTML helpers for the Writers' Desk and essay pages. */
(function () {
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function safeUrl(u) { u = u.trim(); return /^(https?:|mailto:|\/|#|[\w-]+\.html)/i.test(u) ? u : '#'; }

  function inline(s) {
    var keep = []; s = s.replace(/\\([\\*_\[\]()#>`-])/g, function (_, c) { keep.push(c); return '\u0000' + (keep.length - 1) + '\u0000'; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, a, u) { return '<img src="' + safeUrl(u) + '" alt="' + a + '" loading="lazy">'; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) { u = safeUrl(u); return '<a href="' + u + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');
    s = s.replace(/ {2,}\n|\n/g, '<br>');
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return esc(keep[+i]); });
  }

  function mdToHtml(md) {
    var out = [], blocks = md.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
    blocks.forEach(function (b) {
      var m;
      if (/^(-{3,}|\*{3,})$/.test(b.trim())) return out.push('<hr>');
      if ((m = b.match(/^(#{1,4})\s+(.*)$/)) && b.indexOf('\n') < 0) { var lv = Math.min(4, Math.max(2, m[1].length + (m[1].length === 1 ? 1 : 0))); return out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'); }
      if (/^>/.test(b)) return out.push('<blockquote>' + mdToHtml(b.replace(/^> ?/gm, '')) + '</blockquote>');
      var lines = b.split('\n');
      if (lines.every(function (l) { return /^\s*[-*+]\s+/.test(l); })) return out.push('<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*[-*+]\s+/, '')) + '</li>'; }).join('') + '</ul>');
      if (lines.every(function (l) { return /^\s*\d+[.)]\s+/.test(l); })) return out.push('<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; }).join('') + '</ol>');
      out.push('<p>' + inline(b) + '</p>');
    });
    return out.join('\n');
  }

  function htmlToMd(root) {
    function escTxt(t) { return t.replace(/\\/g, '\\\\').replace(/([*_\[\]])/g, '\\$1'); }
    function inl(n) {
      var s = '';
      n.childNodes.forEach(function (c) {
        if (c.nodeType === 3) { s += escTxt(c.nodeValue.replace(/\s+/g, ' ')); return; }
        if (c.nodeType !== 1) return;
        var t = c.tagName, inner = inl(c);
        if (t === 'BR') s += '  \n';
        else if (t === 'STRONG' || t === 'B') s += inner.trim() ? '**' + inner.trim() + '**' : '';
        else if (t === 'EM' || t === 'I') s += inner.trim() ? '*' + inner.trim() + '*' : '';
        else if (t === 'A') s += '[' + inner + '](' + (c.getAttribute('href') || '#') + ')';
        else s += inner;
      });
      return s;
    }
    var out = [];
    function block(n) {
      if (n.nodeType === 3) { var tx = n.nodeValue.trim(); if (tx) out.push(escTxt(tx)); return; }
      if (n.nodeType !== 1) return;
      var t = n.tagName, txt;
      if (/^H[1-6]$/.test(t)) { txt = inl(n).trim(); if (txt) out.push((t === 'H3' || t === 'H4' ? '### ' : '## ') + txt); }
      else if (t === 'BLOCKQUOTE') { var save = out; out = []; n.childNodes.forEach(block); if (!out.length) { txt = inl(n).trim(); if (txt) out.push(txt); } var q = out.join('\n\n'); out = save; if (q) out.push(q.split('\n').map(function (l) { return '> ' + l; }).join('\n')); }
      else if (t === 'UL' || t === 'OL') { var i = 0, items = []; n.querySelectorAll(':scope > li').forEach(function (li) { txt = inl(li).trim(); if (txt) items.push((t === 'OL' ? (++i) + '. ' : '- ') + txt); }); if (items.length) out.push(items.join('\n')); }
      else if (t === 'HR') out.push('---');
      else if (t === 'DIV' && n.querySelector('p,h1,h2,h3,h4,blockquote,ul,ol,div')) n.childNodes.forEach(block);
      else { txt = inl(n).replace(/\s+$/, '').replace(/^\s+/, ''); if (txt) out.push(txt); }
    }
    root.childNodes.forEach(block);
    return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  window.NoireMD = { mdToHtml: mdToHtml, htmlToMd: htmlToMd, escape: esc };
})();
