import test from "node:test";
import assert from "node:assert/strict";
import {RIG_TESTS,TEST_BONES,testAngles,diagnosticSummary} from "../rig-tester.mjs";
test("all six rig diagnostic modes exist",()=>{
  for(const key of ["idle","arms","walk","legs","head","torso","all"])assert.ok(RIG_TESTS[key]);
  assert.equal(new Set(TEST_BONES).size,19);
});
test("all poses provide finite angles in known bones",()=>{
  for(const [name,def] of Object.entries(RIG_TESTS)){
    for(const time of [0,def.duration/5,def.duration/2,def.duration]){
      const pose=testAngles(name,time,.8);
      assert.ok(Object.keys(pose).length>0,name);
      for(const [bone,rot] of Object.entries(pose)){
        assert.ok(TEST_BONES.includes(bone),bone);
        assert.equal(rot.length,3);
        assert.ok(rot.every(Number.isFinite));
        assert.ok(rot.every(n=>Math.abs(n)<2),"too large "+bone);
      }
    }
  }
});
test("amplitude zero means no movement",()=>{
  for(const name of Object.keys(RIG_TESTS)){
    const pose=testAngles(name,.46,0);
    for(const rot of Object.values(pose))assert.deepEqual(rot,[0,0,0]);
  }
});
test("periodic motions loop deterministically",()=>{
  for(const [name,{duration}] of Object.entries(RIG_TESTS)){
    assert.deepEqual(testAngles(name,.24,1),testAngles(name,.24+duration,1));
  }
});
test("rejects invalid input",()=>{
  assert.throws(()=>testAngles("unknown",0));
  assert.throws(()=>testAngles("arms",NaN));
  assert.throws(()=>testAngles("arms",0,Infinity));
});
test("diagnostics list the joints affected",()=>{
  assert.deepEqual(diagnosticSummary({"Spine":[0,0,0],"Head":[0,0,0]}),["Head","Spine"]);
});
