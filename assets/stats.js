// Statistics page: builds every number and chart from window.GITHUB_STATS
// (assets/stats-data.js) and window.REPOS (assets/repos-data.js). Both files are
// refreshed hourly by scripts/update-repos.sh in the update workflow.

(function () {
  const { columns, bars, calendar, fmt } = window.Charts;
  const stats = window.GITHUB_STATS || null;
  const repos = Array.isArray(window.REPOS) ? window.REPOS : [];
  const $ = id => document.getElementById(id);

  // Chart colours (validated against the dark card surface, see the dataviz checks)
  const BLUE = '#3987e5';
  const ORANGE = '#d95926';
  const RAMP = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4'];
  const EMPTY = 'rgba(255, 255, 255, 0.06)';

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const own = repos.filter(r => r.isFork !== true);
  const knowsForks = repos.some(r => typeof r.isFork === 'boolean');

  const setText = (id, v) => { const n = $(id); if (n) n.textContent = v; };
  const unavailable = (id, message) => {
    const card = $(id);
    if (!card) return;
    card.querySelector('.chart').replaceChildren(Object.assign(document.createElement('p'), { className: 'viz-note', textContent: message }));
    card.querySelectorAll('.legend, .scale').forEach(n => n.remove());
  };
  const PENDING = 'Contribution statistics appear after the next hourly data update.';

  // ─── Streaks from the daily calendar ───────────────────────────────────────
  function streaks(days) {
    let longest = 0, run = 0;
    days.forEach(([, c]) => { run = c > 0 ? run + 1 : 0; longest = Math.max(longest, run); });
    // Current streak: count back from today; a quiet today doesn't break it yet
    let current = 0, i = days.length - 1;
    if (i >= 0 && days[i][1] === 0) i--;
    for (; i >= 0 && days[i][1] > 0; i--) current++;
    return { current, longest };
  }

  // ─── Headline numbers ──────────────────────────────────────────────────────
  setText('kpi-repos', knowsForks ? fmt(own.length) : fmt(repos.length));
  setText('kpi-repos-sub', knowsForks ? `plus ${repos.length - own.length} forks` : 'public repositories');
  setText('kpi-stars', fmt(own.reduce((s, r) => s + (r.stargazerCount || 0), 0)));

  if (stats) {
    const s = streaks(stats.calendar);
    setText('hero-total', fmt(stats.lastYear.total));
    setText('kpi-current', `${s.current} ${s.current === 1 ? 'day' : 'days'}`);
    setText('kpi-longest', `${s.longest} ${s.longest === 1 ? 'day' : 'days'}`);
    setText('kpi-followers', fmt(stats.followers));
    const since = new Date(stats.createdAt);
    setText('kpi-since', since.getUTCFullYear());
    const years = Math.floor((Date.now() - since) / (365.25 * 864e5));
    setText('kpi-since-sub', `${years} ${years === 1 ? 'year' : 'years'} on GitHub`);
    const updated = new Date(stats.generatedAt);
    setText('updated', updated.toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }));
  } else {
    ['hero-total', 'kpi-current', 'kpi-longest', 'kpi-followers', 'kpi-since'].forEach(id => setText(id, '–'));
    setText('updated', 'pending');
  }

  // ─── Contribution calendar ─────────────────────────────────────────────────
  if (stats) {
    calendar($('calendar').querySelector('.chart'), { days: stats.calendar, ramp: RAMP, empty: EMPTY });
    const legend = $('calendar-legend');
    [EMPTY, ...RAMP].forEach(c => {
      const sw = document.createElement('i');
      sw.style.background = c;
      legend.insertBefore(sw, legend.lastElementChild);
    });
    const active = stats.calendar.filter(d => d[1] > 0).length;
    setText('calendar-sub', `${fmt(stats.lastYear.total)} contributions on ${active} active days over the last 12 months`);
  } else unavailable('calendar', PENDING);

  // ─── Contributions per year ────────────────────────────────────────────────
  if (stats?.years?.length) {
    const ys = stats.years;
    columns($('per-year').querySelector('.chart'), {
      categories: ys.map(y => String(y.year)),
      series: [{ name: 'Contributions', color: BLUE, values: ys.map(y => y.total) }],
    });
    const best = ys.reduce((a, b) => (b.total > a.total ? b : a));
    setText('per-year-sub', `Busiest year so far: ${best.year}, with ${fmt(best.total)} contributions`);
  } else unavailable('per-year', PENDING);

  // ─── Contributions per month (last 12 months) ──────────────────────────────
  if (stats) {
    const byMonth = new Map();
    stats.calendar.forEach(([iso, c]) => { const k = iso.slice(0, 7); byMonth.set(k, (byMonth.get(k) || 0) + c); });
    const months = [...byMonth.keys()].sort().slice(-12);
    const label = k => new Date(k + '-01T00:00:00Z').toLocaleString('en', { month: 'short', timeZone: 'UTC' });
    columns($('per-month').querySelector('.chart'), {
      categories: months.map(label),
      series: [{ name: 'Contributions', color: BLUE, values: months.map(k => byMonth.get(k)) }],
    });
  } else unavailable('per-month', PENDING);

  // ─── Activity by weekday ───────────────────────────────────────────────────
  if (stats) {
    const totals = Array(7).fill(0);
    stats.calendar.forEach(([iso, c]) => { totals[(new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7] += c; });
    columns($('weekday').querySelector('.chart'), {
      categories: WEEKDAYS,
      series: [{ name: 'Contributions', color: BLUE, values: totals }],
    });
    const top = totals.indexOf(Math.max(...totals));
    const names = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
    setText('weekday-sub', `Most active on ${names[top]}, over the last 12 months`);
  } else unavailable('weekday', PENDING);

  // ─── Contribution types ────────────────────────────────────────────────────
  if (stats) {
    const l = stats.lastYear;
    const types = [
      { label: 'Commits', value: l.commits },
      { label: 'Pull requests', value: l.pullRequests },
      { label: 'Code reviews', value: l.reviews },
      { label: 'Issues', value: l.issues },
      { label: 'New repositories', value: l.repositories },
    ];
    if (l.private) types.push({ label: 'Private contributions', value: l.private });
    bars($('types').querySelector('.chart'), { data: types.sort((a, b) => b.value - a.value), color: BLUE });
  } else unavailable('types', PENDING);


  // ─── Most starred repositories ─────────────────────────────────────────────
  {
    const top = own.filter(r => r.stargazerCount > 0).sort((a, b) => b.stargazerCount - a.stargazerCount).slice(0, 8);
    bars($('stars').querySelector('.chart'), {
      color: BLUE,
      data: top.map(r => ({
        label: r.name,
        value: r.stargazerCount,
        href: r.url,
        tipValue: `${fmt(r.stargazerCount)} stars`,
        tipLabel: `${r.name} · open on GitHub`,
      })),
    });
  }

  // ─── Repositories created per year (own vs forks) ─────────────────────────
  if (repos.some(r => r.createdAt)) {
    const years = [...new Set(repos.filter(r => r.createdAt).map(r => +r.createdAt.slice(0, 4)))].sort();
    const range = [];
    for (let y = years[0]; y <= years[years.length - 1]; y++) range.push(y);
    const count = (y, fork) => repos.filter(r => r.createdAt && +r.createdAt.slice(0, 4) === y && (r.isFork === true) === fork).length;
    const ownVals = range.map(y => count(y, false)), forkVals = range.map(y => count(y, true));
    columns($('created').querySelector('.chart'), {
      categories: range.map(String),
      series: [
        { name: 'Own', color: BLUE, values: ownVals },
        { name: 'Forks', color: ORANGE, values: forkVals },
      ],
    });
  } else unavailable('created', 'This chart appears after the next hourly data update.');

})();
