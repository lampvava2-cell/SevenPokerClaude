const B=require('./physics3d.js');const P=B.DEFAULTS;const deg=r=>r*180/Math.PI;
for(const mu of [0.16,0.22,0.3]){let s=[];for(const V of [1.2,3]) for(const a of [-0.5,-0.25,0,0.25,0.5]){
 const b=[B.makeBall('w',1.0,0.4,P),B.makeBall('o',-5,-5,P),B.makeBall('r',-6,-6,P)];b[1].still=b[2].still=true;
 const r=B.simulate({muCushion:mu},b,{phi:Math.PI/4,V,a,b:0.3,elev:0});const e=r.events.find(e=>e.type==='cushion');
 const f=r.frames;const k=Math.ceil(e.t*240)+3;let j=k;while(Math.hypot(f[j][0]-f[k][0],f[j][1]-f[k][1])<0.25&&j<f.length-1)j++;
 s.push(`V${V} a${a}:${deg(Math.atan2(Math.abs(f[j][1]-f[k][1]),Math.abs(f[j][0]-f[k][0]))).toFixed(0)}°`);}
 console.log('muCushion',mu,s.join(' '));}
