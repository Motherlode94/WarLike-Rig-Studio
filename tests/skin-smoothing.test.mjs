import test from "node:test";
import assert from "node:assert/strict";
import {makeHumanoidPlan,weightsAt} from "../rig-core.mjs";
import {smoothSkinWeights} from "../skin-smoothing.mjs";
class Attribute{
 constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize;}
 getComponent(i,j){return this.array[i*this.itemSize+j];}
 getX(i){return this.getComponent(i,0);}
 getY(i){return this.getComponent(i,1);}
 getZ(i){return this.getComponent(i,2);}
}
function fixture(){
 const plan=makeHumanoidPlan({min:{x:-.45,y:0,z:-.15},max:{x:.45,y:1.8,z:.15}});
 const points=[[0,1.7,0],[.02,1.7,0],[0,1.68,.02],[.36,1.2,0],[.37,1.17,0],[.35,1.15,.02]];
 const attrs=new Map();
 const geo={
   index:new Attribute(new Uint16Array([0,1,2,3,4,5]),1),
   getAttribute(name){return attrs.get(name);},
   setAttribute(name,value){attrs.set(name,value);}
 };
 geo.setAttribute("position",new Attribute(new Float32Array(points.flat()),3));
 const indices=new Uint16Array(points.length*4),weights=new Float32Array(points.length*4);
 for(let i=0;i<points.length;i++){
   const w=weightsAt(points[i],plan);
   for(let j=0;j<4;j++){indices[i*4+j]=w.indices[j];weights[i*4+j]=w.weights[j];}
 }
 geo.setAttribute("skinIndex",new Attribute(indices,4));
 geo.setAttribute("skinWeight",new Attribute(weights,4));
 return {geo,plan,points};
}
test("indexed skin smoothing preserves original geometry and face protection",()=>{
 const {geo,plan}=fixture();
 const positions=geo.getAttribute("position").array.slice();
 const head=geo.getAttribute("skinWeight").array.slice(0,12);
 const out=smoothSkinWeights(geo,plan,{iterations:2});
 assert.equal(out.applied,true);
 assert.deepEqual([...geo.getAttribute("position").array],[...positions]);
 assert.deepEqual([...geo.getAttribute("skinWeight").array.slice(0,12)],[...head]);
 const weights=geo.getAttribute("skinWeight");
 for(let v=0;v<weights.count;v++){
   let sum=0;for(let j=0;j<4;j++)sum+=weights.getComponent(v,j);
   assert.ok(Math.abs(sum-1)<1e-5);
 }
});
test("smoothing does not spread leg weights into arm vertices or head weights into sleeves",()=>{
 const {geo,plan}=fixture();
 smoothSkinWeights(geo,plan,{iterations:3});
 const ids=geo.getAttribute("skinIndex"),w=geo.getAttribute("skinWeight"),names=plan.bones.map(b=>b.name);
 for(let i=3;i<6;i++)for(let j=0;j<4;j++){
   if(w.getComponent(i,j)>1e-5)assert.match(names[ids.getComponent(i,j)],/Arm|Shoulder|Hand/);
 }
});
test("non-indexed and oversized meshes are skipped safely",()=>{
 const {geo,plan}=fixture();geo.index=null;
 assert.equal(smoothSkinWeights(geo,plan).applied,false);
 geo.index=new Attribute(new Uint16Array([0,1,2]),1);
 assert.equal(smoothSkinWeights(geo,plan,{maxVertices:2}).applied,false);
});
