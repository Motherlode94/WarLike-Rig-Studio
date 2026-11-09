// Non-destructive inspection of humanoid skeletons imported from glTF / GLB.
// Supports common Mixamo, Blender and Meshy prefixes without renaming actual bones.
export const CANONICAL_BONES=Object.freeze([
 "Hips","Spine","Chest","Neck","Head",
 "LeftShoulder","LeftUpperArm","LeftLowerArm","LeftHand",
 "RightShoulder","RightUpperArm","RightLowerArm","RightHand",
 "LeftUpperLeg","LeftLowerLeg","LeftFoot",
 "RightUpperLeg","RightLowerLeg","RightFoot"
]);
const aliases=Object.freeze({
 hips:["hips","pelvis","hip","rootpelvis","bip001pelvis"],
 spine:["spine","spine0","spine01","spine1","abdomen","torso"],
 chest:["chest","upperchest","spine2","spine02","spine3","spine03","thorax"],
 neck:["neck","neck1","cervical"],head:["head","headtop"],
 leftshoulder:["leftshoulder","lshoulder","leftclavicle","claviclel","shoulderl"],
 rightshoulder:["rightshoulder","rshoulder","rightclavicle","clavicler","shoulderr"],
 leftupperarm:["leftupperarm","leftarm","lupperarm","armleft","upperarml","arml"],
 rightupperarm:["rightupperarm","rightarm","rupperarm","armright","upperarmr","armr"],
 leftlowerarm:["leftlowerarm","leftforearm","leftelbow","lforearm","forearml","lowerarml"],
 rightlowerarm:["rightlowerarm","rightforearm","rightelbow","rforearm","forearmr","lowerarmr"],
 lefthand:["lefthand","lhand","handl"],righthand:["righthand","rhand","handr"],
 leftupperleg:["leftupperleg","leftupleg","leftthigh","lthigh","thighl","uplegl"],
 rightupperleg:["rightupperleg","rightupleg","rightthigh","rthigh","thighr","uplegr"],
 leftlowerleg:["leftlowerleg","leftleg","leftcalf","leftknee","lcalf","calfl","lowerlegl"],
 rightlowerleg:["rightlowerleg","rightleg","rightcalf","rightknee","rcalf","calfr","lowerlegr"],
 leftfoot:["leftfoot","leftankle","lfoot","footl"],rightfoot:["rightfoot","rightankle","rfoot","footr"]
});
export function normalizeImportedBoneName(name){
 let value=String(name||"").toLowerCase().trim();
 // Prefixes separated by ':' or '|' in Blender/Mixamo exports.
 value=value.split(/[:|]/).at(-1);
 value=value.replace(/^(?:mixamorig|armature|skeleton|rig|bip001)(?:[_\\s.:-]+|$)/,"");
 return value.replace(/[^a-z0-9]/g,"");
}
export function mapImportedBones(bones){
 const used=new Set(),map=new Map(),all=Array.from(bones||[]);
 for(const canonical of CANONICAL_BONES){
   const keys=aliases[canonical.toLowerCase()]||[canonical.toLowerCase()];
   const matched=all.find(b=>b&&b.isBone!==false&&!used.has(b)&&
     keys.includes(normalizeImportedBoneName(b.name)));
   if(matched){map.set(canonical,matched);used.add(matched);}
 }
 return map;
}
export function inspectExistingSkeletons(meshes){
 const candidates=Array.from(meshes||[]).filter(mesh=>mesh?.isSkinnedMesh&&
   mesh.skeleton?.bones?.length);
 const skeletons=[...new Set(candidates.map(mesh=>mesh.skeleton))];
 const primary=skeletons[0]||null;
 const rigMap=mapImportedBones(primary?.bones||[]);
 return {
  valid:!!primary,
  skinnedMeshCount:candidates.length,
  skeletonCount:skeletons.length,
  boneCount:primary?.bones?.length||0,
  mappedCount:rigMap.size,
  mappedBones:rigMap,
  skeleton:primary,
  warnings:[
    ...(skeletons.length>1?["Plusieurs squelettes détectés : le test procédural cible le premier."]:[]),
    ...(primary&&rigMap.size<5?["Noms d'os non standard : les tests procéduraux peuvent ne pas bouger le personnage."]:[])
  ]
 };
}
