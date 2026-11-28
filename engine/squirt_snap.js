const B=require('./physics3d.js');const P=B.DEFAULTS;
function m(extra,a,V,stroke,d){const balls=[B.makeBall('w',0.4,0.6,P),B.makeBall('o',0.4+d,0.6,P),B.makeBall('r',-5,-5,P)];balls[2].still=true;
 const r=B.simulate(extra,balls,{phi:0,V,a,b:0,elev:5*Math.PI/180,stroke});const f=r.frames,e=r.events.find(e=>e.type==='ball');if(!e)return '빗나감';
 const k=Math.round(e.t*240),i=Math.min(f.length-1,k+120);const lat=(f[k][1]-0.6)*100;const th=Math.max(0,100-Math.abs(lat)/(2*P.R*100)*100);
 const dx=f[i][0]-f[k][0],dy=f[i][1]-f[k][1];const ang=Math.atan2(dy,dx)*180/Math.PI;
 return `두께 ${th.toFixed(0)}% · 충돌후 수구 진행각 ${ang.toFixed(0)}°(+왼) · 0.5초 옆이동 ${(dy*100).toFixed(0)}cm · 스쿼트 ${r.strike.squirtDeg.toFixed(2)}°`;}
for(const d of [0.6,1.2]){console.log(`\n=== 우55 끊어치기 큐6m/s 거리${d}m 정면`);
 for(const [nm,ex] of [['3g(현재)',{cueEndMass:0.003}],['2g',{cueEndMass:0.002}],['1.5g',{cueEndMass:0.0015}],['1g',{cueEndMass:0.001}]]) console.log(' ',nm.padEnd(14),m(ex,0.55,6,'snap',d));
 console.log('  (참고) 보통 스트로크 5g  ',m({},0.55,6,'normal',d));}
