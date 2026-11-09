import test from "node:test";
import assert from "node:assert/strict";
import {CANONICAL_BONES,normalizeImportedBoneName,mapImportedBones,inspectExistingSkeletons} from "../existing-rig.mjs";
const bone=name=>({name,isBone:true});
test("normalizes names from Blender, Mixamo and Meshy",()=>{
 assert.equal(normalizeImportedBoneName("mixamorig:LeftArm"),"leftarm");
 assert.equal(normalizeImportedBoneName("Armature|mixamorig:RightForeArm"),"rightforearm");
 assert.equal(normalizeImportedBoneName("Armature.Head"),"head");
});
test("maps a common Mixamo humanoid skeleton without renaming bones",()=>{
 const bones=["mixamorig:Hips","mixamorig:Spine","mixamorig:Spine2","mixamorig:Neck",
 "mixamorig:Head","mixamorig:LeftArm","mixamorig:RightArm","mixamorig:LeftForeArm",
 "mixamorig:RightForeArm","mixamorig:LeftHand","mixamorig:RightHand",
 "mixamorig:LeftUpLeg","mixamorig:RightUpLeg","mixamorig:LeftLeg",
 "mixamorig:RightLeg","mixamorig:LeftFoot","mixamorig:RightFoot"].map(bone);
 const map=mapImportedBones(bones);
 assert.equal(map.get("LeftUpperArm"),bones[5]);
 assert.equal(map.get("RightLowerArm"),bones[8]);
 assert.equal(map.get("Hips"),bones[0]);
 assert.ok(map.size>=15);
 assert.equal(bones[5].name,"mixamorig:LeftArm");
});
test("existing skin detection distinguishes bare skeletons from skinned geometry",()=>{
 const skeleton={bones:[bone("Hips"),bone("Spine"),bone("Head")]};
 const rig=inspectExistingSkeletons([{isSkinnedMesh:true,skeleton}]);
 assert.equal(rig.valid,true);assert.equal(rig.skinnedMeshCount,1);
 assert.equal(rig.mappedCount,3);
 assert.equal(inspectExistingSkeletons([{isMesh:true}]).valid,false);
});
test("multi-skeleton model triggers a compatibility warning",()=>{
 const a={bones:[bone("Hips")]},b={bones:[bone("Hips")]};
 const info=inspectExistingSkeletons([{isSkinnedMesh:true,skeleton:a},{isSkinnedMesh:true,skeleton:b}]);
 assert.equal(info.skeletonCount,2);assert.ok(info.warnings.some(x=>x.includes("Plusieurs")));
});
test("canonical list is complete and unique",()=>{
 assert.equal(CANONICAL_BONES.length,19);
 assert.equal(new Set(CANONICAL_BONES).size,19);
});
