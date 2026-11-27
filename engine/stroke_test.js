const B=require('./physics3d.js');const P=B.DEFAULTS;const deg=r=>r*180/Math.PI;
function shot(stroke,bv,thick){ // thick: fraction (1 full, 0.5 half); object 0.6m ahead
  const off=2*P.R*(1-thick); const balls=[B.makeBall('w',0.4,0.6,P),B.makeBall('o',1.0,0.6+off,P),B.makeBall('r',-5,-5,P)];balls[2].still=true;
  const r=B.simulate({},balls,{phi:0,V:3,a:0,b:bv,elev:0.09,stroke});const e=r.events.find(e=>e.type==='ball');
  const f=r.frames,k0=Math.ceil(e.t*240)+2;let k=k0;while(k<f.length-1&&Math.hypot(f[k][0]-f[k0][0],f[k][1]-f[k0][1])<0.25)k++;
  const hc=Math.atan2(f[k][1]-f[k0][1],f[k][0]-f[k0][0]);let j=k0;while(j<f.length-1&&Math.hypot(f[j][8]-f[k0][8],f[j][9]-f[k0][9])<0.25)j++;
  const ho=Math.atan2(f[j][9]-f[k0][9],f[j][8]-f[k0][8]);
  let d=0;for(let i=k0;i<f.length;i++)d+=Math.hypot(f[i][0]-f[i-1][0],f[i][1]-f[i-1][1]);
  const vx=(f[1][0]-f[0][0])*240;return {sep:Math.abs(deg(hc-ho)).toFixed(0),cueAfter:d.toFixed(2),v0:vx.toFixed(2),back:(f[k][0]-f[k0][0]<0)};}
console.log('큐 3m/s, 적구까지 0.6m');
for(const [nm,bv,th] of [['상단 1/2두께',0.45,0.5],['중단 1/2두께',0,0.5],['하단 1/2두께',-0.45,0.5],['하단 정면(끌기)',-0.5,1],['상단 정면(밀기)',0.45,1]]){
  console.log(nm.padEnd(10), ['push','normal','snap'].map(s=>{const r=shot(s,bv,th);return `${s}: 초속${r.v0} 분리각${r.sep}° 수구이동${r.cueAfter}m${r.back?'(뒤로)':''}`}).join(' | '));}
