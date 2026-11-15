import test from 'node:test';import assert from 'node:assert/strict';import {inspectRoundtripScene,assessRoundtrip} from '../rig-roundtrip.mjs';
function character({weights=true,morphs=2}={}){
 const bones=[{isBone:true,name:'Hips'},{isBone:true,name:'Head'}];
 const attrs={position:{count:3}};
 if(weights){attrs.skinIndex={count:3,itemSize:4,getComponent:(_,i)=>i===0?0:1};attrs.skinWeight={count:3,itemSize:4,getComponent:(_,i)=>i===0?1:0}}
 const mat={map:{isTexture:true,uuid:'t'}};
 const mesh={isMesh:true,isSkinnedMesh:true,geometry:{getAttribute:key=>attrs[key]},skeleton:{bones},material:mat,morphTargetDictionary:Object.fromEntries(Array.from({length:morphs},(_,i)=>['face'+i,i]))};
 return {traverse(fn){for(const x of [...bones,mesh])fn(x)}};
}
test('correct GLB roundtrip retains skinning and animations',()=>{
 const before=inspectRoundtripScene(character(),[{name:'Dance'}]);
 const after=inspectRoundtripScene(character(),[{name:'Dance'}]);
 assert.equal(before.invalidWeights,0);assert.equal(before.skinnedMeshes,1);
 const result=assessRoundtrip(before,after);
 assert.equal(result.passed,true);assert.deepEqual(result.failures,[]);
});
test('roundtrip catches lost rigging, vertices, visemes and clips',()=>{
 const before=inspectRoundtripScene(character(),[{name:'Dance'}]);
 const after={...before,skinnedMeshes:0,bones:0,vertices:0,morphTargets:0,animations:0};
 const report=assessRoundtrip(before,after);
 assert.equal(report.passed,false);assert.ok(report.failures.length>=4);
});
test('roundtrip rejects invalid skin weights and warns about textures',()=>{
 const a=inspectRoundtripScene(character());
 const b={...a,invalidWeights:1,textures:0};
 const result=assessRoundtrip(a,b);
 assert.equal(result.passed,false);assert.ok(result.failures.some(x=>x.includes('Poids')));assert.ok(result.warnings.some(x=>x.includes('Textures')));
});
test('UI verifies single and batch GLB exports before allowing download',async()=>{
 const {readFileSync}=await import('node:fs');
 const js=readFileSync(new URL('../studio.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('id="roundtripResult"'));
 assert.ok((js.match(/verifyExportedRig\(buffer\)/g)||[]).length>=3);
 assert.match(js,/loader\.parseAsync\(buffer,''\)/);
});
