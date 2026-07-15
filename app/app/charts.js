/* charts.js — גרפים ב-SVG בלבד, בלי ספריות */
"use strict";

const CHART_COLORS = { green: "#5C6E33", brand: "#E8B400", accent: "#FFD600", red: "#d6453d", gray: "#DFE5D3" };

function svgEl(w, h) {
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" direction="ltr">`;
}

/* גרף עמודות: series = [{label, values:[], color}], labels = שמות חודשים */
function barChart(labels, series, opts = {}) {
  const W = opts.width || 860, H = opts.height || 240, padL = 56, padB = 26, padT = 12;
  const all = series.flatMap(s => s.values);
  const max = Math.max(1, ...all.map(v => Math.abs(v)));
  const hasNeg = all.some(v => v < 0);
  const zeroY = hasNeg ? padT + (H - padT - padB) / 2 : H - padB;
  const scale = (hasNeg ? (H - padT - padB) / 2 : H - padT - padB) / max;
  const n = labels.length, groupW = (W - padL - 10) / n;
  const barW = Math.min(26, (groupW - 8) / series.length);

  let out = svgEl(W, H);
  for (let g = 0; g <= 4; g++) { // קווי רשת
    const val = max - (g * max / 4);
    const y = zeroY - val * scale;
    out += `<line x1="${padL}" y1="${y}" x2="${W - 5}" y2="${y}" stroke="#eee8de" stroke-width="1"/>`;
    out += `<text x="${padL - 6}" y="${y + 4}" font-size="10" fill="#8a8378" text-anchor="end">${shortNum(val)}</text>`;
  }
  out += `<line x1="${padL}" y1="${zeroY}" x2="${W - 5}" y2="${zeroY}" stroke="#cfc8bb" stroke-width="1.5"/>`;
  labels.forEach((lb, i) => {
    const x0 = padL + i * groupW + (groupW - barW * series.length) / 2;
    series.forEach((s, si) => {
      const v = s.values[i] || 0, h = Math.abs(v) * scale;
      const y = v >= 0 ? zeroY - h : zeroY;
      out += `<rect x="${x0 + si * barW}" y="${y}" width="${barW - 2}" height="${Math.max(h, 0.5)}" rx="3" fill="${s.color}"/>`;
    });
    out += `<text x="${padL + i * groupW + groupW / 2}" y="${H - 8}" font-size="10" fill="#8a8378" text-anchor="middle">${lb}</text>`;
  });
  out += "</svg>";
  const legend = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("")}</div>`;
  return `<div class="chartBox">${out}${legend}</div>`;
}

/* גרף קו (אחד או יותר) */
function lineChart(labels, series, opts = {}) {
  const W = opts.width || 860, H = opts.height || 240, padL = 56, padB = 26, padT = 12;
  const all = series.flatMap(s => s.values);
  let min = Math.min(0, ...all), max = Math.max(1, ...all);
  if (max === min) max = min + 1;
  const sy = v => padT + (max - v) / (max - min) * (H - padT - padB);
  const sx = i => padL + i * (W - padL - 15) / Math.max(1, labels.length - 1);

  let out = svgEl(W, H);
  for (let g = 0; g <= 4; g++) {
    const val = max - g * (max - min) / 4, y = sy(val);
    out += `<line x1="${padL}" y1="${y}" x2="${W - 5}" y2="${y}" stroke="#eee8de"/>`;
    out += `<text x="${padL - 6}" y="${y + 4}" font-size="10" fill="#8a8378" text-anchor="end">${shortNum(val)}</text>`;
  }
  if (min < 0) out += `<line x1="${padL}" y1="${sy(0)}" x2="${W - 5}" y2="${sy(0)}" stroke="#cfc8bb" stroke-width="1.5"/>`;
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
    if (si === 0 && opts.fill !== false) {
      const base = H - padB;
      out += `<polygon points="${sx(0)},${base} ${pts} ${sx(s.values.length - 1)},${base}" fill="${s.color}" opacity=".14"/>`;
    }
    out += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round"/>`;
    s.values.forEach((v, i) => {
      out += `<circle cx="${sx(i)}" cy="${sy(v)}" r="3" fill="${v < 0 ? CHART_COLORS.red : s.color}"/>`;
    });
  });
  labels.forEach((lb, i) => {
    out += `<text x="${sx(i)}" y="${H - 8}" font-size="10" fill="#8a8378" text-anchor="middle">${lb}</text>`;
  });
  out += "</svg>";
  const legend = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("")}</div>`;
  return `<div class="chartBox">${out}${legend}</div>`;
}

/* גרף גלגל (דונאט) — בסגנון הבורד: לאן הולך הכסף */
const DONUT_COLORS = ["#FFD600", "#5C6E33", "#E8A800", "#8FA05A", "#F0B400", "#DFE5D3", "#B8A25A", "#47541F"];
function donutChart(items, centerLabel, centerValue) {
  const total = items.reduce((s, it) => s + it.value, 0);
  if (total <= 0) return "";
  const R = 70, C = 2 * Math.PI * R, cx = 100, cy = 100;
  let offset = 0, segs = "";
  items.forEach((it, i) => {
    const frac = it.value / total, len = frac * C;
    segs += `<circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="${it.color || DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-width="30"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;
  });
  const legend = items.map((it, i) => `<span style="display:flex;align-items:center;gap:6px;font-size:12.5px;margin-bottom:5px">
    <i style="width:11px;height:11px;border-radius:3px;background:${it.color || DONUT_COLORS[i % DONUT_COLORS.length]};display:inline-block;flex-shrink:0"></i>
    <span style="flex:1">${it.label}</span><b style="direction:ltr">${Math.round(it.value).toLocaleString()} ₪</b>
    <span style="color:#8a8378;width:34px;text-align:left">${Math.round(it.value / total * 100)}%</span></span>`).join("");
  return `<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <svg viewBox="0 0 200 200" style="width:170px;height:170px;flex-shrink:0">${segs}
      <text x="100" y="94" text-anchor="middle" font-size="11" fill="#8a8378">${centerLabel || ""}</text>
      <text x="100" y="114" text-anchor="middle" font-size="17" font-weight="800" fill="#1C1C1C">${centerValue || ""}</text>
    </svg>
    <div style="flex:1;min-width:190px">${legend}</div>
  </div>`;
}

function shortNum(v) {
  const a = Math.abs(v);
  if (a >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (a >= 1000) return Math.round(v / 1000) + "K";
  return Math.round(v);
}
