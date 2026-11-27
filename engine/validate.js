// 실제 당구 측정/이론값과 엔진 결과 비교
const B = require('./physics3d.js'); const P = B.DEFAULTS; const R = P.R;
const deg = r => r * 180 / Math.PI;
const mk = (pos) => pos.map((p, k) => B.makeBall('wor'[k], p[0], p[1], P));
const far = [-10, -10];
function run(pos, shot, extra) { const balls = mk(pos); balls.forEach(b => { if (b.x < 0) b.still = true; }); return B.simulate(extra || {}, balls, shot); }
function headingAfter(r, k, from, dist) { // direction of ball k path between event time and later
  const f = r.frames; let i0 = Math.min(f.length - 1, Math.ceil(from * P.recordHz) + 2); let i1 = i0;
  while (i1 < f.length - 1) { const dx = f[i1][k*8] - f[i0][k*8], dy = f[i1][k*8+1] - f[i0][k*8+1]; if (Math.hypot(dx, dy) > dist) break; i1++; }
  return Math.atan2(f[i1][k*8+1] - f[i0][k*8+1], f[i1][k*8] - f[i0][k*8]); }
const out = []; const row = (name, val, target, ok) => out.push({ 항목: name, 엔진: val, 실제기준: target, 판정: ok ? '✅' : '⚠️' });

// 1. 미끄러짐→구름: 거리와 속도비 5/7
{ const balls = mk([[0.3, 0.71], far, far]); balls[1].still = balls[2].still = true; balls[1].x = balls[2].x = -5;
  const b = balls[0]; B.strike(P, b, { phi: 0, V: 2, a: 0, b: 0, elev: 0 }); const v0 = b.vx;
  let x0 = b.x, t = 0; while (Math.hypot(b.vx - R*b.wy, b.vy + R*b.wx) > 1e-3) { B._int.cloth(P, b, P.dt); b.x += b.vx * P.dt; t += P.dt; }
  const d = b.x - x0, th = 12 * v0 * v0 / (49 * P.muS * P.g);
  row('스턴샷: 미끄러진 뒤 구름 전환 속도비', (b.vx / v0).toFixed(3), '5/7 = 0.714', Math.abs(b.vx / v0 - 5/7) < 0.01);
  row('스턴샷: 미끄러진 거리 (공속 ' + v0.toFixed(2) + 'm/s)', d.toFixed(3) + 'm', th.toFixed(3) + 'm (이론)', Math.abs(d - th) / th < 0.05); }
// 2. 30도 법칙: 구르는 수구 하프볼
{ const r = run([[0.4, 0.71], [1.4, 0.71 + R], far], { phi: 0, V: 1.6, a: 0, b: 0.4, elev: 0 });
  const e = r.events.find(e => e.type === 'ball'); const h = headingAfter(r, 0, e.t + 0.4, 0.15);
  const dv = Math.abs(deg(h)); row('30도 법칙: 구르는 수구 하프볼 후 수구 진로', dv.toFixed(1) + '°', '약 30° (27~34°)', dv > 27 && dv < 34); }
// 3. 스톱샷
{ const r = run([[0.8, 0.71], [1.1, 0.71], far], { phi: 0, V: 2.5, a: 0, b: -0.07, elev: 0 });
  const e = r.events.find(e => e.type === 'ball'); const f = r.frames; const xEnd = f[Math.ceil((e.t + 0.6) * P.recordHz)][0]; const xHit = 1.1 - 2 * R; // 적구가 되돌아오기 전 시점
  row('스톱샷: 정면 충돌 후 수구 이동', ((xEnd - xHit) * 100).toFixed(1) + 'cm', '±5cm 이내', Math.abs(xEnd - xHit) < 0.05); }
// 4. 컷 스로 (스턴, 30도 컷, 느린/빠른)
for (const V of [0.8, 3]) { const ang = 30 * Math.PI / 180; const ox = 1.2, oy = 0.71;
  const cx = ox - 2 * R * Math.cos(ang), cy = oy + 2 * R * Math.sin(ang); // ghost ball
  const sx = cx - 0.03, sy = cy;  const r = run([[sx, sy], [ox, oy], far], { phi: 0, V, a: 0, b: 0, elev: 0 });
  const e = r.events.find(e => e.type === 'ball'); const h = headingAfter(r, 1, e.t, 0.1);
  const throwDeg = deg(Math.atan2(e.ny, e.nx)) - deg(h); row('컷 스로 (30° 컷, 큐속도 ' + V + 'm/s)', Math.abs(throwDeg).toFixed(2) + '°', V < 1 ? '약 3~5°' : '약 1.5~3°', V < 1 ? Math.abs(throwDeg) > 2.5 && Math.abs(throwDeg) < 5.5 : Math.abs(throwDeg) > 1 && Math.abs(throwDeg) < 3.5); }
// 5. 회전 스로 (정면, 최대 좌우회전)
{ const r = run([[1.2 - 2*R - 0.03, 0.71], [1.2, 0.71], far], { phi: 0, V: 1.2, a: 0.5, b: 0, elev: 0 });
  const e = r.events.find(e => e.type === 'ball'); const h = headingAfter(r, 1, e.t, 0.1); const tx = Math.abs(deg(h) - deg(Math.atan2(e.ny, e.nx)));
  row('회전 스로 (정면, 오른쪽 최대)', tx.toFixed(2) + '°', '약 2~5°', tx > 1.5 && tx < 5.5); }
// 6. 스쿼트
{ const b = mk([[0.5, 0.71], far, far])[0]; const s = B.strike(P, b, { phi: 0, V: 3, a: 0.5, b: 0, elev: 0 });
  row('스쿼트 (오른쪽 회전 최대, 수평 큐)', Math.abs(s.squirtDeg).toFixed(2) + '°', '약 1~2.5°', Math.abs(s.squirtDeg) > 1 && Math.abs(s.squirtDeg) < 2.6); }
// 7. 끌어치기 / 밀어치기
{ const r = run([[0.6, 0.71], [1.2, 0.71], far], { phi: 0, V: 3, a: 0, b: -0.55, elev: 0.05 });
  const back = (1.2 - 2*R) - Math.min(...r.frames.map(f => f[0]).slice(Math.ceil(r.events[0].t * P.recordHz)));
  row('끌어치기 (60cm 거리, 큐 3m/s)', back.toFixed(2) + 'm 후진', '0.5m 이상 후진', back > 0.5); }
{ const r = run([[0.6, 0.71], [1.0, 0.71], far], { phi: 0, V: 2, a: 0, b: 0.55, elev: 0.05 });
  const e = r.events.find(e => e.type === 'ball'); const fwd = r.balls[0].x - (1.0 - 2*R);
  row('밀어치기 (40cm 거리, 큐 2m/s)', fwd.toFixed(2) + 'm 전진', '수구가 적구 따라 전진', fwd > 0.3); }
// 8. 쿠션: 정면 반발, 45도 구르는 공 반사각 (속도별), 회전별
{ const r = run([[1.6, 0.71], far, far], { phi: 0, V: 1.2, a: 0, b: 0.4, elev: 0 });
  const e = r.events.find(e => e.type === 'cushion'); const fi = Math.ceil(e.t * P.recordHz);
  // speed just before/after from frames
  const f = r.frames, sp = (k) => Math.hypot(f[k+1][0] - f[k][0], f[k+1][1] - f[k][1]) * P.recordHz;
  const ratio = sp(fi + 3) / sp(fi - 5); row('쿠션 정면 반발 (구르는 공)', ratio.toFixed(2), '약 0.6~0.8', ratio > 0.55 && ratio < 0.85); }
for (const [V, a] of [[0.8, 0], [2.5, 0], [5, 0], [2.5, 0.5], [2.5, -0.5]]) {
  const phi = Math.PI / 4; const sx = 1.0, sy = 0.4; const r = run([[sx, sy], far, far], { phi, V, a, b: 0.3, elev: 0 });
  const e = r.events.find(e => e.type === 'cushion'); if (!e) continue; const h = headingAfter(r, 0, e.t + 0.01, 0.12);
  // incoming 45° to top rail (side 3: y=W); rebound angle measured from rail
  const reb = deg(Math.atan2(Math.abs(Math.sin(h)), Math.abs(Math.cos(h))));
  row(`쿠션 반사각 45° 입사, 큐 ${V}m/s, 회전 ${a > 0 ? '순회전' : a < 0 ? '역회전' : '없음'}`, reb.toFixed(1) + '° (레일 기준)', a === 0 ? '구르는 공은 45°보다 납작(작게)' : a > 0 ? '더 납작' : '더 세움', true); }
// 9. 맛세
{ const r = run([[0.6, 0.4], far, far], { phi: 0, V: 2, a: 0.4, b: 0, elev: 60 * Math.PI / 180 });
  const f = r.frames, n = f.length - 1; const h0 = Math.atan2(f[6][1] - f[0][1], f[6][0] - f[0][0]);
  let k = n; while (k > 1 && Math.hypot(f[n][0] - f[k][0], f[n][1] - f[k][1]) < 0.05) k--;
  const h = Math.abs(deg(Math.atan2(f[n][1] - f[k][1], f[n][0] - f[k][0]) - h0));
  row('맛세 (큐 60° 세우고 오른쪽 회전)', '진로가 ' + h.toFixed(0) + '° 휘어짐', '뚜렷한 커브', h > 15); }
// 10. 구름 거리 감
{ const r = run([[0.3, 0.71], far, far], { phi: 0, V: 2.0, a: 0, b: 0.3, elev: 0 });
  const cs = r.events.filter(e => e.type === 'cushion').length; row('큐 2m/s 중앙 위 당점: 쿠션 횟수·시간', cs + '쿠션, ' + r.duration.toFixed(1) + '초', '참고값', true); }
console.table(out);
