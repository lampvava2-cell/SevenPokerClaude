/* ===================== 2D 물리 실험실 ===================== */
const BP = BilliardPhysics, D = BP.DEFAULTS;
const $ = id => document.getElementById(id);
let params = Object.assign({}, D);
const R = D.R, L = D.L, W = D.W, DL = L / 8, DW = W / 4, RAIL = 0.125, CUSH = 0.045;
const COND = { fast: { muR: 0.0065, muS: 0.18, spinDecel: 8, eCushion: 0.88 }, normal: { muR: 0.0085, muS: 0.20, spinDecel: 10, eCushion: 0.86 }, slow: { muR: 0.0115, muS: 0.22, spinDecel: 12, eCushion: 0.83 } };
const SLIDERS = [
  ['muR', '구름 저항', 0.004, 0.016, 0.0005], ['muS', '미끄럼 마찰', 0.1, 0.35, 0.01], ['spinDecel', '좌우회전 감쇠 (rad/s²)', 2, 25, 0.5],
  ['eCushion', '쿠션 반발', 0.6, 0.98, 0.01], ['muCushion', '쿠션 마찰', 0.05, 0.4, 0.01], ['cushionH', '쿠션 높이 (mm)', 0.033, 0.042, 0.0005, 1000],
  ['eBall', '공-공 반발', 0.85, 0.99, 0.005], ['cueEndMass', '큐 끝 질량 (스쿼트, g)', 0.003, 0.02, 0.0005, 1000], ['cueTipE', '큐 팁 반발', 0.5, 0.95, 0.01]];
const COLORS = [['#ffffff', '#c3c7cd'], ['#ffb35c', '#d65a0c'], ['#ff5a4d', '#a51d16']], NAMES = ['흰 공', '주황', '빨강'];
const RAILNAME = ['왼쪽 단쿠션', '오른쪽 단쿠션', '아래 장쿠션', '위 장쿠션'];
const st = { tgt: 2, phi: 0, a: 0, b: 0, elev: 5, power: 0.38, guide: true, path: true, ghost: true, nums: true, sound: true, edit: false, snap: true, rspeed: 1 };
let balls = breakBalls(), play = null, last = null, prev = null, before = null;
function breakBalls() { return [BP.makeBall('w', 0.71, 0.71 - 0.1524, D), BP.makeBall('o', 0.71, 0.71, D), BP.makeBall('r', 2.13, 0.71, D)]; }
const cueSpeed = p => 0.35 + 7.65 * Math.pow(p, 1.6);
function aimAt(i) { const c = balls[0], o = balls[i]; st.phi = Math.atan2(o.y - c.y, o.x - c.x); }
aimAt(2);
const dia = v => (v).toFixed(2);

/* ---------- geometry ---------- */
const cv = $('cv'), ctx = cv.getContext('2d'); let M = null, dpr = 1, rot = false, scale = 1;
function resize() { dpr = window.devicePixelRatio || 1; const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); rot = h > w * 1.05;
  const top = 44, tw = (rot ? W : L) + 2 * RAIL, th = (rot ? L : W) + 2 * RAIL; scale = Math.min((w - 16) / tw, (h - top - 30) / th);
  const ox = (w - tw * scale) / 2, oy = top + (h - top - 30 - th * scale) / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(ox, oy); ctx.scale(scale, scale);
  if (rot) { ctx.translate(0, L + 2 * RAIL); ctx.rotate(-Math.PI / 2); }  // long axis vertical, x upward
  ctx.translate(RAIL, RAIL + W); ctx.scale(1, -1);                      // physics frame: y up
  M = ctx.getTransform(); draw(); }
new ResizeObserver(resize).observe(cv);
function toWorld(e) { const r = cv.getBoundingClientRect(); return new DOMPoint((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr).matrixTransform(M.inverse()); }

/* ---------- drawing ---------- */
function draw(pos) { if (!M) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0d1116'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore();
  ctx.fillStyle = '#4e321d'; rr(-RAIL, -RAIL, L + 2 * RAIL, W + 2 * RAIL, 0.04); ctx.fill();
  ctx.fillStyle = '#17508f'; ctx.fillRect(-CUSH, -CUSH, L + 2 * CUSH, W + 2 * CUSH);
  ctx.fillStyle = '#1f62b4'; ctx.fillRect(0, 0, L, W);
  // grid lines at diamonds (faint) helps reading paths
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 0.003; ctx.beginPath();
  for (let i = 1; i < 8; i++) { ctx.moveTo(i * DL, 0); ctx.lineTo(i * DL, W); } for (let j = 1; j < 4; j++) { ctx.moveTo(0, j * DW); ctx.lineTo(L, j * DW); } ctx.stroke();
  const dm = CUSH + (RAIL - CUSH) / 2; ctx.fillStyle = '#efe6d2';
  for (let i = 0; i <= 8; i++) { diamond(i * DL, -dm); diamond(i * DL, W + dm); } for (let j = 0; j <= 4; j++) { diamond(-dm, j * DW); diamond(L + dm, j * DW); }
  if (st.nums) { for (let i = 0; i <= 8; i++) { label(String(i), i * DL, W + RAIL + 0.035); label(String(i), i * DL, -RAIL - 0.04); } for (let j = 0; j <= 4; j++) { label(String(j), -RAIL - 0.04, j * DW); label(String(j), L + RAIL + 0.04, j * DW); } }
  ctx.fillStyle = 'rgba(255,255,255,.3)'; [[0.71, 0.71], [2.13, 0.71], [1.42, 0.71]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 0.005, 0, 7); ctx.fill(); });
  if (st.ghost && prev && !play) drawPaths(prev, prev.frames.length - 1, true);
  if (st.path && last) drawPaths(last, play && play.res === last ? Math.floor(Math.max(0, play.t) * params.recordHz) : last.frames.length - 1, false);
  if (!play && st.guide) drawGuide();
  const bs = pos || balls.map(b => [b.x, b.y, b.z, 0]);
  if (!play) drawCue();
  bs.forEach((p, k) => { const air = p[3] > 0.5 || p[2] > R + 0.002, r = R * (air ? 1.12 : 1), so = air ? 0.02 : 0.006;
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.arc(p[0] + so, p[1] - so, R, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(p[0] - r * 0.35, p[1] + r * 0.4, r * 0.1, p[0], p[1], r); g.addColorStop(0, COLORS[k][0]); g.addColorStop(1, COLORS[k][1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); });
  if (st.edit) { ctx.strokeStyle = 'rgba(214,165,74,.9)'; ctx.lineWidth = 0.004; balls.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, R + 0.015, 0, 7); ctx.stroke(); }); } }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function diamond(x, y) { const s = 0.011; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill(); }
function label(t, x, y) { ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); if (rot) ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(233,238,244,.55)'; ctx.font = '600 0.045px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, 0); ctx.restore(); }
function drawPaths(res, n, ghost) {
  n = Math.min(n, res.frames.length - 1);
  const cols = ghost ? ['rgba(255,255,255,.22)', 'rgba(255,170,90,.18)', 'rgba(255,90,80,.18)'] : ['rgba(255,255,255,.85)', 'rgba(255,170,90,.7)', 'rgba(255,90,80,.7)'];
  for (let k = 0; k < 3; k++) { ctx.strokeStyle = cols[k]; ctx.lineWidth = ghost ? 0.004 : 0.005; if (ghost) ctx.setLineDash([0.02, 0.012]);
    ctx.beginPath(); const f0 = res.frames[0]; ctx.moveTo(f0[k * 8], f0[k * 8 + 1]); for (let i = 1; i <= n; i++) { const f = res.frames[i]; ctx.lineTo(f[k * 8], f[k * 8 + 1]); } ctx.stroke(); ctx.setLineDash([]); }
  if (ghost) return;
  const tNow = n / params.recordHz; let c = 0;
  for (const e of res.events) { if (e.t > tNow || e.type !== 'cushion' || e.i !== 0) continue; c++;
    const f = res.frames[Math.min(res.frames.length - 1, Math.round(e.t * params.recordHz))]; const x = f[0], y = f[1];
    ctx.fillStyle = '#d6a54a'; ctx.beginPath(); ctx.arc(x, y, 0.016, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); if (rot) ctx.rotate(Math.PI / 2); ctx.fillStyle = '#1b1408'; ctx.font = '700 0.022px "Barlow Condensed",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(c), 0, 0.001); ctx.restore(); } }
function cast(px, py, dx, dy) { let best = Infinity, hit = null;
  balls.forEach((b, i) => { if (i === 0) return; const ox = px - b.x, oy = py - b.y, bq = ox * dx + oy * dy, cq = ox * ox + oy * oy - 4 * R * R, disc = bq * bq - cq;
    if (disc > 0) { const t = -bq - Math.sqrt(disc); if (t > 1e-6 && t < best) { best = t; hit = { type: 'ball', i }; } } });
  const lim = R * Math.sqrt(1 - Math.pow((params.cushionH - R) / R, 2));
  [[dx < 0, (lim - px) / dx, 'x'], [dx > 0, (L - lim - px) / dx, 'x'], [dy < 0, (lim - py) / dy, 'y'], [dy > 0, (W - lim - py) / dy, 'y']].forEach(([ok, t, ax]) => { if (ok && t > 1e-6 && t < best) { best = t; hit = { type: 'rail', ax }; } });
  return { t: best, hit }; }
function drawGuide() { const c = balls[0];
  { const rp = realPhi(); if (Math.abs(rp - st.phi) > 1e-4) { const ux = Math.cos(rp), uy = Math.sin(rp), rr2 = cast(c.x, c.y, ux, uy), qx = c.x + ux * rr2.t, qy = c.y + uy * rr2.t;
    ctx.strokeStyle = 'rgba(214,165,74,.85)'; ctx.lineWidth = 0.003; ctx.setLineDash([0.008, 0.01]); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(qx, qy); ctx.stroke(); ctx.beginPath(); ctx.arc(qx, qy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]); } }
  const dx = Math.cos(st.phi), dy = Math.sin(st.phi), r = cast(c.x, c.y, dx, dy), ex = c.x + dx * r.t, ey = c.y + dy * r.t;
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.003; ctx.setLineDash([0.018, 0.012]); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.beginPath(); ctx.arc(ex, ey, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  // where the aim line meets the diamond line on the frame
  const dm = CUSH + (RAIL - CUSH) / 2; const tx = dx > 0 ? (L + dm - c.x) / dx : dx < 0 ? (-dm - c.x) / dx : Infinity, ty = dy > 0 ? (W + dm - c.y) / dy : dy < 0 ? (-dm - c.y) / dy : Infinity, t = Math.min(tx, ty);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(c.x + dx * t, c.y + dy * t); ctx.stroke();
  ctx.fillStyle = '#d6a54a'; ctx.beginPath(); ctx.arc(c.x + dx * t, c.y + dy * t, 0.012, 0, 7); ctx.fill();
  st.aimDia = t === tx ? `${dx > 0 ? '오른쪽' : '왼쪽'} 단 ${dia((c.y + dy * t) / DW)}` : `${dy > 0 ? '위' : '아래'} 장 ${dia((c.x + dx * t) / DL)}`;
  if (r.hit && r.hit.type === 'ball') { const b = balls[r.hit.i]; let nx = b.x - ex, ny = b.y - ey; const m = Math.hypot(nx, ny); ctx.strokeStyle = 'rgba(214,165,74,.85)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + nx / m * 0.25, b.y + ny / m * 0.25); ctx.stroke(); } }
function drawCue() { const c = balls[0], dx = Math.cos(st.phi), dy = Math.sin(st.phi), g = R + 0.015 + st.power * 0.12, sx0 = c.x - dx * g, sy0 = c.y - dy * g, sx1 = c.x - dx * (g + 1.2), sy1 = c.y - dy * (g + 1.2);
  const lg = ctx.createLinearGradient(sx0, sy0, sx1, sy1); lg.addColorStop(0, '#e9eef2'); lg.addColorStop(0.015, '#d9b77a'); lg.addColorStop(0.62, '#a8763c'); lg.addColorStop(0.64, '#2a1a10'); lg.addColorStop(1, '#1a100a');
  ctx.strokeStyle = lg; ctx.lineCap = 'round'; for (let k = 0; k < 6; k++) { const f0 = k / 6, f1 = (k + 1) / 6; ctx.lineWidth = 0.011 + 0.012 * f0; ctx.beginPath(); ctx.moveTo(sx0 + (sx1 - sx0) * f0, sy0 + (sy1 - sy0) * f0); ctx.lineTo(sx0 + (sx1 - sx0) * f1, sy0 + (sy1 - sy0) * f1); ctx.stroke(); } ctx.lineCap = 'butt'; }

/* ---------- input ---------- */
let drag = null;
cv.addEventListener('pointerdown', e => { if (play) return; cv.setPointerCapture(e.pointerId); const p = toWorld(e);
  if (st.edit) { let k = -1, best = 0.09; balls.forEach((b, i) => { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < best) { best = d; k = i; } }); drag = { k }; return; }
  drag = { aim: true, hist: [] }; aimPoint(p); });
cv.addEventListener('pointermove', e => { if (!drag) return; const p = toWorld(e); if (drag.aim) { aimPoint(p); drag.hist.push([performance.now(), st.phi]); if (drag.hist.length > 40) drag.hist.shift(); } else if (drag.k >= 0) placeBall(drag.k, p.x, p.y); });
// 손가락을 뗄 때 생기는 미세한 흔들림만 되돌림 (마지막 120ms 동안 0.3° 미만 변화일 때)
function settle(hist) { const now = performance.now(); for (let i = hist.length - 1; i >= 0; i--) if (now - hist[i][0] >= 120) { if (Math.abs(st.phi - hist[i][1]) < 0.3 * Math.PI / 180) { st.phi = hist[i][1]; ui(); draw(); } return; } }
const up = () => { if (drag && drag.k >= 0) buildPos(); if (drag && drag.aim) settle(drag.hist); drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
function aimPoint(p) { const c = balls[0]; let x = p.x, y = p.y;
  const onFrame = x < -CUSH || x > L + CUSH || y < -CUSH || y > W + CUSH;
  if (onFrame) { const dm = CUSH + (RAIL - CUSH) / 2; // snap to 0.1 diamond on the diamond line
    const dists = [[Math.abs(x + dm), 'l'], [Math.abs(x - L - dm), 'r'], [Math.abs(y + dm), 'b'], [Math.abs(y - W - dm), 't']].sort((a, b) => a[0] - b[0]); const side = dists[0][1];
    if (side === 'l' || side === 'r') { x = side === 'l' ? -dm : L + dm; y = Math.round(Math.min(4, Math.max(0, y / DW)) * 10) / 10 * DW; }
    else { y = side === 'b' ? -dm : W + dm; x = Math.round(Math.min(8, Math.max(0, x / DL)) * 10) / 10 * DL; } }
  if (Math.hypot(x - c.x, y - c.y) < 0.01) return; st.phi = Math.atan2(y - c.y, x - c.x); ui(); draw(); }
function placeBall(k, x, y) { const lim = R * 1.02; if (st.snap) { x = Math.round(x / DL * 4) / 4 * DL; y = Math.round(y / DW * 4) / 4 * DW; }
  x = Math.min(L - lim, Math.max(lim, x)); y = Math.min(W - lim, Math.max(lim, y));
  for (let i = 0; i < 3; i++) if (i !== k && Math.hypot(balls[i].x - x, balls[i].y - y) < 2 * R + 0.001) return;
  balls[k].x = x; balls[k].y = y; draw(); buildPos(); }
function buildPos() { $('posFields').innerHTML = balls.map((b, k) => `<span>${NAMES[k]}</span><span style="display:flex;gap:4px"><input id="px${k}" inputmode="decimal" value="${dia(b.x / DL)}" aria-label="${NAMES[k]} 가로"><input id="py${k}" inputmode="decimal" value="${dia(b.y / DW)}" aria-label="${NAMES[k]} 세로"></span>`).join('');
  balls.forEach((b, k) => ['x', 'y'].forEach(ax => { $('p' + ax + k).onchange = e => { const v = parseFloat(e.target.value); if (isNaN(v)) return; const was = st.snap; st.snap = false; placeBall(k, ax === 'x' ? v * DL : b.x, ax === 'y' ? v * DW : b.y); st.snap = was; }; })); }

/* ---------- 실제 출발 방향 (스쿼트 포함) ---------- */
function realPhi() { const b = Object.assign({}, balls[0], { q: balls[0].q.slice(), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
  BP.strike(params, b, { phi: st.phi, V: cueSpeed(st.power), a: st.a, b: st.b, elev: st.elev * Math.PI / 180 }); return Math.atan2(b.vy, b.vx); }

/* ---------- thickness (두께) ---------- */
// x = signed lateral offset of the aim line from the 1st object ball centre (+ = aim passes on the left -> hits its left side)
function thickInfo(phi = st.phi) { const c = balls[0], o = balls[st.tgt], dx = o.x - c.x, dy = o.y - c.y, dist = Math.hypot(dx, dy);
  const al = Math.atan2(Math.sin(phi - Math.atan2(dy, dx)), Math.cos(phi - Math.atan2(dy, dx)));
  const x = dist * Math.sin(al), front = Math.cos(al) > 0; return { x, dist, front, f: front && Math.abs(x) < 2 * R ? 1 - Math.abs(x) / (2 * R) : null }; }
function setThick(x) { const c = balls[0], o = balls[st.tgt], dist = Math.hypot(o.x - c.x, o.y - c.y); x = Math.max(-2 * R * 1.3, Math.min(2 * R * 1.3, x));
  if (Math.abs(x) >= dist) return; st.phi = Math.atan2(o.y - c.y, o.x - c.x) + Math.asin(x / dist); ui(); draw(); }
function frac8(f) { const n = Math.round(f * 8); if (n === 8) return '거의 정면'; if (n === 0) return '거의 0'; const g = n % 4 === 0 ? 4 : n % 2 === 0 ? 2 : 1; return (n / g) + '/' + (8 / g); }
const tc = $('thk'), tx = tc.getContext('2d');
function drawThick() { const w = tc.width, h = tc.height, cx = w / 2, cy = h / 2, r = h * 0.36, k = r / R; tx.clearRect(0, 0, w, h);
  const ti = thickInfo(); tx.strokeStyle = 'rgba(255,255,255,.12)'; tx.lineWidth = 2; tx.beginPath(); tx.moveTo(cx, 4); tx.lineTo(cx, h - 4); tx.stroke();
  const col = COLORS[st.tgt]; let g = tx.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); tx.fillStyle = g; tx.beginPath(); tx.arc(cx, cy, r, 0, 7); tx.fill();
  if (ti.front) { const gx = cx - ti.x * k; tx.fillStyle = 'rgba(255,255,255,.55)'; tx.strokeStyle = '#fff'; tx.lineWidth = 2; tx.beginPath(); tx.arc(gx, cy, r, 0, 7); tx.fill(); tx.stroke(); }
  const lbl = t => !t.front ? '적구가 뒤쪽' : t.f === null ? '안 맞음' : (Math.abs(t.x) < 1e-4 ? '정면' : (t.x > 0 ? '좌 ' : '우 ') + frac8(t.f)) + ' ' + Math.round(t.f * 100) + '%';
  const rp = realPhi(), tr = thickInfo(rp);
  if (tr.front) { const gx = cx - tr.x * k; tx.setLineDash([5, 4]); tx.strokeStyle = '#d6a54a'; tx.lineWidth = 2; tx.beginPath(); tx.arc(gx, cy, r, 0, 7); tx.stroke(); tx.setLineDash([]); }
  $('thkTxt').textContent = lbl(ti) + (Math.abs(rp - st.phi) > 1e-4 ? ' → 실제 ' + lbl(tr) : ''); }
let thkDrag = null;
tc.addEventListener('pointerdown', e => { if (play) return; tc.setPointerCapture(e.pointerId); thkDrag = { x: e.clientX, hist: [] }; });
tc.addEventListener('pointermove', e => { if (!thkDrag) return; const dx = e.clientX - thkDrag.x; thkDrag.x = e.clientX; const w = tc.getBoundingClientRect().width;
  setThick(thickInfo().x - dx / w * 4 * R * 0.6); thkDrag.hist.push([performance.now(), st.phi]); if (thkDrag.hist.length > 40) thkDrag.hist.shift(); });
const thkUp = () => { if (thkDrag) settle(thkDrag.hist); thkDrag = null; }; tc.addEventListener('pointerup', thkUp); tc.addEventListener('pointercancel', thkUp);
document.querySelectorAll('.thkrow button').forEach(b => { let t1, t2; const go = () => { if (play) return; setThick(thickInfo().x - (+b.dataset.k) * 2 * R / 64); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); go(); t1 = setTimeout(() => { t2 = setInterval(go, 60); }, 350); });
  const stop = () => { clearTimeout(t1); clearInterval(t2); }; ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => b.addEventListener(k, stop)); });
$('tgt').onclick = () => { st.tgt = st.tgt === 2 ? 1 : 2; $('tgt').textContent = st.tgt === 2 ? '빨강' : '주황'; ui(); };

/* ---------- controls ---------- */
const sc = $('spin'), sx = sc.getContext('2d');
function drawSpin() { const s = 168, c = s / 2, r = 78; sx.clearRect(0, 0, s, s);
  const g = sx.createRadialGradient(c - 24, c - 28, 8, c, c, r); g.addColorStop(0, '#fff'); g.addColorStop(1, '#b9c0c9'); sx.fillStyle = g; sx.beginPath(); sx.arc(c, c, r, 0, 7); sx.fill();
  sx.strokeStyle = 'rgba(20,30,45,.35)'; sx.lineWidth = 1.5; sx.beginPath(); sx.moveTo(c - r, c); sx.lineTo(c + r, c); sx.moveTo(c, c - r); sx.lineTo(c, c + r); sx.stroke();
  sx.strokeStyle = 'rgba(20,30,45,.18)'; for (const f of [0.2, 0.4]) { sx.beginPath(); sx.arc(c, c, r * f, 0, 7); sx.stroke(); }
  sx.setLineDash([5, 5]); sx.strokeStyle = 'rgba(194,54,43,.6)'; sx.beginPath(); sx.arc(c, c, r * params.miscue, 0, 7); sx.stroke(); sx.setLineDash([]);
  sx.fillStyle = '#1d5aa6'; sx.beginPath(); sx.arc(c + st.a * r, c - st.b * r, 9, 0, 7); sx.fill(); sx.strokeStyle = '#fff'; sx.lineWidth = 2; sx.stroke(); }
let spinDrag = false;
function spinTo(e) { const r = sc.getBoundingClientRect(); let a = (e.clientX - r.left) / r.width * 2 - 1, b = -((e.clientY - r.top) / r.height * 2 - 1);
  const m = Math.hypot(a, b), lim = params.miscue * 0.98; if (m > lim) { a *= lim / m; b *= lim / m; } st.a = Math.abs(a) < 0.03 ? 0 : a; st.b = Math.abs(b) < 0.03 ? 0 : b; drawSpin(); ui(); }
sc.addEventListener('pointerdown', e => { spinDrag = true; sc.setPointerCapture(e.pointerId); spinTo(e); });
sc.addEventListener('pointermove', e => { if (spinDrag) spinTo(e); }); sc.addEventListener('pointerup', () => spinDrag = false);
$('spinReset').onclick = () => { st.a = st.b = 0; drawSpin(); ui(); };
$('elev').oninput = e => { st.elev = +e.target.value; ui(); };
$('pow').oninput = e => { st.power = e.target.value / 1000; ui(); draw(); };
document.querySelectorAll('#angBtns button').forEach(b => { let t1, t2; const go = () => { if (play) return; st.phi += parseFloat(b.dataset.d) * Math.PI / 180; ui(); draw(); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); go(); t1 = setTimeout(() => { t2 = setInterval(go, 50); }, 350); });
  const stop = () => { clearTimeout(t1); clearInterval(t2); }; ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => b.addEventListener(k, stop)); });
function spinLabel(a, b) { const s = []; if (b > 0.02) s.push('위 ' + Math.round(b * 100)); if (b < -0.02) s.push('아래 ' + Math.round(-b * 100)); if (a > 0.02) s.push('우 ' + Math.round(a * 100)); if (a < -0.02) s.push('좌 ' + Math.round(-a * 100)); return s.join(' · ') || '중앙'; }
function ui() { drawThick(); $('spinTxt').textContent = spinLabel(st.a, st.b); $('elevTxt').textContent = st.elev + '°';
  $('powTxt').textContent = Math.round(st.power * 100) + '% · ' + cueSpeed(st.power).toFixed(2) + ' m/s';
  $('angTxt').textContent = (st.aimDia ? st.aimDia + ' · ' : '') + (((st.phi * 180 / Math.PI) % 360 + 360) % 360).toFixed(2) + '°';
  $('menu').querySelector('[data-t="info"]').disabled = !last;
  $('shoot').disabled = !!play || st.edit; $('replay').disabled = !last || !!play; $('retry').disabled = !before || !!play; }
const toggle = (id, key, after) => { $(id).onclick = e => { st[key] = !st[key]; e.currentTarget.setAttribute('aria-pressed', st[key]); after && after(); draw(); }; };
toggle('guideBtn', 'guide'); toggle('pathBtn', 'path'); toggle('ghostBtn', 'ghost'); toggle('numBtn', 'nums'); toggle('soundBtn', 'sound'); toggle('pSnap', 'snap');
$('rspeed').onclick = e => { st.rspeed = { 1: 0.5, 0.5: 0.25, 0.25: 0.1, 0.1: 2, 2: 4, 4: 1 }[st.rspeed]; e.currentTarget.textContent = st.rspeed + 'x'; if (play) play.speed = st.rspeed; };
const DT_TITLE = { place: '공 배치', phys: '물리값', info: '샷 기록' };
function openDrawer(t) { $('drawer').hidden = false; $('dTitle').textContent = DT_TITLE[t]; document.querySelectorAll('#drawer .tab').forEach(x => x.hidden = x.id !== 't-' + t);
  document.querySelectorAll('#menu button').forEach(x => x.setAttribute('aria-pressed', x.dataset.t === t)); }
function closeDrawer() { $('drawer').hidden = true; document.querySelectorAll('#menu button').forEach(x => x.setAttribute('aria-pressed', false)); }
document.querySelectorAll('#menu button').forEach(b => b.onclick = () => { if (!$('drawer').hidden && b.getAttribute('aria-pressed') === 'true') closeDrawer(); else openDrawer(b.dataset.t); });
$('dClose').onclick = closeDrawer;
function setEdit(on) { st.edit = on; $('pEdit').setAttribute('aria-pressed', on); $('pEdit').textContent = on ? '공 옮기기 끄기' : '공 옮기기 켜기'; ui(); draw(); }
$('pEdit').onclick = () => setEdit(!st.edit);
$('pBreak').onclick = () => { if (play) return; balls = breakBalls(); aimAt(2); buildPos(); draw(); };
$('pRandom').onclick = () => { if (play) return; balls = breakBalls(); for (let k = 0; k < 3; k++) { let ok = false; while (!ok) { const x = 0.1 + Math.random() * (L - 0.2), y = 0.1 + Math.random() * (W - 0.2); ok = balls.every((b, i) => i >= k || Math.hypot(b.x - x, b.y - y) > 0.15); if (ok) { balls[k].x = x; balls[k].y = y; } } } aimAt(1); buildPos(); draw(); };
function buildSliders() { $('sliders').innerHTML = SLIDERS.map(([k, label, mn, mx, stp]) => `<div><div class="row"><span class="lbl">${label}</span><span class="num" id="v-${k}"></span></div><input type="range" id="s-${k}" min="${mn}" max="${mx}" step="${stp}" value="${params[k]}" aria-label="${label}"></div>`).join('');
  SLIDERS.forEach(([k, , , , stp, mul]) => { const el = $('s-' + k); const dec = Math.max(0, Math.ceil(-Math.log10(stp * (mul || 1)))); const show = () => { $('v-' + k).textContent = (params[k] * (mul || 1)).toFixed(dec); };
    el.value = params[k]; show(); el.oninput = () => { params[k] = +el.value; show(); }; }); }
$('cond').onchange = e => { Object.assign(params, COND[e.target.value]); buildSliders(); };
$('physReset').onclick = () => { params = Object.assign({}, D); $('cond').value = 'normal'; buildSliders(); drawSpin(); };

/* ---------- sound ---------- */
let actx = null;
function snd(kind, speed) { if (!st.sound) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const t0 = actx.currentTime, vol = Math.min(1, 0.08 + speed / 5), len = kind === 'cushion' ? 0.09 : kind === 'cue' ? 0.05 : 0.035;
  const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * len), actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * (kind === 'cushion' ? 0.25 : 0.12)));
  const src = actx.createBufferSource(); src.buffer = buf; const f = actx.createBiquadFilter(); f.type = kind === 'cushion' ? 'lowpass' : 'bandpass';
  f.frequency.value = kind === 'ball' ? 3200 : kind === 'cue' ? 1500 : kind === 'land' ? 900 : 260; f.Q.value = kind === 'ball' ? 6 : 2;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len); src.connect(f).connect(g).connect(actx.destination); src.start(t0); }

/* ---------- shot / playback ---------- */
function shoot() { if (play || st.edit) return; snd('cue', 0);
  before = balls.map(b => Object.assign({}, b, { q: b.q.slice() }));
  const shot = { phi: st.phi, V: cueSpeed(st.power), a: st.a, b: st.b, elev: st.elev * Math.PI / 180 };
  $('busy').hidden = false;
  setTimeout(() => { const t0 = performance.now(); const res = BP.simulate(params, before, shot); res.calcMs = performance.now() - t0; res.shot = shot; res.aimDia = st.aimDia; $('busy').hidden = true;
    if (last) prev = last; last = res; startPlay(res); snd('cue', shot.V); }, 20); }
function startPlay(res) { play = { res, t: 0, speed: st.rspeed, evi: 0 }; $('live').hidden = false; ui(); }
$('shoot').onclick = shoot;
$('replay').onclick = () => { if (!last || play) return; startPlay(last); };
$('retry').onclick = () => { if (!before || play) return; balls = before.map(b => Object.assign({}, b, { q: b.q.slice() })); if (last) st.phi = last.shot.phi; buildPos(); ui(); draw(); };
function liveInfo(res, t) { const hz = params.recordHz, i = Math.min(res.frames.length - 2, Math.max(0, Math.floor(t * hz))), f0 = res.frames[i], f1 = res.frames[i + 1];
  const v = Math.hypot(f1[0] - f0[0], f1[1] - f0[1]) * hz;
  // angular velocity from quaternion change: w = 2 * (q1 * conj(q0)).xyz / dt
  const [a0, b0, c0, d0] = [f0[3], f0[4], f0[5], f0[6]], [a1, b1, c1, d1] = [f1[3], f1[4], f1[5], f1[6]];
  const wx = 2 * hz * (a0 * b1 - b0 * a1 - c0 * d1 + d0 * c1), wy = 2 * hz * (a0 * c1 + b0 * d1 - c0 * a1 - d0 * b1), wz = 2 * hz * (a0 * d1 - b0 * c1 + c0 * b1 - d0 * a1);
  const vx = (f1[0] - f0[0]) * hz, vy = (f1[1] - f0[1]) * hz, slip = Math.hypot(vx - R * wy, vy + R * wx);
  const state = v < 0.003 ? '정지' : f0[7] > 0.5 ? '공중' : slip > 0.03 ? '미끄러짐' : '구름';
  return `수구 ${v.toFixed(2)} m/s · ${state} · 좌우회전 ${(wz / (2 * Math.PI)).toFixed(1)} 회/초`; }
function stepPlay(dt) { const p = play, res = p.res; p.t += dt * p.speed;
  const hz = params.recordHz, fi = Math.min(res.frames.length - 1, p.t * hz), a = Math.floor(fi), b = Math.min(res.frames.length - 1, a + 1), u = fi - a, fa = res.frames[a], fb = res.frames[b];
  const pos = [0, 1, 2].map(k => { const o = k * 8; return [fa[o] + (fb[o] - fa[o]) * u, fa[o + 1] + (fb[o + 1] - fa[o + 1]) * u, fa[o + 2] + (fb[o + 2] - fa[o + 2]) * u, fa[o + 7]]; });
  while (p.evi < res.events.length && res.events[p.evi].t <= p.t) { const e = res.events[p.evi++]; snd(e.type, e.speed); }
  $('live').textContent = liveInfo(res, Math.min(p.t, res.duration));
  draw(pos);
  if (p.t >= res.duration) { play = null; balls = res.balls.map(b => Object.assign({}, b, { q: b.q.slice(), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, still: true, air: false })); $('live').hidden = true; showResult(res); buildPos(); ui(); draw(); } }

/* ---------- result ---------- */
function judge(res) { let cush = 0, hit = [], first = null, at2 = null;
  for (const e of res.events) { if (e.type === 'cushion' && e.i === 0) { if (!first) first = 'rail'; if (hit.length < 2) cush++; }
    if (e.type === 'ball' && (e.i === 0 || e.j === 0)) { const o = e.i === 0 ? e.j : e.i; if (!first) first = 'ball'; if (!hit.includes(o)) { hit.push(o); if (hit.length === 2) at2 = cush; } } }
  return { ok: hit.length === 2 && at2 >= 3, cush, at2, hit, first }; }
function railPoint(res, e) { const f = res.frames[Math.min(res.frames.length - 1, Math.round(e.t * params.recordHz))]; return e.side < 2 ? dia(f[1] / DW) : dia(f[0] / DL); }
function showResult(res) { const j = judge(res), v = $('verdict');
  v.textContent = j.ok ? `득점 · 쿠션 ${j.at2}회${j.first === 'rail' ? ' (빈쿠션)' : ''}` : j.hit.length === 0 ? '실패 · 적구 못 맞힘' : j.hit.length === 1 ? `실패 · 제2적구 미스 (쿠션 ${j.cush})` : `실패 · 쿠션 ${j.at2}회`;
  v.className = 'chip ' + (j.ok ? 'good' : 'bad');
  const s = res.shot, cueV = Math.hypot(res.frames[1][0] - res.frames[0][0], res.frames[1][1] - res.frames[0][1]) * params.recordHz;
  const cush = res.events.filter(e => e.type === 'cushion' && e.i === 0).slice(0, 6).map((e, k) => `${k + 1}쿠션 ${RAILNAME[e.side].replace('쿠션', '')} ${railPoint(res, e)}`);
  $('shotInfo').innerHTML = [['조준', res.aimDia || '-'], ['큐 속도', s.V.toFixed(2) + ' m/s'], ['수구 초속', cueV.toFixed(2) + ' m/s'], ['당점', spinLabel(s.a, s.b)], ['큐 기울기', Math.round(s.elev * 180 / Math.PI) + '°'],
    ['스쿼트', res.strike.squirtDeg.toFixed(2) + '°' + (res.strike.miscue ? ' · 미스큐!' : '')], ['진행 시간', res.duration.toFixed(1) + ' 초'], ['계산 시간', Math.round(res.calcMs) + ' ms']].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')
    + (cush.length ? `<span>수구 쿠션 지점</span><b style="font-size:12px;line-height:1.5">${cush.join('<br>')}</b>` : '');
  $('evList').innerHTML = res.events.filter(e => e.type !== 'land' || e.speed > 0.3).slice(0, 60).map(e => `<tr><td>${e.t.toFixed(2)}s</td><td>${e.type === 'ball' ? NAMES[e.i] + '↔' + NAMES[e.j] : e.type === 'cushion' ? NAMES[e.i] + ' → ' + RAILNAME[e.side] + ' ' + railPoint(res, e) : NAMES[e.i] + ' 착지'}</td><td>${e.speed.toFixed(2)} m/s</td></tr>`).join(''); }

/* ---------- loop ---------- */
let lastT = performance.now();
function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; if (play) stepPlay(dt); requestAnimationFrame(frame); }
buildSliders(); buildPos(); drawSpin(); ui(); resize(); requestAnimationFrame(frame);
