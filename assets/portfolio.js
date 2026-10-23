// Portfolio page: renders stats, the language breakdown and the filterable repository grid
// from window.REPOS (assets/repos-data.js, refreshed hourly by scripts/update-repos.sh).

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Override the languages shown for a project. Keys are "owner/name".
const projectLanguages = {
  'MadeInShineA/smash-map': ['Vue', 'PHP', 'Laravel'],
  'MadeInShineA/rust-boy': ['Rust'],
  'MadeInShineA/spelling-checker': ['Python'],
  'MadeInShineA/forest-fire-simulation': ['Scala', 'Rust', 'Bevy'],
  'MadeInShineA/HEStimate': ['Flutter'],
  'MadeInShineA/avalgard': ['Meteor', 'Vue', 'Python'],
  'MadeInShineA/melee-resources': ['CSS', 'JavaScript', 'HTML'],
};
// Repos that are never shown, by "owner/name".
const hiddenRepos = [
  'MadeInShineA/MadeInShineA',
  'MadeInShineA/crochet_design',
  'MadeInShineA/excal-cli',
];
// Languages left out of the breakdown bar (still filterable).
const excludedFromBreakdown = new Set(['other', 'html', 'css', 'markdown']);
const BREAKDOWN_SIZE = 7;
const FILTER_SIZE = 12;

const LANG_COLORS = {
  rust: '#dea584', python: '#3572a5', scala: '#c22d40', javascript: '#f1e05a', typescript: '#3178c6',
  vue: '#41b883', php: '#4f5d95', laravel: '#f05340', html: '#e34c26', css: '#663399', scss: '#c6538c',
  shell: '#89e051', nix: '#7e7eff', 'c++': '#f34b7d', c: '#555555', java: '#b07219', kotlin: '#a97bff',
  dart: '#00b4ab', flutter: '#54c5f8', swift: '#f05138', lua: '#000080', 'jupyter notebook': '#da5b0b',
  dockerfile: '#384d54', typst: '#239dad', gdscript: '#355570', qml: '#44a51c', meteor: '#de4f4f',
  bevy: '#9f9f9f', nushell: '#4e9906', tex: '#3d6117', blade: '#f7523f', 'objective-c': '#438eff',
};
const langColor = l => LANG_COLORS[l.toLowerCase()] || '#8b8f96';

// ─── STATE ─────────────────────────────────────────────────────────────────
const state = { repos: [], sort: 'stars', lang: null, query: '' };

const $ = id => document.getElementById(id);
const grid = $('repos');

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => new Intl.NumberFormat('en', { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);

function timeAgo(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

async function loadRepos() {
  if (Array.isArray(window.REPOS)) return window.REPOS;
  throw new Error('assets/repos-data.js is missing or empty');
}

function normalize(raw) {
  return raw
    .map(r => {
      const id = `${r.owner.login}/${r.name}`;
      const langs = projectLanguages[id] || (r.languages?.length ? r.languages : ['Other']);
      return {
        id,
        name: r.name,
        url: r.url,
        description: r.description || '',
        stars: r.stargazerCount || 0,
        commits: r.commits || 0,
        updated: new Date(r.updatedAt).getTime(),
        langs,
        haystack: `${r.name} ${r.description || ''} ${langs.join(' ')}`.toLowerCase(),
      };
    })
    .filter(r => !hiddenRepos.includes(r.id));
}

function languageCounts(repos) {
  const counts = new Map();
  repos.forEach(r => r.langs.forEach(l => counts.set(l, (counts.get(l) || 0) + 1)));
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// ─── RENDER: stats, featured stars, breakdown ─────────────────────────────
function renderStats(repos, langs) {
  $('stat-repos').textContent = repos.length;
  $('stat-stars').textContent = fmt(repos.reduce((s, r) => s + r.stars, 0));
  $('stat-langs').textContent = langs.filter(([l]) => l !== 'Other').length;
  $('stat-updated').textContent = timeAgo(Math.max(...repos.map(r => r.updated)));
  $('repo-count').textContent = `${repos.length} public repos`;

  document.querySelectorAll('[data-repo]').forEach(el => {
    const repo = repos.find(r => r.id === el.dataset.repo);
    if (repo) el.innerHTML = `<i class="icon-star" aria-hidden="true"></i> ${repo.stars}`;
  });
}

function renderBreakdown(langs) {
  const shown = langs.filter(([l]) => !excludedFromBreakdown.has(l.toLowerCase()));
  const top = shown.slice(0, BREAKDOWN_SIZE);
  const rest = shown.slice(BREAKDOWN_SIZE).reduce((s, [, c]) => s + c, 0);
  const rows = rest ? [...top, ['Others', rest]] : top;
  const total = rows.reduce((s, [, c]) => s + c, 0);

  $('langbar').innerHTML = rows
    .map(([l, c]) => `<span style="flex-grow:${c};background:${l === 'Others' ? 'var(--fg-faint)' : langColor(l)}" title="${escapeHtml(l)}"></span>`)
    .join('');
  $('legend').innerHTML = rows
    .map(([l, c]) => `<li><i class="dot" style="background:${l === 'Others' ? 'var(--fg-faint)' : langColor(l)}"></i><b>${escapeHtml(l)}</b><small>${Math.round((c / total) * 100)}%</small></li>`)
    .join('');

}

function renderFilters(langs) {
  const top = langs.filter(([l]) => l !== 'Other').slice(0, FILTER_SIZE);
  const btn = (value, label, dot) =>
    `<button class="chip" data-lang="${escapeHtml(value)}" aria-pressed="${state.lang === (value || null)}">${dot ? `<i class="dot" style="background:${langColor(value)}"></i>` : ''}${escapeHtml(label)}</button>`;
  $('filters').innerHTML = btn('', 'All languages', false) + top.map(([l, c]) => btn(l, `${l} · ${c}`, true)).join('');
}

// ─── RENDER: repository grid ──────────────────────────────────────────────
function repoCard(r, i) {
  const desc = r.description
    ? `<p>${escapeHtml(r.description)}</p>`
    : '<p class="empty">No description yet.</p>';
  const langs = r.langs.slice(0, 4)
    .map(l => `<span><i class="dot" style="background:${langColor(l)}"></i>${escapeHtml(l)}</span>`)
    .join('');
  return `
    <a class="repo glass" href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="animation-delay:${Math.min(i, 12) * 35}ms">
      <div class="repo-head">
        <i class="icon-book-marked" aria-hidden="true"></i>
        <h3>${escapeHtml(r.name)}</h3>
        <i class="icon-arrow-up-right arrow" aria-hidden="true"></i>
      </div>
      ${desc}
      <div class="repo-langs">${langs}</div>
      <div class="repo-foot">
        <span><i class="icon-star" aria-hidden="true"></i>${r.stars}</span>
        ${r.commits ? `<span><i class="icon-git-commit-horizontal" aria-hidden="true"></i>${fmt(r.commits)}</span>` : ''}
        <span><i class="icon-clock" aria-hidden="true"></i>${timeAgo(r.updated)}</span>
      </div>
    </a>`;
}

function renderGrid() {
  const q = state.query.trim().toLowerCase();
  const sorters = {
    stars: (a, b) => b.stars - a.stars || b.updated - a.updated,
    updated: (a, b) => b.updated - a.updated,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  const list = state.repos
    .filter(r => !state.lang || r.langs.includes(state.lang))
    .filter(r => !q || r.haystack.includes(q))
    .sort(sorters[state.sort]);

  grid.innerHTML = list.length
    ? list.map(repoCard).join('')
    : `<div class="state"><i class="icon-search" aria-hidden="true"></i>Nothing matches these filters. Try another language or search term.</div>`;

  $('results').textContent = list.length === state.repos.length
    ? ''
    : `Showing ${list.length} of ${state.repos.length} repositories`;
}

// ─── EVENTS ───────────────────────────────────────────────────────────────
document.querySelectorAll('.segmented button').forEach(b => {
  b.addEventListener('click', () => {
    state.sort = b.dataset.sort;
    document.querySelectorAll('.segmented button').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderGrid();
  });
});

$('filters').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  state.lang = b.dataset.lang || null;
  $('filters').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  renderGrid();
});

let searchTimer;
$('search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; renderGrid(); }, 150);
});

// ─── INIT ─────────────────────────────────────────────────────────────────
loadRepos()
  .then(raw => {
    state.repos = normalize(raw);
    const langs = languageCounts(state.repos);
    renderStats(state.repos, langs);
    renderBreakdown(langs);
    renderFilters(langs);
    renderGrid();
  })
  .catch(err => {
    console.error(err);
    grid.innerHTML = `<div class="state"><i class="icon-triangle-alert" aria-hidden="true"></i>The repositories couldn't be loaded right now. Please try again later.</div>`;
  });
