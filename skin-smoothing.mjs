import {weightsAt} from "./rig-core.mjs";
// WarLike skin-weight smoother: blend neighboring vertex weights only on the
// same indexed mesh, without changing vertex positions or triangle topology.
// Head-protected vertices remain rigid; original GLB is never mutated.
export function smoothSkinWeights(geometry,plan,{iterations=2,lockHead=true,maxVertices=160000}={}){
 const positions=geometry.getAttribute("position"),index=geometry.index;
 let skinIndex=geometry.getAttribute("skinIndex"),skinWeight=geometry.getAttribute("skinWeight");
 if(!index||!positions||!skinIndex||!skinWeight||positions.count>maxVertices||iterations<1)
   return {applied:false,reason:!index?"Maillage non indexé":positions?.count>maxVertices?"Maillage volumineux":"Données de skinning absentes"};
 const n=positions.count,adj=Array.from({length:n},()=>new Set());
 for(let t=0;t+2<index.count;t+=3){
   const a=index.getX(t),b=index.getX(t+1),c=index.getX(t+2);
   if(a===b||a===c||b===c)continue;
   adj[a].add(b);adj[a].add(c);adj[b].add(a);adj[b].add(c);adj[c].add(a);adj[c].add(b);
 }
 const zones=new Array(n),protectedVertex=new Uint8Array(n);
 for(let i=0;i<n;i++){
   const w=weightsAt([positions.getX(i),positions.getY(i),positions.getZ(i)],plan,{lockHead});
   zones[i]=w.zone;protectedVertex[i]=w.zone==="head-protected"?1:0;
 }
 // No averaging across disconnected garment pieces, opposite sides or
 // different anatomical areas: prevents sleeves following thighs/hips.
 for(let pass=0;pass<Math.min(4,Math.floor(iterations));pass++){
   const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
   for(let i=0;i<n;i++){
     const own=new Map();
     const add=(v,mult)=>{
       for(let j=0;j<4;j++){
         const value=skinWeight.getComponent(v,j)*mult;
         if(value>1e-8){const bone=skinIndex.getComponent(v,j);own.set(bone,(own.get(bone)||0)+value);}
       }
     };
     add(i,2);
     if(!protectedVertex[i]){
       for(const neighbor of adj[i])if(!protectedVertex[neighbor]&&zones[i]===zones[neighbor])add(neighbor,1);
     }
     const sorted=[...own].sort((a,b)=>b[1]-a[1]).slice(0,4);
     let sum=sorted.reduce((a,b)=>a+b[1],0);
     if(sum<=0){sorted.splice(0,sorted.length,[skinIndex.getX(i),1]);sum=1;}
     for(let j=0;j<4;j++){
       indices[i*4+j]=sorted[j]?.[0]||0;
       weights[i*4+j]=(sorted[j]?.[1]||0)/sum;
     }
   }
   skinIndex=new skinIndex.constructor(indices,4);
   skinWeight=new skinWeight.constructor(weights,4);
   geometry.setAttribute("skinIndex",skinIndex);
   geometry.setAttribute("skinWeight",skinWeight);
 }
 return {applied:true,vertices:n,iterations:Math.min(4,Math.floor(iterations))};
}
