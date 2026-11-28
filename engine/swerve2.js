const B=require('./physics3d.js');const P=B.DEFAULTS;
function path(extra,a,V,el,dist){const balls=[B.makeBall('w',0.4,0.6,P),B.makeBall('o',0.4+dist,0.6,P),B.makeBall('r',-5,-5,P)];balls[2].still=true;
 const r=B.simulate(extra,balls,{phi:0,V,a,b:0,elev:el*Math.PI/180});const f=r.frames,e=r.events.find(e=>e.type==='ball');const k=e?Math.round(e.t*240):f.length-1;
 const at=t=>{const i=Math.min(f.length-1,k+Math.round(t*240));return ((f[i][1]-0.6)*100).toFixed(1)};
 const mid=((f[Math.round(k/2)][1]-0.6)*100).toFixed(1);
 return `중간 ${mid} / 충돌 ${((f[k][1]-0.6)*100).toFixed(1)} / 충돌후0.3s ${at(0.3)} / 1s ${at(1)} / 2s ${at(2)} (cm, +왼 −오른)`;}
const sc=[[0.55,2,5,1.0],[0.55,3,5,1.0],[0.4,1.5,5,0.8]];
for(const [a,V,el,d] of sc){console.log(`\n== 우${a*100} 큐${V}m/s 기울기${el}° 거리${d}m 정면조준`);
 console.log(' 현재 엔진          ',path({},a,V,el,d));
 console.log(' 스쿼트 없음        ',path({cueEndMass:1e-5},a,V,el,d));
 console.log(' 스워브 없음        ',path({swerveK:0},a,V,el,d));
 console.log(' 공-공 마찰 없음    ',path({ballMuA:0,ballMuB:0},a,V,el,d));
 console.log(' 스트로크효과 없음  ',path({strokeFeel:0},a,V,el,d));}
