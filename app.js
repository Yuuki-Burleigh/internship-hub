// Job Hub board: renders data/internships.json + data/jobs.json
// Supports both Local Mode (instant 1-click tailoring/search) and GitHub Pages Mode (issue-backed Actions).
(() => {
  const { repo, branch } = window.JOB_HUB || { repo: 'Yuuki-Burleigh/job-hub', branch: 'main' };
  const $ = (id) => document.getElementById(id);
  const PAGE = 60;
  const TAGS = ['Network', 'Security', 'Cloud & Infra', 'IT & Support', 'Hardware'];
  const state = { tab: 'intern', sec: 'qualify', q: '', tags: new Set(), uc: false, newonly: false, term: '', shown: PAGE, isLocal: false };
  const data = { intern: null, jobs: null };

  const issueUrl = (title, body) =>
    `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

  const tailorIssueUrl = (r) => issueUrl(`Tailor: ${r.company} — ${r.title}`.slice(0, 240), [
    'Press **Create** to build a one-page résumé tailored to this posting. The reply with the PDF arrives in about 3 minutes.',
    '',
    "If the job description can't be read automatically, the reply asks you to paste it here as a comment.",
    '',
    '```json',
    JSON.stringify({ id: r.id, company: r.company, title: r.title, url: r.url }),
    '```',
  ].join('\n'));

  $('search-btn').href = issueUrl('Search: refresh internships and jobs',
    'Press **Create** to run a new search. The board updates in about 2 minutes and this issue closes with a summary.');
  $('resumes').href = `https://github.com/${repo}/tree/${branch}/resume/PDF/Tailored`;

  // Detect local server
  fetch('/api/status')
    .then((r) => r.json())
    .then((res) => {
      if (res.status === 'ok') {
        state.isLocal = true;
        $('search-btn').title = 'Click to run search scraper locally';
        $('search-btn').addEventListener('click', (e) => {
          e.preventDefault();
          const btn = $('search-btn');
          const origText = btn.textContent;
          btn.textContent = 'Searching…';
          btn.style.pointerEvents = 'none';
          fetch('/api/search', { method: 'POST' })
            .then((r) => r.json())
            .then((s) => {
              btn.textContent = 'Refreshed!';
              loadData();
              setTimeout(() => { btn.textContent = origText; btn.style.pointerEvents = ''; }, 2500);
            })
            .catch((err) => {
              alert('Search failed: ' + err.message);
              btn.textContent = origText;
              btn.style.pointerEvents = '';
            });
        });
      }
    })
    .catch(() => {
      state.isLocal = false;
    });

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ago = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  };

  function rows() {
    const src = state.tab === 'intern' ? data.intern : data.jobs;
    if (!src) return [];
    const today = src.meta.generated_at.slice(0, 10);
    const q = state.q.toLowerCase();
    return src.listings.filter((r) =>
      (state.tab === 'intern' || r.section === state.sec) &&
      (!state.uc || state.tab !== 'intern' || r.underclass) &&
      (!state.newonly || r.first_seen === today) &&
      (state.tab !== 'intern' || !state.term || (r.terms || []).includes(state.term)) &&
      (!state.tags.size || (r.tags || []).some((t) => state.tags.has(t))) &&
      (!q || `${r.company} ${r.title} ${(r.locations || []).join(' ')}`.toLowerCase().includes(q)));
  }

  function card(r) {
    const badges = [];
    if (r.program) badges.push('<span class="b warn">Program directory · 2027 opening unverified</span>');
    if (r.underclass) badges.push('<span class="b uc">Underclassmen</span>');
    (r.tags || []).forEach((t) => badges.push(`<span class="b">${esc(t)}</span>`));
    (r.terms || []).filter((t) => t !== 'N/A').forEach((t) => badges.push(`<span class="b term">${esc(t)}</span>`));
    if (r.reqs) {
      const d = { 'high school': 'High-school diploma / GED', 'equivalent ok': 'Degree or equivalent experience',
        'not mentioned': 'No degree mentioned' }[r.reqs.degree];
      if (d) badges.push(`<span class="b ok">${d}</span>`);
      if (r.reqs.years != null) badges.push(`<span class="b">${r.reqs.years}+ yr experience</span>`);
    }
    if (state.tab === 'jobs' && r.section === 'newgrad' && (r.degrees || []).length)
      badges.push(`<span class="b warn">${esc(r.degrees.join(' / '))}</span>`);
    const locs = (r.locations || []);
    const where = locs.slice(0, 3).join(' · ') + (locs.length > 3 ? ` +${locs.length - 3}` : '');

    return `<article class="card">
      <div class="main">
        <p class="co">${esc(r.company)}${r.posted ? ` <span class="date">${esc(r.posted)}</span>` : ''}</p>
        <h2 class="title">${esc(r.title)}</h2>
        <p class="where">${esc(where)}</p>
        ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
        ${r.stale ? '<p class="note">Source unavailable on last refresh; this listing may have closed.</p>' : ''}
        <div class="badges">${badges.join('')}</div>
      </div>
      <div class="go">
        <a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener">${r.program ? 'View program' : 'Apply'}</a>
        <a class="btn ghost tailor-btn" href="${esc(tailorIssueUrl(r))}" target="_blank" rel="noopener"
           data-company="${esc(r.company)}" data-title="${esc(r.title)}" data-url="${esc(r.url)}">Tailor résumé</a>
      </div>
    </article>`;
  }

  function render() {
    const all = rows();
    $('list').innerHTML = all.length ? all.slice(0, state.shown).map(card).join('')
      : '<p class="empty">No listings match these filters.</p>';
    $('more').hidden = all.length <= state.shown;
    $('more').textContent = `Show more (${all.length - state.shown} left)`;
    const src = state.tab === 'intern' ? data.intern : data.jobs;
    $('hint').textContent = state.tab === 'intern'
      ? `${all.length} internships. Fit is judged from the title; underclassmen programs come from curated lists.`
      : state.sec === 'qualify'
        ? `${all.length} potential entry-level matches. Degree and experience filters are automated estimates; check the full requirements before applying.`
        : `${all.length} new-grad roles. Most need a finished bachelor's degree, so these are for later.`;
    if (src) $('updated').textContent = `Updated ${ago(src.meta.generated_at)} · ${src.meta.new_today} new today` +
      (Object.values(src.meta.sources).some((s) => !s.startsWith('ok')) ? ' · some sources failed, last results kept' : '');
  }

  function setTab(tab) {
    state.tab = tab; state.shown = PAGE;
    for (const b of document.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    $('seg').hidden = tab !== 'jobs'; $('uc-wrap').hidden = tab !== 'intern'; $('term').hidden = tab !== 'intern';
    render();
  }

  // Handle in-page tailoring click if local
  $('list').addEventListener('click', (e) => {
    const btn = e.target.closest('.tailor-btn');
    if (!btn || !state.isLocal) return;
    e.preventDefault();
    const company = btn.dataset.company;
    const title = btn.dataset.title;
    const url = btn.dataset.url;
    btn.textContent = 'Generating PDF…';
    btn.style.pointerEvents = 'none';

    fetch('/api/tailor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, title, url })
    })
      .then((r) => r.json())
      .then((res) => {
        if ((res.status === 'ok' || res.status === 'warning') && res.download_url) {
          btn.textContent = res.status === 'warning' ? 'Download PDF ⚠' : 'Download PDF ✓';
          btn.style.pointerEvents = '';
          btn.href = res.download_url;
          if (res.problems && res.problems.length) {
            btn.title = 'Build notes: ' + res.problems.join(', ');
          }
          window.open(res.download_url, '_blank');
        } else {
          const msg = res.error || (res.problems && res.problems.join(', ')) || 'Could not build résumé';
          alert('Tailoring failed: ' + msg);
          btn.textContent = 'Tailor résumé';
          btn.style.pointerEvents = '';
        }
      })
      .catch((err) => {
        alert('Tailoring request error: ' + err.message);
        btn.textContent = 'Tailor résumé';
        btn.style.pointerEvents = '';
      });
  });

  $('chips').innerHTML = TAGS.map((t) => `<button class="chip" aria-pressed="false" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const on = !state.tags.has(b.dataset.tag);
    on ? state.tags.add(b.dataset.tag) : state.tags.delete(b.dataset.tag);
    b.setAttribute('aria-pressed', String(on)); state.shown = PAGE; render();
  });
  document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) setTab(b.dataset.tab); });
  $('seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.sec = b.dataset.sec; state.shown = PAGE;
    for (const x of $('seg').children) x.setAttribute('aria-pressed', String(x === b));
    render();
  });
  $('q').addEventListener('input', (e) => { state.q = e.target.value; state.shown = PAGE; render(); });
  $('uc').addEventListener('change', (e) => { state.uc = e.target.checked; state.shown = PAGE; render(); });
  $('newonly').addEventListener('change', (e) => { state.newonly = e.target.checked; state.shown = PAGE; render(); });
  $('term').addEventListener('change', (e) => { state.term = e.target.value; state.shown = PAGE; render(); });
  $('more').addEventListener('click', () => { state.shown += PAGE; render(); });

  function loadData() {
    return Promise.all(['data/internships.json', 'data/jobs.json'].map((u) =>
      fetch(`${u}?t=${Date.now()}`).then((r) => { if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.json(); })))
      .then(([i, j]) => {
        data.intern = i; data.jobs = j;
        $('n-intern').textContent = i.listings.length;
        $('n-jobs').textContent = j.listings.length;
        const terms = [...new Set(i.listings.flatMap((r) => r.terms || []))].filter((t) => t !== 'N/A').sort();
        $('term').innerHTML = '<option value="">All terms</option>' + terms.map((t) => `<option>${esc(t)}</option>`).join('');
        setTab(state.tab);
      })
      .catch((e) => { $('updated').textContent = `Could not load listings (${e.message}).`; });
  }

  loadData();
})();
