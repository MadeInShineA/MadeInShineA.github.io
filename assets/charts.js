// Small dependency-free SVG/HTML charts for the statistics page.
//
// Specs (shared by every chart): bars <= 24px thick with a 4px rounded data end and a square
// baseline, hairline solid gridlines, text in text colours (never the series colour), a
// tooltip on hover AND keyboard focus for every mark (each mark also carries an aria-label).

(function () {
  const SVG = 'http://www.w3.org/2000/svg';
  const fmt = n => new Intl.NumberFormat('en').format(n);
  const compact = n => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  function el(tag, attrs = {}, parent) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  // ─── Shared tooltip (values lead, labels follow; text via textContent) ───
  const tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('role', 'status');
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));

  function showTip(target, value, label, event) {
    tip.replaceChildren();
    const v = document.createElement('strong');
    v.textContent = value;
    const l = document.createElement('span');
    l.textContent = label;
    tip.append(v, l);
    tip.classList.add('on');
    const r = target.getBoundingClientRect();
    const x = event && event.clientX ? event.clientX : r.left + r.width / 2;
    const y = event && event.clientY ? event.clientY : r.top;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.min(Math.max(8, x - w / 2), innerWidth - w - 8)}px`;
    tip.style.top = `${Math.max(8, y - h - 14)}px`;
  }
  const hideTip = () => tip.classList.remove('on');
  addEventListener('scroll', hideTip, { passive: true });

  function hoverable(node, value, label) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', `${label}: ${value}`);
    node.addEventListener('pointermove', e => showTip(node, value, label, e));
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', () => showTip(node, value, label));
    node.addEventListener('blur', hideTip);
  }

  // Path for a vertical bar: rounded top (data end), square bottom (baseline)
  function columnPath(x, y, w, h, r = 4) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  // Axis scale with 4 clean steps (1, 2 or 5 x 10^n), so ticks are always round numbers
  function niceScale(v, steps = 4) {
    const raw = Math.max(v, 1) / steps;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
    return { step, max: step * Math.max(1, Math.ceil(v / step)) };
  }

  // Re-render on container resize so charts stay crisp at any width
  function responsive(container, draw) {
    let last = 0;
    const run = () => {
      const w = Math.round(container.clientWidth);
      if (w && w !== last) { last = w; draw(w); }
    };
    new ResizeObserver(run).observe(container);
    run();
  }

  // ─── Column chart: one or more stacked series over categories ───────────
  // series: [{ name, color, values: [] }]; a 2px surface gap separates stacked segments
  function columns(container, { categories, series, height = 220, format = fmt, unit = '' }) {
    responsive(container, width => {
      container.replaceChildren();
      const m = { top: 14, right: 4, bottom: 26, left: 40 };
      const iw = width - m.left - m.right, ih = height - m.top - m.bottom;
      const totals = categories.map((_, i) => series.reduce((s, ser) => s + ser.values[i], 0));
      const { step, max } = niceScale(Math.max(...totals));
      const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'viz' }, container);

      for (let v = 0; v <= max; v += step) {
        const t = v, y = m.top + ih - (v / max) * ih;
        el('line', { x1: m.left, x2: width - m.right, y1: y, y2: y, class: t ? 'grid' : 'baseline' }, svg);
        el('text', { x: m.left - 8, y: y + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = compact(v);
      }

      const band = iw / categories.length;
      const bw = Math.min(24, band * 0.62);
      const every = Math.ceil(categories.length / Math.max(1, Math.floor(iw / 44)));
      const peak = totals.indexOf(Math.max(...totals));

      categories.forEach((cat, i) => {
        const x = m.left + band * i + (band - bw) / 2;
        let base = m.top + ih;
        const g = el('g', { class: 'mark' }, svg);
        series.forEach((ser, s) => {
          const v = ser.values[i];
          if (!v) return;
          const h = (v / max) * ih;
          const top = s === series.length - 1 || !series.slice(s + 1).some(n => n.values[i]);
          const gap = s > 0 ? 2 : 0;
          const y = base - h;
          const hh = Math.max(0, h - gap);
          el('path', { d: top ? columnPath(x, y, bw, hh) : `M${x},${y}h${bw}v${hh}h${-bw}Z`, fill: ser.color }, g);
          base = y;
        });
        // Transparent hit area: the whole band, bigger than the mark
        el('rect', { x: m.left + band * i, y: m.top, width: band, height: ih, fill: 'transparent' }, g);
        const label = series.length > 1
          ? `${cat} · ${series.map(s => `${s.name} ${format(s.values[i])}`).join(', ')}`
          : String(cat);
        hoverable(g, `${format(totals[i])}${unit}`, label);

        if (i % every === 0 || i === categories.length - 1) {
          el('text', { x: m.left + band * i + band / 2, y: height - 8, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = cat;
        }
        // Selective direct label: only the peak
        if (i === peak && totals[i] > 0) {
          el('text', { x: x + bw / 2, y: m.top + ih - (totals[i] / max) * ih - 6, class: 'value', 'text-anchor': 'middle' }, svg)
            .textContent = format(totals[i]);
        }
      });
    });
  }

  // ─── Horizontal bars (HTML): ranked categories, value at the bar tip ─────
  function bars(container, { data, color, format = fmt }) {
    container.replaceChildren();
    const max = Math.max(...data.map(d => d.value), 1);
    const list = document.createElement('div');
    list.className = 'hbars';
    data.forEach(d => {
      const row = document.createElement('div');
      row.className = 'hbar mark';
      const name = document.createElement('span');
      name.className = 'hbar-label';
      name.textContent = d.label;
      const track = document.createElement('span');
      track.className = 'hbar-track';
      const fill = document.createElement('span');
      fill.className = 'hbar-fill';
      fill.style.width = `${Math.max(1.5, (d.value / max) * 100)}%`;
      fill.style.background = color;
      const value = document.createElement('span');
      value.className = 'hbar-value';
      value.textContent = format(d.value);
      track.append(fill, value);
      row.append(name, track);
      hoverable(row, d.tipValue || format(d.value), d.tipLabel || d.label);
      list.appendChild(row);
    });
    container.appendChild(list);
  }

  // ─── Contribution calendar heatmap (sequential, one hue) ─────────────────
  // days: [[isoDate, count]] in chronological order, weeks starting on Sunday
  function calendar(container, { days, ramp, empty }) {
    const counts = days.map(d => d[1]).filter(c => c > 0).sort((a, b) => a - b);
    const q = p => counts.length ? counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] : 0;
    const cuts = [q(0.25), q(0.5), q(0.75), q(0.92)];
    const level = c => (c <= 0 ? 0 : 1 + cuts.filter(t => c > t).length);

    responsive(container, width => {
      container.replaceChildren();
      const first = new Date(days[0][0] + 'T00:00:00Z');
      const offset = first.getUTCDay();
      const weeks = Math.ceil((days.length + offset) / 7);
      const left = 30, top = 18;
      const step = Math.max(10, Math.min(22, Math.floor((width - left) / weeks)));
      const cell = step - 3;
      const w = left + weeks * step, h = top + 7 * step + 4;
      const scroller = document.createElement('div');
      scroller.className = 'viz-scroll';
      const svg = el('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: 'viz' }, scroller);
      container.appendChild(scroller);

      ['Mon', 'Wed', 'Fri'].forEach((d, i) => {
        el('text', { x: 0, y: top + (1 + i * 2) * step + cell - 1, class: 'tick' }, svg).textContent = d;
      });
      let lastMonth = -1;
      days.forEach(([iso, count], i) => {
        const pos = i + offset, col = Math.floor(pos / 7), row = pos % 7;
        const date = new Date(iso + 'T00:00:00Z');
        if (row === 0 || i === 0) {
          const mth = date.getUTCMonth();
          if (mth !== lastMonth && (date.getUTCDate() <= 7 || i === 0)) {
            if (col < weeks - 2) {
              el('text', { x: left + col * step, y: 11, class: 'tick' }, svg)
                .textContent = date.toLocaleString('en', { month: 'short', timeZone: 'UTC' });
            }
            lastMonth = mth;
          }
        }
        const r = el('rect', {
          x: left + col * step, y: top + row * step, width: cell, height: cell, rx: 2.5,
          fill: level(count) ? ramp[level(count) - 1] : empty, class: 'mark cell',
        }, svg);
        const label = date.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
        hoverable(r, `${fmt(count)} contribution${count === 1 ? '' : 's'}`, label);
      });
      // Keep the most recent weeks in view on narrow screens
      scroller.scrollLeft = scroller.scrollWidth;
    });

    return { cuts };
  }


  window.Charts = { columns, bars, calendar, fmt, compact };
})();
