// Independent quality gates for a GLB exported and reloaded by Three.js.
// A positive report verifies data presence, not anatomical deformation quality.
export function inspectRoundtripScene(root,animations=[]){
 const metrics={meshes:0,skinnedMeshes:0,bones:0,vertices:0,skinnedVertices:0,morphTargets:0,materials:0,textures:0,animations:animations.length,invalidWeights:0,unboundSkins:0};
 const materialSet=new Set(),textureSet=new Set();
 root?.traverse?.(node=>{
  if(node.isBone)metrics.bones++;
  if(!node.isMesh&&!node.isSkinnedMesh)return;
  metrics.meshes++;
  const position=node.geometry?.getAttribute?.('position');metrics.vertices+=position?.count||0;
  metrics.morphTargets+=Object.keys(node.morphTargetDictionary||{}).length;
  const mats=Array.isArray(node.material)?node.material:[node.material];
  for(const mat of mats)if(mat){materialSet.add(mat);for(const value of Object.values(mat))if(value?.isTexture)textureSet.add(value)}
  if(!node.isSkinnedMesh)return;
  metrics.skinnedMeshes++;metrics.skinnedVertices+=position?.count||0;
  if(!node.skeleton?.bones?.length)metrics.unboundSkins++;
  const indices=node.geometry?.getAttribute?.('skinIndex'),weights=node.geometry?.getAttribute?.('skinWeight');
  if(!position||!indices||!weights||indices.count!==position.count||weights.count!==position.count){metrics.invalidWeights++;return}
  for(let i=0;i<position.count;i+=Math.max(1,Math.ceil(position.count/1500))){
   let sum=0,valid=true;
   for(let n=0;n<Math.min(4,weights.itemSize||4);n++){
    const weight=weights.getComponent(i,n),index=indices.getComponent(i,n);
    sum+=weight;if(!Number.isFinite(weight)||weight<0||!Number.isInteger(index)||index<0||index>=node.skeleton?.bones?.length)valid=false;
   }
   if(!valid||Math.abs(sum-1)>.06){metrics.invalidWeights++;break}
  }
 });
 metrics.materials=materialSet.size;metrics.textures=textureSet.size;
 return metrics;
}
export function assessRoundtrip(before,after,{expectRig=true}={}){
 if(!after||!before)throw Error('Deux diagnostics sont nécessaires.');
 const failures=[],warnings=[];
 if(!after.meshes||!after.vertices)failures.push('Aucun maillage réimporté.');
 if(expectRig&&(!after.skinnedMeshes||!after.bones||after.unboundSkins))failures.push('Skin ou squelette perdu après export.');
 if(after.invalidWeights)failures.push('Poids ou indices de skinning invalides.');
 if(after.vertices!==before.vertices)failures.push('Nombre de sommets différent après réimportation.');
 if(after.morphTargets<before.morphTargets)failures.push('Morph targets perdus après réimportation.');
 if(after.animations<before.animations)failures.push('Clips d’animation perdus.');
 if(after.textures<before.textures)warnings.push('Textures manquantes ou non reconnues après réimportation.');
 if(after.materials<before.materials)warnings.push('Matériaux fusionnés ou perdus.');
 return {passed:failures.length===0,failures,warnings,before,after,
 disclaimer:'Test technique de conservation : ne garantit pas la fidélité visuelle ni les déformations en mouvement.'};
}
