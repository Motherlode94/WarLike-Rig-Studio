import test from "node:test";
import assert from "node:assert/strict";
import {HUMAN_BONE_NAMES,makeHumanoidPlan,weightsAt,inspectInput} from "../rig-core.mjs";
const box={min:{x:-.48,y:0,z:-.15},max:{x:.48,y:1.8,z:.2}};
test("generates complete named core humanoid chain",()=>{
 const plan=makeHumanoidPlan(box);
 assert.equal(plan.bones.length,19);
 assert.deepEqual(plan.bones.map(b=>b.name),HUMAN_BONE_NAMES);
 assert.equal(plan.bones[0].parent,null);
 for(const b of plan.bones)if(b.parent)assert.ok(plan.bones.some(j=>j.name===b.parent));
});
test("rejects flattened or invalid coordinate systems",()=>{
 assert.throws(()=>makeHumanoidPlan({min:{x:0,y:0,z:0},max:{x:1,y:0,z:1}}));
 assert.throws(()=>makeHumanoidPlan({min:{x:0,y:0,z:0},max:{x:NaN,y:1,z:1}}));
});
test("head protection produces rigid skinning, preserving its geometry",()=>{
 const plan=makeHumanoidPlan(box);
 const w=weightsAt([0,1.7,0],plan);
 assert.equal(w.zone,"head-protected");
 assert.equal(w.weights[0],1);
 assert.equal(plan.bones[w.indices[0]].name,"Head");
});
test("body weighting is normalized and bounded",()=>{
 const plan=makeHumanoidPlan(box);
 for(const point of [[0,1.1,0],[.4,.8,0],[-.3,.9,0],[.15,.28,0],[-.15,.28,0]]){
   const w=weightsAt(point,plan);
   assert.equal(w.weights.length,4);
   assert.ok(w.indices.every(i=>Number.isInteger(i)&&i>=0&&i<plan.bones.length));
   assert.ok(w.weights.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
   assert.ok(Math.abs(w.weights.reduce((a,b)=>a+b,0)-1)<1e-9);
 }
});
test("refuses destructive autorig when a GLB already has skinning",()=>{
 const info=inspectInput({meshCount:3,skinCount:1,vertexCount:4000,triangleCount:2000,morphCount:3});
 assert.equal(info.canAutoRig,false);
 assert.equal(info.preservesOriginalTopology,true);
});
test("accepts a genuine unrigged mesh as experimental candidate",()=>{
 assert.equal(inspectInput({meshCount:1,skinCount:0,vertexCount:3000,triangleCount:1200,morphCount:0}).canAutoRig,true);
});

test("arm posture keeps elbows and wrists close to actual arms-down body",()=>{
 const down=makeHumanoidPlan(box,{armPose:"down"});
 const a=makeHumanoidPlan(box,{armPose:"a"});
 const t=makeHumanoidPlan(box,{armPose:"t"});
 const joint=(p,name)=>p.bones.find(b=>b.name===name).position;
 const [cx]=down.center;
 assert.ok(Math.abs(joint(down,"LeftHand")[0]-cx)<Math.abs(joint(a,"LeftHand")[0]-cx));
 assert.ok(Math.abs(joint(a,"LeftHand")[0]-cx)<Math.abs(joint(t,"LeftHand")[0]-cx));
 assert.ok(joint(down,"LeftHand")[1]<joint(down,"LeftShoulder")[1]);
 assert.ok(joint(t,"LeftHand")[1]>joint(down,"LeftHand")[1]);
 assert.ok(Math.abs(joint(down,"LeftHand")[0]+joint(down,"RightHand")[0]-2*cx)<1e-8);
});
test("rejects unknown arm pose values",()=>assert.throws(()=>makeHumanoidPlan(box,{armPose:"unknown"})));
