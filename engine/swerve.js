const B=require('./physics3d.js');const P=B.DEFAULTS;
function run(a,V,el,dist,extra={}){const balls=[B.makeBall('w',0.4,0.6,P),B.makeBall('o',0.4+dist,0.6,P),B.makeBall('r',-5,-5,P)];balls[2].still=true;
 const r=B.simulate(extra,balls,{phi:0,V,a,b:0,elev:el*Math.PI/180});const e=r.events.find(e=>e.type==='ball');const f=r.frames;
 if(!e) return {miss:true,lat:((f[f.length-1][1]-0.6)*100).toFixed(1)};
 const k=Math.round(e.t*240);const latAtHit=(f[k][1]-0.6)*100; // 수구가 옆으로 벗어난 cm (+왼쪽)
 // 충돌 후 0.5초 동안 수구 옆이동
 const k2=Math.min(f.length-1,k+120);const after=(f[k2][1]-f[k][1])*100,fwd=(f[k2][0]-f[k][0])*100;
 return {thick:Math.max(0,100-Math.abs(latAtHit)/(2*P.R*100)*100).toFixed(0),latAtHit:latAtHit.toFixed(1),after:after.toFixed(1),fwd:fwd.toFixed(1)};}
console.log('당점 3시(우), 정면 조준, 적구까지 거리별 | 충돌시 실제두께% / 옆으로 벗어남cm(+왼,-오른) / 충돌후0.5초 수구 옆이동cm');
for(const a of [0.4,0.55]) for(const el of [3,5]) for(const V of [2,4]) { let s=`우${Math.round(a*100)} 기울기${el}° 큐${V}m/s: `;
  for(const d of [0.5,1.0,1.5]){const r=run(a,V,el,d);s+=r.miss?` ${d}m 빗나감 `:` ${d}m[${r.thick}% ${r.latAtHit} / 후${r.after}] `;} console.log(s);}
