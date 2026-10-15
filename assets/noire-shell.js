/* News At Noire — injects the shared header, mobile menu and footer, so every page stays in sync. */
(function () {
  window.NOIRE_API = window.NOIRE_API || 'https://newsatnoire.cxml42903.workers.dev';
  var NAV = [
    ['Essays', 'essays.html'], ['Politics', 'coming-soon.html', 1], ['History', 'coming-soon.html', 1],
    ['Culture', 'coming-soon.html', 1], ['Economics', 'coming-soon.html', 1], ['Literature', 'coming-soon.html', 1],
    ['Library', 'library.html'], ['Audio', 'coming-soon.html', 1], ['Events', 'coming-soon.html', 1]
  ];
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (here === 'closed-exit.html') here = 'library.html';
  if (here === 'essay.html') here = 'essays.html';
  var SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg>';
  var brand = '<a class="nn-brand" href="index.html">News At <em>Noire</em></a>';
  var cur = function (href) { return href === here ? ' aria-current="page"' : ''; };

  var header = '<header class="nn-header"><div class="nn-wrap"><div class="nn-row">' + brand +
    '<div class="nn-right">' +
      '<form class="nn-search" role="search" action="search.html" method="get">' + SEARCH_SVG + '<input type="search" name="q" placeholder="Search" aria-label="Search the journal" autocomplete="off"></form>' +
      '<a class="nn-cta" href="newsletter.html">Subscribe</a>' +
      '<a class="nn-icon" href="search.html" aria-label="Search">' + SEARCH_SVG + '</a>' +
      '<button class="nn-icon" type="button" data-nn-open aria-label="Open menu" aria-expanded="false" aria-controls="nn-menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="7" x2="21" y2="7"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="17" x2="21" y2="17"></line></svg></button>' +
    '</div></div>' +
    '<nav class="nn-nav" aria-label="Sections">' + NAV.map(function (n) { return '<a href="' + n[1] + '"' + cur(n[1]) + '>' + n[0] + '</a>'; }).join('') + '</nav>' +
    '</div></header>';

  var menu = '<div class="nn-menu" id="nn-menu" hidden role="dialog" aria-modal="true" aria-label="Menu">' +
    '<div class="nn-row">' + brand + '<button class="nn-icon" type="button" data-nn-close aria-label="Close menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="5" x2="19" y2="19"></line><line x1="19" y1="5" x2="5" y2="19"></line></svg></button></div>' +
    '<form role="search" action="search.html" method="get">' + SEARCH_SVG + '<input type="search" name="q" placeholder="Search the journal" aria-label="Search the journal"></form>' +
    '<nav aria-label="Sections">' + [['Home', 'index.html']].concat(NAV, [['Noire Briefing', 'newsletter.html']]).map(function (n) { return '<a href="' + n[1] + '"' + cur(n[1]) + '>' + n[0] + (n[2] ? '<small>Soon</small>' : '') + '</a>'; }).join('') + '</nav>' +
    '<a class="nn-cta" href="newsletter.html">Subscribe to the Dispatch</a></div>';

  var col = function (h, links) { return '<div class="nn-col"><h5>' + h + '</h5>' + links.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + '</a>'; }).join('') + '</div>'; };
  var footer = '<footer class="nn-footer"><div class="nn-wrap nn-cols">' +
    '<div><div class="nn-wm">News At <em>Noire</em></div><p>A Journal of Black Political Thought. Published independently.</p></div>' +
    col('Sections', [['Essays', 'essays.html'], ['Politics', 'coming-soon.html'], ['History', 'coming-soon.html'], ['Culture', 'coming-soon.html'], ['Economics', 'coming-soon.html']]) +
    col('Read', [['Literature', 'coming-soon.html', 1], ['Research Library', 'library.html'], ['Audio', 'coming-soon.html'], ['Events', 'coming-soon.html'], ['Noire Briefing', 'newsletter.html'], ['Search', 'search.html']]) +
    col('The Publication', [['About', 'coming-soon.html'], ['Masthead', 'coming-soon.html'], ['Submissions', 'coming-soon.html'], ['Writers\' Desk', 'write.html'], ['Contact', 'coming-soon.html']]) +
    '</div><div class="nn-bottom"><div class="nn-wrap"><span>© ' + new Date().getFullYear() + ' News At Noire</span><span>newsatnoire.com</span></div></div></footer>';

  var h = document.querySelector('[data-nn-header]'); if (h) h.outerHTML = header + menu;

  var m = document.getElementById('nn-menu'), openBtn = document.querySelector('[data-nn-open]');
  function setMenu(open) {
    if (!m) return; m.hidden = !open; document.body.classList.toggle('nn-lock', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    if (open) { var c = m.querySelector('[data-nn-close]'); if (c) c.focus(); } else if (openBtn) openBtn.focus();
  }
  if (openBtn) openBtn.addEventListener('click', function () { setMenu(true); });
  var closeBtn = m && m.querySelector('[data-nn-close]'); if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m && !m.hidden) setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 900 && m && !m.hidden) setMenu(false); });

  function late() {
    var f = document.querySelector('[data-nn-footer]'); if (f) f.outerHTML = footer;
    // Home: hide the small brand until the big masthead scrolls away.
    var mast = document.querySelector('[data-nn-masthead]');
    if (mast && 'IntersectionObserver' in window) {
      document.body.classList.add('nn-home');
      new IntersectionObserver(function (es) { document.body.classList.toggle('nn-scrolled', !es[0].isIntersecting); }, { rootMargin: '-60px 0px 0px 0px' }).observe(mast);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', late); else late();
})();
