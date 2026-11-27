/* ===================== 3D 실험실 ===================== */
const BP = BilliardPhysics, D = BP.DEFAULTS;
const $ = id => document.getElementById(id);
let params = Object.assign({}, D);
const R = D.R, L = D.L, W = D.W;
const COND = { fast: { muR: 0.0065, muS: 0.18, spinDecel: 8, eCushion: 0.88 }, normal: { muR: 0.0085, muS: 0.20, spinDecel: 10, eCushion: 0.86 }, slow: { muR: 0.0115, muS: 0.22, spinDecel: 12, eCushion: 0.83 } };
const SLIDERS = [
  ['muR', '구름 저항', 0.004, 0.016, 0.0005], ['muS', '미끄럼 마찰', 0.1, 0.35, 0.01], ['spinDecel', '좌우회전 감쇠 (rad/s²)', 2, 25, 0.5],
  ['eCushion', '쿠션 반발', 0.6, 0.98, 0.01], ['muCushion', '쿠션 마찰', 0.05, 0.4, 0.01], ['cushionH', '쿠션 높이 (mm)', 0.033, 0.042, 0.0005, 1000],
  ['eBall', '공-공 반발', 0.85, 0.99, 0.005], ['cueEndMass', '큐 끝 질량 (스쿼트, g)', 0.003, 0.02, 0.0005, 1000], ['cueTipE', '큐 팁 반발', 0.5, 0.95, 0.01]];
const st = { phi: 0, a: 0, b: 0, elev: 5, power: 0.38, cam: 'aim', camPitch: 0.16, camDist: 0.95, guide: true, path: true, sound: true, edit: false, rspeed: 1 };
let balls = breakBalls();
let play = null, last = null, before = null;

function breakBalls() { return [BP.makeBall('w', 0.71, 0.71 - 0.1524, D), BP.makeBall('o', 0.71, 0.71, D), BP.makeBall('r', 2.13, 0.71, D)]; }
function cueSpeed(p) { return 0.35 + 7.65 * Math.pow(p, 1.6); }
function aimAt(i) { const c = balls[0], o = balls[i]; st.phi = Math.atan2(o.y - c.y, o.x - c.x); }
aimAt(2);

/* ---------- Three.js scene ---------- */
const cv = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0e12); scene.fog = new THREE.Fog(0x0b0e12, 6, 14);
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 40);
// table frame -> three: X = x - L/2, Y = z, Z = -(y - W/2)
const T = (x, y, z) => new THREE.Vector3(x - L / 2, z, -(y - W / 2));

scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1208, 0.45));
const lamps = [];
for (const x of [-0.75, 0.75]) {
  const s = new THREE.SpotLight(0xfff3dc, 1.25, 6, 0.9, 0.55, 1.2); s.position.set(x, 1.6, 0); s.target.position.set(x, 0, 0);
  s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0004; s.shadow.radius = 4; scene.add(s, s.target);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.12, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f3b2c, side: THREE.DoubleSide, roughness: 0.6 }));
  shade.position.set(x, 1.62, 0); scene.add(shade); lamps.push(shade);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ color: 0xfff4d6 })); bulb.rotation.x = Math.PI / 2; bulb.position.set(x, 1.565, 0); scene.add(bulb); lamps.push(bulb);
}
// cloth (slate)
function clothTexture() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#1f5fb0'; g.fillRect(0, 0, 256, 256); const id = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * 14; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 4); t.encoding = THREE.sRGBEncoding; return t; }
const clothMat = new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.95, metalness: 0 });
const bed = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.1, W + 0.1), clothMat); bed.rotation.x = -Math.PI / 2; bed.receiveShadow = true; scene.add(bed);
// cushions: inner face on the play boundary, nose height cushionH
const CH = D.cushionH, CW = 0.05, cushMat = new THREE.MeshStandardMaterial({ color: 0x1b56a0, roughness: 0.9 });
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }
box(L + 2 * CW, CH + 0.006, CW, cushMat, 0, (CH + 0.006) / 2, -(W / 2 + CW / 2));
box(L + 2 * CW, CH + 0.006, CW, cushMat, 0, (CH + 0.006) / 2, W / 2 + CW / 2);
box(CW, CH + 0.006, W, cushMat, -(L / 2 + CW / 2), (CH + 0.006) / 2, 0);
box(CW, CH + 0.006, W, cushMat, L / 2 + CW / 2, (CH + 0.006) / 2, 0);
// wooden rails
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5b3920, roughness: 0.45, metalness: 0.05 });
const RW = 0.12, RH = CH + 0.012, o = CW + RW / 2;
box(L + 2 * (CW + RW), RH, RW, woodMat, 0, RH / 2, -(W / 2 + o)); box(L + 2 * (CW + RW), RH, RW, woodMat, 0, RH / 2, W / 2 + o);
box(RW, RH, W + 2 * CW, woodMat, -(L / 2 + o), RH / 2, 0); box(RW, RH, W + 2 * CW, woodMat, L / 2 + o, RH / 2, 0);
box(L + 2 * (CW + RW) + 0.02, 0.22, W + 2 * (CW + RW) + 0.02, woodMat, 0, -0.112, 0);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.75; floor.receiveShadow = true; scene.add(floor);
// diamonds
const dMat = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.3 });
const dGeo = new THREE.CircleGeometry(0.008, 4); const addD = (x, z) => { const m = new THREE.Mesh(dGeo, dMat); m.rotation.x = -Math.PI / 2; m.position.set(x, RH + 0.0005, z); scene.add(m); };
for (let i = 0; i <= 8; i++) { addD(-L / 2 + i * L / 8, -(W / 2 + o)); addD(-L / 2 + i * L / 8, W / 2 + o); }
for (let j = 1; j < 4; j++) { addD(-(L / 2 + o), -W / 2 + j * W / 4); addD(L / 2 + o, -W / 2 + j * W / 4); }
// spots
for (const [x, y] of [[0.71, 0.71], [2.13, 0.71], [1.42, 0.71]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), new THREE.MeshBasicMaterial({ color: 0x9fb9dd })); m.rotation.x = -Math.PI / 2; m.position.copy(T(x, y, 0.0004)); scene.add(m); }
// balls with dot markings so spin is visible
function ballTex(base, dot) { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  g.fillStyle = dot; for (const [u, v] of [[0, 128], [128, 128], [256, 128], [384, 128], [512, 128]]) { g.beginPath(); g.ellipse(u, v, 13, 13, 0, 0, 7); g.fill(); }
  g.fillRect(0, 0, 512, 9); g.fillRect(0, 247, 512, 9); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
const ballMeshes = [['#f4f2ec', '#c33a2e'], ['#ff9a2e', '#7a3a0c'], ['#d92b20', '#f4f2ec']].map(([b, d]) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.MeshStandardMaterial({ map: ballTex(b, d), roughness: 0.18, metalness: 0 }));
  m.castShadow = true; scene.add(m); return m; });
// cue stick
const cue = new THREE.Group(); scene.add(cue);
{ const len = 1.42, shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0145, len, 20), new THREE.MeshStandardMaterial({ color: 0xd8b27a, roughness: 0.4 }));
  shaft.rotation.z = Math.PI / 2; shaft.position.x = -len / 2; shaft.castShadow = true; cue.add(shaft);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.0128, 0.0148, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x241510, roughness: 0.35 })); butt.rotation.z = Math.PI / 2; butt.position.x = -len + 0.25; cue.add(butt);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0061, 0.0061, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0x2f6fd0, roughness: 0.8 })); tip.rotation.z = Math.PI / 2; tip.position.x = -0.006; cue.add(tip); }
// guide line & path lines
const guideMat = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.025, gapSize: 0.015, transparent: true, opacity: 0.8 });
const guide = new THREE.Line(new THREE.BufferGeometry(), guideMat); scene.add(guide);
const ghost = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 })); scene.add(ghost);
const objLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xd6a54a })); scene.add(objLine);
const pathLines = [0xffffff, 0xffa040, 0xff4a3a].map(c => { const l = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.55 })); scene.add(l); return l; });

/* ---------- sizing ---------- */
function resize() { const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(cv);

/* ---------- ball pose ---------- */
function setBall(k, x, y, z, q) { const m = ballMeshes[k]; m.position.copy(T(x, y, z)); if (q) m.quaternion.set(q[1], q[3], -q[2], q[0]); }
function syncBalls() { balls.forEach((b, k) => setBall(k, b.x, b.y, b.z, b.q)); }

/* ---------- guide ---------- */
function cast(px, py, dx, dy) { let best = Infinity, hit = null;
  balls.forEach((b, i) => { if (i === 0) return; const ox = px - b.x, oy = py - b.y, bq = ox * dx + oy * dy, cq = ox * ox + oy * oy - 4 * R * R, disc = bq * bq - cq;
    if (disc > 0) { const t = -bq - Math.sqrt(disc); if (t > 1e-6 && t < best) { best = t; hit = { type: 'ball', i }; } } });
  const lim = R * Math.sqrt(1 - Math.pow((params.cushionH - R) / R, 2));
  [[dx < 0, (lim - px) / dx, 'x'], [dx > 0, (L - lim - px) / dx, 'x'], [dy < 0, (lim - py) / dy, 'y'], [dy > 0, (W - lim - py) / dy, 'y']].forEach(([ok, t, ax]) => { if (ok && t > 1e-6 && t < best) { best = t; hit = { type: 'rail', ax }; } });
  return { t: best, hit }; }
function updateGuide() {
  const show = st.guide && !play; guide.visible = ghost.visible = objLine.visible = show; if (!show) return;
  const c = balls[0], dx = Math.cos(st.phi), dy = Math.sin(st.phi), r = cast(c.x, c.y, dx, dy), ex = c.x + dx * r.t, ey = c.y + dy * r.t;
  guide.geometry.setFromPoints([T(c.x, c.y, R), T(ex, ey, R)]); guide.computeLineDistances(); ghost.position.copy(T(ex, ey, R));
  let pts = [];
  if (r.hit && r.hit.type === 'ball') { const b = balls[r.hit.i]; let nx = b.x - ex, ny = b.y - ey; const m = Math.hypot(nx, ny); pts = [T(b.x, b.y, R), T(b.x + nx / m * 0.3, b.y + ny / m * 0.3, R)]; }
  else if (r.hit) { const rx = r.hit.ax === 'x' ? -dx : dx, ry = r.hit.ax === 'y' ? -dy : dy; pts = [T(ex, ey, R), T(ex + rx * 0.4, ey + ry * 0.4, R)]; }
  objLine.geometry.setFromPoints(pts.length ? pts : [T(0, 0, -1), T(0, 0, -1)]); }

/* ---------- cue placement ---------- */
let strokeAnim = 0;
function updateCue() {
  cue.visible = !play || strokeAnim > 0; if (!cue.visible) return;
  const c = balls[0], el = st.elev * Math.PI / 180;
  const d = [Math.cos(el) * Math.cos(st.phi), Math.cos(el) * Math.sin(st.phi), -Math.sin(el)];
  const rgt = [Math.sin(st.phi), -Math.cos(st.phi), 0], up = [rgt[1] * d[2] - rgt[2] * d[1], rgt[2] * d[0] - rgt[0] * d[2], rgt[0] * d[1] - rgt[1] * d[0]];
  const cc = Math.sqrt(Math.max(0, 1 - st.a * st.a - st.b * st.b)) * R;
  const gap = strokeAnim > 0 ? 0.004 + 0.12 * strokeAnim : 0.012 + 0.10 * st.power;
  const p = [0, 1, 2].map(k => st.a * R * rgt[k] + st.b * R * up[k] - (cc + gap) * d[k]);
  const tipPos = T(c.x + p[0], c.y + p[1], c.z + p[2]);
  const dirT = T(c.x + d[0], c.y + d[1], c.z + d[2]).sub(T(c.x, c.y, c.z)).normalize();
  cue.position.copy(tipPos); cue.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dirT); }

/* ---------- camera ---------- */
const camTarget = new THREE.Vector3(); let camPos = new THREE.Vector3(0, 3, 0.01), camLook = new THREE.Vector3();
function desiredCam() {
  const mode = play && st.cam === 'aim' ? 'tv' : st.cam; lamps.forEach(l => l.visible = mode !== 'top');
  if (mode === 'top') { const portrait = cv.clientHeight > cv.clientWidth; return [new THREE.Vector3(0, portrait ? 4.6 : 3.05, 0.001), new THREE.Vector3(0, 0, 0), portrait]; }
  if (mode === 'tv') return [new THREE.Vector3(0, 2.15, 2.2), new THREE.Vector3(0, -0.1, 0.1), false];
  const c = balls[0], back = st.camDist, h = 0.06 + back * Math.tan(st.camPitch);
  const pos = T(c.x - Math.cos(st.phi) * back, c.y - Math.sin(st.phi) * back, h + R);
  const look = T(c.x + Math.cos(st.phi) * 0.6, c.y + Math.sin(st.phi) * 0.6, R); return [pos, look, false]; }
function updateCamera(snap) {
  const [p, l, rot] = desiredCam(); const k = snap ? 1 : 0.18; camPos.lerp(p, k); camLook.lerp(l, k);
  const top = (play && st.cam === 'aim' ? 'tv' : st.cam) === 'top';
  camera.position.copy(camPos); if (top) camera.up.set(rot ? 1 : 0, 0, rot ? 0 : -1); else camera.up.set(0, 1, 0); camera.lookAt(camLook); }
function camLabel() { return { aim: '시점: 조준', tv: '시점: 중계', top: '시점: 위에서' }[st.cam]; }
$('camBtn').onclick = () => { st.cam = st.cam === 'aim' ? 'tv' : st.cam === 'tv' ? 'top' : 'aim'; if (st.edit && st.cam !== 'top') setEdit(false); $('camBtn').textContent = camLabel(); };

/* ---------- pointer input ---------- */
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
function tablePoint(e) { const r = cv.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return null; return { x: p.x + L / 2, y: -p.z + W / 2 }; }
const ptrs = new Map(); let drag = null, pinch0 = 0;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
  if (play) return;
  if (st.edit) { const p = tablePoint(e); if (!p) return; let k = -1, best = 0.08; balls.forEach((b, i) => { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < best) { best = d; k = i; } }); drag = { kind: 'ball', k }; return; }
  if (st.cam === 'top') { drag = { kind: 'point' }; aimPoint(e); return; }
  drag = { kind: 'orbit', x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) { st.camDist = Math.min(2.6, Math.max(0.3, st.camDist * pinch0 / d)); pinch0 = d; } return; }
  if (!drag) return;
  if (drag.kind === 'ball' && drag.k >= 0) { const p = tablePoint(e); if (!p) return; placeBall(drag.k, p.x, p.y); }
  else if (drag.kind === 'point') aimPoint(e);
  else if (drag.kind === 'orbit') { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    st.phi -= dx * 0.0022 * Math.max(0.3, Math.min(1, st.camDist)); st.camPitch = Math.min(1.35, Math.max(0.02, st.camPitch + dy * 0.004)); ui(); } });
const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; if (!ptrs.size) drag = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
function aimPoint(e) { const p = tablePoint(e), c = balls[0]; if (!p || Math.hypot(p.x - c.x, p.y - c.y) < 0.01) return; st.phi = Math.atan2(p.y - c.y, p.x - c.x); ui(); }
function placeBall(k, x, y) { const lim = R * 1.02; x = Math.min(L - lim, Math.max(lim, x)); y = Math.min(W - lim, Math.max(lim, y));
  for (let i = 0; i < 3; i++) if (i !== k && Math.hypot(balls[i].x - x, balls[i].y - y) < 2 * R + 0.001) return;
  balls[k].x = x; balls[k].y = y; syncBalls(); }

/* ---------- controls ---------- */
const sc = $('spin'), sx = sc.getContext('2d');
function drawSpin() { const s = 192, c = s / 2, r = 86; sx.clearRect(0, 0, s, s);
  const g = sx.createRadialGradient(c - 24, c - 28, 8, c, c, r); g.addColorStop(0, '#fff'); g.addColorStop(1, '#b9c0c9'); sx.fillStyle = g; sx.beginPath(); sx.arc(c, c, r, 0, 7); sx.fill();
  sx.strokeStyle = 'rgba(20,30,45,.35)'; sx.lineWidth = 1.5; sx.beginPath(); sx.moveTo(c - r, c); sx.lineTo(c + r, c); sx.moveTo(c, c - r); sx.lineTo(c, c + r); sx.stroke();
  sx.setLineDash([5, 5]); sx.strokeStyle = 'rgba(194,54,43,.6)'; sx.beginPath(); sx.arc(c, c, r * params.miscue, 0, 7); sx.stroke(); sx.setLineDash([]);
  sx.fillStyle = '#1d5aa6'; sx.beginPath(); sx.arc(c + st.a * r, c - st.b * r, 9, 0, 7); sx.fill(); sx.strokeStyle = '#fff'; sx.lineWidth = 2; sx.stroke(); }
let spinDrag = false;
function spinTo(e) { const r = sc.getBoundingClientRect(); let a = (e.clientX - r.left) / r.width * 2 - 1, b = -((e.clientY - r.top) / r.height * 2 - 1);
  const m = Math.hypot(a, b), lim = params.miscue * 0.98; if (m > lim) { a *= lim / m; b *= lim / m; } st.a = Math.abs(a) < 0.03 ? 0 : a; st.b = Math.abs(b) < 0.03 ? 0 : b; drawSpin(); ui(); }
sc.addEventListener('pointerdown', e => { spinDrag = true; sc.setPointerCapture(e.pointerId); spinTo(e); });
sc.addEventListener('pointermove', e => { if (spinDrag) spinTo(e); }); sc.addEventListener('pointerup', () => spinDrag = false);
$('spinReset').onclick = () => { st.a = st.b = 0; drawSpin(); ui(); };
$('elev').oninput = e => { st.elev = +e.target.value; ui(); };
$('pow').oninput = e => { st.power = e.target.value / 1000; ui(); };
document.querySelectorAll('#t-shot .g4 button').forEach(b => { let t1, t2; const go = () => { if (play) return; st.phi += parseFloat(b.dataset.d) * Math.PI / 180; ui(); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); go(); t1 = setTimeout(() => { t2 = setInterval(go, 50); }, 350); });
  const stop = () => { clearTimeout(t1); clearInterval(t2); }; ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => b.addEventListener(k, stop)); });
function spinLabel(a, b) { const s = []; if (b > 0.02) s.push('위 ' + Math.round(b * 100)); if (b < -0.02) s.push('아래 ' + Math.round(-b * 100)); if (a > 0.02) s.push('우 ' + Math.round(a * 100)); if (a < -0.02) s.push('좌 ' + Math.round(-a * 100)); return s.join(' · ') || '중앙'; }
function ui() { $('spinTxt').textContent = spinLabel(st.a, st.b); $('elevTxt').textContent = st.elev + '°';
  $('powTxt').textContent = Math.round(st.power * 100) + '% · ' + cueSpeed(st.power).toFixed(2) + ' m/s';
  $('angTxt').textContent = (((st.phi * 180 / Math.PI) % 360 + 360) % 360).toFixed(2) + '°';
  $('shoot').disabled = !!play || st.edit; $('replay').disabled = !last || !!play; $('retry').disabled = !before || !!play; }
const toggle = (id, key, after) => { $(id).onclick = e => { st[key] = !st[key]; e.currentTarget.setAttribute('aria-pressed', st[key]); after && after(); }; };
toggle('guideBtn', 'guide'); toggle('pathBtn', 'path', () => pathLines.forEach(l => l.visible = st.path)); toggle('soundBtn', 'sound');
$('rspeed').onclick = e => { st.rspeed = { 1: 0.5, 0.5: 0.25, 0.25: 0.1, 0.1: 2, 2: 1 }[st.rspeed]; e.currentTarget.textContent = st.rspeed + 'x'; if (play) play.speed = st.rspeed; };
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.tab').forEach(t => t.hidden = t.id !== 't-' + b.dataset.t); });
function setEdit(on) { st.edit = on; $('pEdit').setAttribute('aria-pressed', on); $('pEdit').textContent = on ? '공 옮기기 끄기' : '공 옮기기 켜기'; if (on) { st.cam = 'top'; $('camBtn').textContent = camLabel(); } ui(); }
$('pEdit').onclick = () => setEdit(!st.edit);
$('pBreak').onclick = () => { if (play) return; balls = breakBalls(); aimAt(2); syncBalls(); clearPaths(); };
$('pRandom').onclick = () => { if (play) return; balls = breakBalls(); for (let k = 0; k < 3; k++) { let ok = false; while (!ok) { const x = 0.1 + Math.random() * (L - 0.2), y = 0.1 + Math.random() * (W - 0.2); ok = balls.every((b, i) => i >= k || Math.hypot(b.x - x, b.y - y) > 0.15); if (ok) { balls[k].x = x; balls[k].y = y; } } } aimAt(1); syncBalls(); clearPaths(); };
// physics sliders
function buildSliders() { $('sliders').innerHTML = SLIDERS.map(([k, label, mn, mx, stp, mul]) => `<div><div class="row"><span class="lbl">${label}</span><span class="num" id="v-${k}"></span></div><input type="range" id="s-${k}" min="${mn}" max="${mx}" step="${stp}" value="${params[k]}" aria-label="${label}"></div>`).join('');
  SLIDERS.forEach(([k, , , , stp, mul]) => { const el = $('s-' + k); const show = () => { const v = params[k] * (mul || 1); $('v-' + k).textContent = v.toFixed(stp * (mul || 1) < 0.01 ? 4 : stp * (mul || 1) < 0.1 ? 3 : 1).replace(/\.?0+$/, m => m.startsWith('.') && m.length > 1 ? '' : m); };
    el.value = params[k]; show(); el.oninput = () => { params[k] = +el.value; show(); drawSpin(); }; }); }
$('cond').onchange = e => { Object.assign(params, COND[e.target.value]); buildSliders(); };
$('physReset').onclick = () => { params = Object.assign({}, D); $('cond').value = 'normal'; buildSliders(); drawSpin(); };

/* ---------- sound (synthesized) ---------- */
let actx = null;
function snd(kind, speed) { if (!st.sound) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const t0 = actx.currentTime, vol = Math.min(1, 0.08 + speed / 5), len = kind === 'cushion' ? 0.09 : kind === 'cue' ? 0.05 : 0.035;
  const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * len), actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * (kind === 'cushion' ? 0.25 : 0.12)));
  const src = actx.createBufferSource(); src.buffer = buf; const f = actx.createBiquadFilter();
  f.type = kind === 'cushion' ? 'lowpass' : 'bandpass'; f.frequency.value = kind === 'ball' ? 3200 : kind === 'cue' ? 1500 : kind === 'land' ? 900 : 260; f.Q.value = kind === 'ball' ? 6 : 2;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len); src.connect(f).connect(g).connect(actx.destination); src.start(t0);
  if (kind === 'ball') { const o = actx.createOscillator(), og = actx.createGain(); o.frequency.value = 2900; og.gain.setValueAtTime(vol * 0.35, t0); og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05); o.connect(og).connect(actx.destination); o.start(t0); o.stop(t0 + 0.06); } }

/* ---------- shooting & playback ---------- */
function clearPaths() { pathLines.forEach(l => l.geometry.setFromPoints([])); $('verdict').textContent = '샷을 쳐보세요'; $('verdict').className = 'chip'; }
function shoot() { if (play || st.edit) return; snd('cue', 0); // unlock audio within the gesture
  before = balls.map(b => Object.assign({}, b, { q: b.q.slice() }));
  const shot = { phi: st.phi, V: cueSpeed(st.power), a: st.a, b: st.b, elev: st.elev * Math.PI / 180 };
  $('busy').hidden = false;
  setTimeout(() => { const t0 = performance.now(); const res = BP.simulate(params, before, shot); res.calcMs = performance.now() - t0; res.shot = shot; $('busy').hidden = true;
    last = res; strokeAnim = 1; startPlay(res, true); }, 30); }
function startPlay(res, withStroke) { play = { res, t: withStroke ? -0.35 : 0, speed: st.rspeed, evi: 0, stroke: withStroke }; balls = res.balls.map((b, k) => Object.assign({}, before[k])); clearPaths(); ui(); }
$('shoot').onclick = shoot;
$('replay').onclick = () => { if (!last || play) return; startPlay(last, false); };
$('retry').onclick = () => { if (!before || play) return; balls = before.map(b => Object.assign({}, b, { q: b.q.slice() })); syncBalls(); clearPaths(); last && (st.phi = last.shot.phi); ui(); };
function frameAt(res, t) { const f = res.frames, i = Math.min(f.length - 1, Math.max(0, t * params.recordHz)); const a = Math.floor(i), b = Math.min(f.length - 1, a + 1), u = i - a; return [f[a], f[b], u]; }
function stepPlay(dt) {
  const p = play; p.t += dt * p.speed;
  if (p.t < 0) { strokeAnim = Math.max(0, -p.t / 0.35); return; }
  if (p.stroke) { p.stroke = false; strokeAnim = 0; snd('cue', p.res.shot.V); }
  const res = p.res; const [fa, fb, u] = frameAt(res, p.t);
  for (let k = 0; k < 3; k++) { const o = k * 8; setBall(k, fa[o] + (fb[o] - fa[o]) * u, fa[o + 1] + (fb[o + 1] - fa[o + 1]) * u, fa[o + 2] + (fb[o + 2] - fa[o + 2]) * u, [fa[o + 3], fa[o + 4], fa[o + 5], fa[o + 6]]); }
  while (p.evi < res.events.length && res.events[p.evi].t <= p.t) { const e = res.events[p.evi++]; snd(e.type, e.speed); }
  if (st.path) drawPaths(res, p.t);
  if (p.t >= res.duration) { play = null; balls = res.balls.map(b => Object.assign({}, b, { q: b.q.slice(), vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, still: true, air: false })); syncBalls(); showResult(res); ui(); } }
function drawPaths(res, t) { const n = Math.min(res.frames.length - 1, Math.floor(t * params.recordHz));
  for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= n; i += 2) { const f = res.frames[i]; pts.push(T(f[k * 8], f[k * 8 + 1], 0.002)); } pathLines[k].geometry.setFromPoints(pts); } }

/* ---------- result & info ---------- */
function judge(res) { let cush = 0, hit = [], first = null, at2 = null;
  for (const e of res.events) { if (e.type === 'cushion' && e.i === 0) { if (!first) first = 'rail'; if (hit.length < 2) cush++; }
    if (e.type === 'ball' && (e.i === 0 || e.j === 0)) { const o = e.i === 0 ? e.j : e.i; if (!first) first = 'ball'; if (!hit.includes(o)) { hit.push(o); if (hit.length === 2) at2 = cush; } } }
  const ok = hit.length === 2 && at2 >= 3; return { ok, cush, at2, hit, first }; }
function showResult(res) { const j = judge(res), v = $('verdict');
  v.textContent = j.ok ? `득점 · 쿠션 ${j.at2}회${j.first === 'rail' ? ' (빈쿠션)' : ''}` : j.hit.length === 0 ? '실패 · 적구 못 맞힘' : j.hit.length === 1 ? `실패 · 제2적구 미스 (쿠션 ${j.cush})` : `실패 · 쿠션 ${j.at2}회`;
  v.className = 'chip ' + (j.ok ? 'good' : 'bad');
  const s = res.shot, b0 = res.frames[1], cueV = Math.hypot(b0[0] - res.frames[0][0], b0[1] - res.frames[0][1]) * params.recordHz;
  $('shotInfo').innerHTML = [['큐 속도', s.V.toFixed(2) + ' m/s'], ['수구 초속', cueV.toFixed(2) + ' m/s'], ['당점', spinLabel(s.a, s.b)], ['큐 기울기', Math.round(s.elev * 180 / Math.PI) + '°'],
    ['스쿼트', res.strike.squirtDeg.toFixed(2) + '°' + (res.strike.miscue ? ' · 미스큐!' : '')], ['진행 시간', res.duration.toFixed(1) + ' 초'], ['계산 시간', Math.round(res.calcMs) + ' ms']].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
  const nm = ['흰', '주황', '빨강'], side = ['왼쪽 단쿠션', '오른쪽 단쿠션', '아래 장쿠션', '위 장쿠션'];
  $('evList').innerHTML = res.events.filter(e => e.type !== 'land' || e.speed > 0.3).slice(0, 60).map(e => `<tr><td>${e.t.toFixed(2)}s</td><td>${e.type === 'ball' ? nm[e.i] + '↔' + nm[e.j] : e.type === 'cushion' ? nm[e.i] + ' → ' + side[e.side] : nm[e.i] + ' 착지'}</td><td>${e.speed.toFixed(2)} m/s</td></tr>`).join(''); }

/* ---------- loop ---------- */
let lastT = performance.now();
function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (play) stepPlay(dt); else { syncBalls(); }
  updateGuide(); updateCue(); updateCamera(false); renderer.render(scene, camera); requestAnimationFrame(frame); }
buildSliders(); drawSpin(); ui(); syncBalls(); resize(); updateCamera(true); requestAnimationFrame(frame);
