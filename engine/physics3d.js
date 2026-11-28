/* =====================================================================
   Carom 3-Cushion Physics Core (3D rigid balls, deterministic)
   Coordinate frame: x = long axis [0,L], y = short axis [0,W], z = up.
   References:
   - Cloth: sliding / rolling / spinning model (Leckie & Greenspan; pooltool)
   - Cue: impulse along cue axis at tip contact, cue elevation, squirt (Alciatore)
   - Ball-ball: impulse with speed-dependent friction -> cut/spin throw (Alciatore)
   - Cushion: impulse integration with cushion & table friction, energy restitution
     (Mathavan, Jackson & Parkin 2010)
   ===================================================================== */
const BilliardPhysics = (() => {
  const DEFAULTS = {
    // 한국 일반 당구장 국내식 중대: 내경 2448 x 1224 mm, 4구/3구 겸용 쿠션 높이 40mm, 3구 공 61.5mm
    R: 0.03075, m: 0.21, L: 2.448, W: 1.224, g: 9.81,
    muS: 0.20,            // cloth sliding friction
    muR: 0.0085,          // cloth rolling resistance
    spinDecel: 10.0,      // rad/s^2, vertical-axis spin decay on cloth
    eBall: 0.94,          // ball-ball restitution
    ballMuA: 9.951e-3, ballMuB: 0.108, ballMuC: 1.088, // ball-ball friction mu(v)=a+b*exp(-c v)
    cushionH: 0.040,      // cushion nose height from cloth (중대 겸용 40mm, 3구 전용 38mm)
    eCushion: 0.86,       // cushion restitution (energy based)
    muCushion: 0.16,      // ball-cushion friction
    muTableImpact: 0.20,  // ball-cloth friction during cushion impact
    eTable: 0.45,         // ball-slate bounce restitution (landing)
    cueMass: 0.52, cueTipE: 0.78, cueEndMass: 0.003, miscue: 0.62, // 큐 끝 질량: 캐롬 저반발(LD) 샤프트 수준 (현장 체감에 맞춰 3g)
    // 스트로크: 유효 큐 질량(그립·손목이 함께 미는 정도), 팁 반발, 현장 체감 회전 보정
    // 스트로크 (현장 지도서 공통 내용 반영):
    //  밀어치기(가속하며 통과): 큐가 공을 오래 밀어 '전진력' 추가 → 앞으로 잘 밀림, 하단은 덜 끌려옴, 진로 길고 힘참, 회전 영향은 상대적으로 작음
    //  끊어치기(임팩트 직후 정지): 전진력 억제(스턴 성향) → 분리각 커짐, 진로 짧고 약함, 하단은 강하게 끌려옴, 회전 변화 극적
    //  roll: 자연 구름 대비 추가 전진회전 비율, spin: 당점 회전 배율, mass/tipE: 유효 큐 질량·팁 반발
    strokes: { push: { mass: 0.66, tipE: 0.80, roll: 0.22, spin: 0.90 }, normal: { mass: 0.52, tipE: 0.78, roll: 0, spin: 1 }, snap: { mass: 0.44, tipE: 0.70, roll: -0.18, spin: 1.15 } },
    strokeFeel: 1.0,
    swerveK: 0.5,         // 스워브(들린 큐 + 좌우회전 → 휘어짐) 세기. 1 = 이론값, 현장 체감에 맞춰 낮춤
      // 0 = 순수 충격량 물리만, 1 = 지도서 기준 효과 전부
    dt: 1e-4, recordHz: 240, maxTime: 40
  };

  // ---------- small vector helpers (arrays [x,y,z]) ----------
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);

  function makeBall(id, x, y, P) {
    return { id, x, y, z: P.R, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
             q: [1, 0, 0, 0], air: false, still: true };
  }

  function ballMu(P, v) { return P.ballMuA + P.ballMuB * Math.exp(-P.ballMuC * v); }

  // ---------- cue strike ----------
  // shot: {phi (rad), V (cue speed m/s), a (side, +right, fraction of R), b (vertical, +top, fraction of R), elev (rad)}
  function strike(P, ball, shot) {
    const { R, m } = P, I = 0.4 * m * R * R;
    let a = shot.a || 0, b = shot.b || 0;
    const off = Math.hypot(a, b); let miscue = false;
    if (off > P.miscue) { miscue = true; a *= P.miscue / off; b *= P.miscue / off; }
    const ce = Math.cos(shot.elev || 0), se = Math.sin(shot.elev || 0);
    const d = [ce * Math.cos(shot.phi), ce * Math.sin(shot.phi), -se];
    const rgt = [Math.sin(shot.phi), -Math.cos(shot.phi), 0];
    const up = cross(rgt, d);
    const c = Math.sqrt(Math.max(0, 1 - a*a - b*b)) * R;
    const p = [0, 1, 2].map(k => a*R*rgt[k] + b*R*up[k] - c*d[k]);
    const pxd = cross(p, d);
    const invMeff = 1/m + dot(pxd, pxd) / I;
    const S = (P.strokes && P.strokes[shot.stroke || 'normal']) || { mass: P.cueMass, tipE: P.cueTipE, roll: 0, spin: 1 };
    const cueM = shot.stroke && shot.stroke !== 'normal' ? S.mass : P.cueMass, tipE = shot.stroke && shot.stroke !== 'normal' ? S.tipE : P.cueTipE;
    let J = (1 + tipE) * shot.V / (1/cueM + invMeff);
    if (miscue) J *= 0.35;
    const Jv = d.map(k => k * J);
    ball.vx += Jv[0]/m; ball.vy += Jv[1]/m; ball.vz += Jv[2]/m;
    const dw = cross(p, Jv);
    const fe = P.strokeFeel || 0, sk = 1 + ((S.spin || 1) - 1) * fe, rk = (S.roll || 0) * fe;
    // 좌우 당점이 만드는 회전축 기울기(스워브 성분: 진행방향 축의 수평 회전)를 swerveK 만큼만 남김
    const sideH = a * R * J * se / I * (1 - (P.swerveK ?? 1));
    dw[0] -= sideH * I * Math.cos(shot.phi); dw[1] -= sideH * I * Math.sin(shot.phi);
    ball.wx += sk * dw[0]/I; ball.wy += sk * dw[1]/I; ball.wz += sk * dw[2]/I;
    // 전진력(+)/스턴(-) 성분: 진행 방향 자연 구름 회전의 일정 비율을 더하거나 뺌
    ball.wx += rk * (-ball.vy / R); ball.wy += rk * (ball.vx / R);
    // squirt: cue ball deflects away from the side of english
    const aa = Math.max(-0.95, Math.min(0.95, a));
    const sq = Math.atan(2.5 * Math.abs(aa) * Math.sqrt(1 - aa*aa) / (1 + m / P.cueEndMass + 2.5 * (1 - aa*aa))) * Math.sign(aa);
    const cs = Math.cos(sq), sn = Math.sin(sq);
    const vx = ball.vx * cs - ball.vy * sn, vy = ball.vx * sn + ball.vy * cs;
    ball.vx = vx; ball.vy = vy;
    // downward component goes into the slate (no jump for normal elevations)
    if (ball.vz < 0) ball.vz = 0;  // 큐의 하향 성분은 슬레이트가 흡수 (점프샷은 추후)
    if (ball.vz > 0.05) ball.air = true;
    ball.still = false;
    return { miscue, squirtDeg: sq * 180 / Math.PI };
  }

  // ---------- cloth interaction for one step ----------
  function cloth(P, b, dt) {
    const { R, g } = P;
    if (b.air) { b.vz -= g * dt; return; }
    const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, u = Math.hypot(ux, uy);
    const kSlide = P.muS * g;
    if (u > 3.5 * kSlide * dt) {
      const ax = -kSlide * ux / u, ay = -kSlide * uy / u;
      b.vx += ax * dt; b.vy += ay * dt;
      b.wx += 2.5 / R * ay * dt; b.wy -= 2.5 / R * ax * dt;
    } else {
      b.vx -= (2/7) * ux; b.vy -= (2/7) * uy;
      const sp = Math.hypot(b.vx, b.vy), dec = P.muR * g * dt;
      if (sp <= dec) { b.vx = 0; b.vy = 0; } else { b.vx *= (sp - dec) / sp; b.vy *= (sp - dec) / sp; }
      b.wx = -b.vy / R; b.wy = b.vx / R;
    }
    const dw = P.spinDecel * dt;
    b.wz = Math.abs(b.wz) <= dw ? 0 : b.wz - Math.sign(b.wz) * dw;
  }

  // ---------- landing on slate ----------
  function land(P, b, ev, t, i) {
    const { R, m } = P, I = 0.4 * m * R * R;
    b.z = R;
    const vin = -b.vz;
    const Jn = m * (1 + P.eTable) * vin;
    b.vz = P.eTable * vin;
    // friction impulse at contact (Coulomb, limited to sticking)
    const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, u = Math.hypot(ux, uy);
    if (u > 1e-9) {
      const Jt = Math.min(P.muS * Jn, m * u / 3.5);
      const fx = -Jt * ux / u, fy = -Jt * uy / u;
      b.vx += fx / m; b.vy += fy / m;
      b.wx += R * fy / I; b.wy -= R * fx / I;
    }
    if (vin > 0.15) ev.push({ t, type: 'land', i, speed: vin });
    if (b.vz < 0.06) { b.vz = 0; b.air = false; }
  }

  // ---------- ball-ball ----------
  function ballBall(P, A, B, ev, t, i, j) {
    const { R, m } = P, I = 0.4 * m * R * R;
    let nx = B.x - A.x, ny = B.y - A.y, nz = B.z - A.z; const d = Math.hypot(nx, ny, nz);
    if (d >= 2 * R || d === 0) return;
    nx /= d; ny /= d; nz /= d; const n = [nx, ny, nz];
    const vrel = [A.vx - B.vx, A.vy - B.vy, A.vz - B.vz];
    const vn = dot(vrel, n);
    // separate overlap
    const ov = (2 * R - d) / 2;
    A.x -= ov * nx; A.y -= ov * ny; B.x += ov * nx; B.y += ov * ny;
    if (vn <= 0) return;
    const Jn = (1 + P.eBall) / 2 * m * vn;
    // contact-point relative velocity: (vA - vB) + R (wA + wB) x n
    const wsum = [A.wx + B.wx, A.wy + B.wy, A.wz + B.wz];
    const wxn = cross(wsum, n);
    const u = [vrel[0] + R * wxn[0], vrel[1] + R * wxn[1], vrel[2] + R * wxn[2]];
    const un = dot(u, n); const ut = [u[0] - un*nx, u[1] - un*ny, u[2] - un*nz]; const utl = len(ut);
    let Jt = 0, th = [0, 0, 0];
    if (utl > 1e-9) { Jt = Math.min(ballMu(P, utl) * Jn, m * utl / 7); th = ut.map(k => k / utl); }
    // impulse on A: -Jn n - Jt th ; on B: opposite
    const JA = [-Jn*nx - Jt*th[0], -Jn*ny - Jt*th[1], -Jn*nz - Jt*th[2]];
    A.vx += JA[0]/m; A.vy += JA[1]/m; A.vz += JA[2]/m;
    B.vx -= JA[0]/m; B.vy -= JA[1]/m; B.vz -= JA[2]/m;
    const fA = th.map(k => -Jt * k);
    const tA = cross([R*nx, R*ny, R*nz], fA);          // torque on A from friction at +R n
    const tB = cross([-R*nx, -R*ny, -R*nz], fA.map(k => -k));
    A.wx += tA[0]/I; A.wy += tA[1]/I; A.wz += tA[2]/I;
    B.wx += tB[0]/I; B.wy += tB[1]/I; B.wz += tB[2]/I;
    for (const X of [A, B]) { X.still = false; if (!X.air && X.vz > 0.05) X.air = true; else if (!X.air) X.vz = Math.max(0, X.vz); }
    ev.push({ t, type: 'ball', i, j, speed: vn, nx, ny });
  }

  // ---------- ball-cushion (Mathavan-style impulse integration) ----------
  function cushion(P, b, n, ev, t, i, side) {
    const { R, m } = P, I = 0.4 * m * R * R;
    const sinT = Math.max(-0.95, Math.min(0.95, (P.cushionH - b.z) / R));
    const cosT = Math.sqrt(1 - sinT * sinT);
    const rI = [R * cosT * n[0], R * cosT * n[1], R * sinT];          // centre -> cushion contact
    const rh = rI.map(k => k / R);                                      // unit, pointing into cushion
    const rC = [0, 0, -R];
    const s0 = dot([b.vx, b.vy, b.vz], rh) + dot(cross([b.wx, b.wy, b.wz], rI), rh);
    if (s0 <= 0) return;
    const onTable = !b.air;
    const N = 600, dP = m * s0 / N * 1.0;
    let Wc = 0, Wr = 0, phase = 0, it = 0;
    const e2 = P.eCushion * P.eCushion;
    while (it++ < 20000) {
      const w = [b.wx, b.wy, b.wz], v = [b.vx, b.vy, b.vz];
      const uI = cross(w, rI); uI[0] += v[0]; uI[1] += v[1]; uI[2] += v[2];
      const s = dot(uI, rh);
      if (phase === 0) { if (s <= 0) phase = 1; else Wc += s * dP; }
      if (phase === 1) { Wr += -s * dP; if (Wr >= e2 * Wc) break; }
      // normal impulse on ball (points out of cushion, into ball)
      const JN = rh.map(k => -k * dP);
      // cushion friction opposing slip at I
      const ut = [uI[0] - s * rh[0], uI[1] - s * rh[1], uI[2] - s * rh[2]]; const utl = len(ut);
      const fI = utl > 1e-9 ? ut.map(k => -P.muCushion * dP * k / utl) : [0, 0, 0];
      // slate reaction & friction
      let Pz = 0, fC = [0, 0, 0];
      const Jz = JN[2] + fI[2];
      if (onTable && b.z <= R + 1e-6 && b.vz <= 1e-6 && Jz < 0) {
        Pz = -Jz;
        const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, u = Math.hypot(ux, uy);
        if (u > 1e-9) fC = [-P.muTableImpact * Pz * ux / u, -P.muTableImpact * Pz * uy / u, 0];
      }
      const J = [JN[0] + fI[0] + fC[0], JN[1] + fI[1] + fC[1], JN[2] + fI[2] + fC[2] + Pz];
      b.vx += J[0]/m; b.vy += J[1]/m; b.vz += J[2]/m;
      const tI = cross(rI, fI), tC = cross(rC, fC);
      b.wx += (tI[0] + tC[0])/I; b.wy += (tI[1] + tC[1])/I; b.wz += (tI[2] + tC[2])/I;
    }
    if (b.vz > 0.05) b.air = true; else if (!b.air) b.vz = 0;
    b.still = false;
    ev.push({ t, type: 'cushion', i, side, speed: s0 });
  }

  // ---------- quaternion integration for visible ball rotation ----------
  function rotate(b, dt) {
    const [w, x, y, z] = b.q, ox = b.wx, oy = b.wy, oz = b.wz;
    const h = 0.5 * dt;
    const nw = w + h * (-ox*x - oy*y - oz*z), nx = x + h * (ox*w + oy*z - oz*y),
          ny = y + h * (-ox*z + oy*w + oz*x), nz = z + h * (ox*y - oy*x + oz*w);
    const l = Math.hypot(nw, nx, ny, nz); b.q = [nw/l, nx/l, ny/l, nz/l];
  }

  const SIDES = [ // [normal into cushion, axis, limit fn]
    { n: [-1, 0, 0], test: (P, b, lim) => b.x < lim, fix: (P, b, lim) => { b.x = lim; } },
    { n: [ 1, 0, 0], test: (P, b, lim) => b.x > P.L - lim, fix: (P, b, lim) => { b.x = P.L - lim; } },
    { n: [ 0,-1, 0], test: (P, b, lim) => b.y < lim, fix: (P, b, lim) => { b.y = lim; } },
    { n: [ 0, 1, 0], test: (P, b, lim) => b.y > P.W - lim, fix: (P, b, lim) => { b.y = P.W - lim; } },
  ];

  function moving(P, b) {
    return b.air || Math.hypot(b.vx, b.vy) > 1e-3 || Math.abs(b.wz) > 0.3 ||
      Math.hypot(b.vx - P.R * b.wy, b.vy + P.R * b.wx) > 2e-3;
  }

  // ---------- simulate whole shot ----------
  function simulate(params, balls, shot, cueIndex = 0) {
    const P = Object.assign({}, DEFAULTS, params || {});
    const B = balls.map(b => Object.assign({}, b, { q: b.q.slice() }));
    const ev = [];
    const info = strike(P, B[cueIndex], shot);
    const frames = [], recEvery = Math.max(1, Math.round(1 / (P.recordHz * P.dt)));
    const rec = t => { const f = new Float32Array(B.length * 8); B.forEach((b, k) => { f.set([b.x, b.y, b.z, b.q[0], b.q[1], b.q[2], b.q[3], b.air ? 1 : 0], k * 8); }); frames.push(f); };
    rec(0);
    let t = 0, step = 0;
    const maxSteps = Math.round(P.maxTime / P.dt);
    while (step < maxSteps) {
      step++; t = step * P.dt;
      let any = false;
      for (const b of B) {
        if (b.still) continue;
        cloth(P, b, P.dt);
        b.x += b.vx * P.dt; b.y += b.vy * P.dt; if (b.air) b.z += b.vz * P.dt;
        rotate(b, P.dt);
      }
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const A = B[i], C = B[j];
        if (A.still && C.still) continue;
        const dx = C.x - A.x, dy = C.y - A.y; if (dx*dx + dy*dy < 4 * P.R * P.R) ballBall(P, A, C, ev, t, i, j);
      }
      B.forEach((b, i) => {
        if (b.still) return;
        if (b.z - P.R > 0.06) return; // flying high above the cushion
        const sinT = Math.max(-0.95, Math.min(0.95, (P.cushionH - b.z) / P.R));
        const lim = P.R * Math.sqrt(1 - sinT * sinT);
        SIDES.forEach((S, k) => { if (S.test(P, b, lim)) { S.fix(P, b, lim); cushion(P, b, S.n, ev, t, i, k); } });
        if (b.air && b.z <= P.R && b.vz < 0) land(P, b, ev, t, i);
      });
      for (const b of B) { if (b.still) continue; if (moving(P, b)) any = true; else { b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0; b.still = true; } }
      if (step % recEvery === 0) rec(t);
      if (!any) break;
    }
    rec(t);
    return { frames, events: ev, balls: B, duration: t, strike: info, params: P };
  }

  return { DEFAULTS, makeBall, simulate, strike, _int: { cloth, ballBall, cushion, land } };
})();
if (typeof module !== 'undefined') module.exports = BilliardPhysics;
