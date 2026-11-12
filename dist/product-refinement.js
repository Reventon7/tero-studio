import * as THREE from 'three';

// Visual fit to Goodent-tero-far-089, 098, 099, 100, 101 and 103.
// Keep the supplied mount locations; reshape both eyewire and lens together.
export function refineProduct(product) {
 // One continuous Bezier contour avoids local dips and high-frequency waves.
 const outline=new THREE.Shape();
 outline.moveTo(-.80,.28);
 outline.bezierCurveTo(-.77,.39,-.73,.455,-.61,.47);
 outline.bezierCurveTo(-.31,.505,.18,.495,.48,.455);
 outline.bezierCurveTo(.69,.43,.82,.37,.85,.22);
 outline.bezierCurveTo(.83,.02,.77,-.22,.66,-.38);
 outline.bezierCurveTo(.57,-.53,.30,-.55,.03,-.55);
 outline.bezierCurveTo(-.18,-.54,-.37,-.49,-.48,-.40);
 outline.bezierCurveTo(-.64,-.25,-.75,.04,-.80,.28);
 const path=outline.getSpacedPoints(320).slice(0,-1);
 const section=[[-.018,-.018],[.018,-.018],[.023,-.012],[.023,.012],[.018,.018],[-.018,.018],[-.023,.012],[-.023,-.012]];
 const vertices=[],indices=[];
 path.forEach((p,j)=>{
  const a=path[(j+path.length-1)%path.length],b=path[(j+1)%path.length];
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  const brow=1+.65*THREE.MathUtils.smoothstep(p.y,.22,.45);
  section.forEach(([w,z])=>vertices.push(p.x+dy/length*w*brow,p.y-dx/length*w*brow,z));
  for(let k=0;k<8;k++){const a=j*8+k,b=j*8+(k+1)%8,c=((j+1)%path.length)*8+k,d=((j+1)%path.length)*8+(k+1)%8;indices.push(a,c,b,b,c,d);}
 });
 const rim=new THREE.BufferGeometry();rim.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));rim.setIndex(indices);rim.computeVertexNormals();
 const lens=new THREE.ShapeGeometry(outline,96);
 product.traverse(object=>{
  if(!object.isMesh)return;
  if(object.name.startsWith('heroRim'))object.geometry=rim;
  if(object.name.startsWith('heroLens'))object.geometry=lens;
  object.material=object.material.clone();
  const material=object.material;
  if(material.name==='Satin aluminium'){
   material.roughness=.46;material.metalness=.78;
  }
  if(/^(heroRim|heroTemple|frameHinge|frameBridge)/.test(object.name)){
   material.color.set('#17191c');material.roughness=.34;material.metalness=.28;
  }
  if(object.name.startsWith('heroLens')){
   material.opacity=.065;material.roughness=.09;material.depthWrite=false;
  }
  if(object.name.startsWith('heroHousing')&&!object.name.startsWith('heroHousingPrint')){
   material.color.set('#181b1f');material.roughness=.48;material.metalness=.12;
  }
 });
}

// All phases finish inside the sticky hero. The final 14% holds the amber result.
export function heroPose(progress) {
 const p=THREE.MathUtils.clamp(progress,0,1);
 const separate=THREE.MathUtils.smoothstep(p,.20,.38)*(1-THREE.MathUtils.smoothstep(p,.46,.64));
 const lamp=THREE.MathUtils.smoothstep(p,.52,.70);
 const filter=THREE.MathUtils.smoothstep(p,.74,.86);
 return {separate,lamp,filter,turn:THREE.MathUtils.smoothstep(p,0,.70)};
}
