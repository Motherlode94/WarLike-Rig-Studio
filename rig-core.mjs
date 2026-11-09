// WarLike Rig Studio — pure rig geometry helpers (no destructive remesh).
export const HUMAN_BONE_NAMES = Object.freeze([
  "Hips","Spine","Chest","Neck","Head",
  "LeftShoulder","LeftUpperArm","LeftLowerArm","LeftHand",
  "RightShoulder","RightUpperArm","RightLowerArm","RightHand",
  "LeftUpperLeg","LeftLowerLeg","LeftFoot",
  "RightUpperLeg","RightLowerLeg","RightFoot"
]);

export function makeHumanoidPlan(box,{armPose="down"}={}) {
  const min=box?.min, max=box?.max;
  if(!min||!max||![min.x,min.y,min.z,max.x,max.y,max.z].every(Number.isFinite))
    throw Error("Bornes 3D invalides.");
  const h=max.y-min.y;
  if(h<=0.01)throw Error("Le personnage doit être vertical (axe Y positif).");
  const cx=(min.x+max.x)/2,cz=(min.z+max.z)/2;
  const p=(x,y,z=0)=>[cx+x*h,min.y+y*h,cz+z*h];
  if(!["down","a","t"].includes(armPose))throw Error("Pose de bras inconnue.");
  // Arm landmarks must match the input geometry, not a generic horizontal T-pose.
  const poses={down:{elbowX:.185,elbowY:.635,handX:.195,handY:.51,upperX:.162,upperY:.744},a:{elbowX:.255,elbowY:.685,handX:.31,handY:.575,upperX:.188,upperY:.753},t:{elbowX:.315,elbowY:.785,handX:.43,handY:.785,upperX:.19,upperY:.783}};
  const arm=poses[armPose];
  const bones=[
    ["Hips",null,p(0,.52)],["Spine","Hips",p(0,.64)],["Chest","Spine",p(0,.76)],
    ["Neck","Chest",p(0,.855)],["Head","Neck",p(0,.94)],
    ["LeftShoulder","Chest",p(.125,.775)],["LeftUpperArm","LeftShoulder",p(arm.upperX,arm.upperY)],
    ["LeftLowerArm","LeftUpperArm",p(arm.elbowX,arm.elbowY)],["LeftHand","LeftLowerArm",p(arm.handX,arm.handY)],
    ["RightShoulder","Chest",p(-.125,.775)],["RightUpperArm","RightShoulder",p(-arm.upperX,arm.upperY)],
    ["RightLowerArm","RightUpperArm",p(-arm.elbowX,arm.elbowY)],["RightHand","RightLowerArm",p(-arm.handX,arm.handY)],
    ["LeftUpperLeg","Hips",p(.087,.48)],["LeftLowerLeg","LeftUpperLeg",p(.09,.285)],
    ["LeftFoot","LeftLowerLeg",p(.09,.055,.035)],
    ["RightUpperLeg","Hips",p(-.087,.48)],["RightLowerLeg","RightUpperLeg",p(-.09,.285)],
    ["RightFoot","RightLowerLeg",p(-.09,.055,.035)]
  ];
  return {bones:bones.map(([name,parent,position])=>({name,parent,position})),
    min:[min.x,min.y,min.z],max:[max.x,max.y,max.z],height:h,center:[cx,cz],armPose};
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distToSegment=(p,a,b)=>{
  const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
  const len=d[0]**2+d[1]**2+d[2]**2, t=len?clamp((v[0]*d[0]+v[1]*d[1]+v[2]*d[2])/len,0,1):0;
  return Math.hypot(...p.map((x,i)=>x-a[i]-d[i]*t));
};
// The source mesh positions remain unchanged. This experimental region-aware
// weighting is an initial editable skin, NOT a production-quality autorigger.\n// A broader influence kernel reduces hard elbow/knee transitions; source topology is unchanged.
// Assign vertices only to anatomically neighbouring bones. Earlier versions
// assigned every vertex below the wrist height to LEGS; this stretched sleeves
// into protruding tubes when a character moved.
export function weightsAt(point,plan,{lockHead=true}={}) {
  if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))
    throw Error("Sommet invalide.");
  const [x,y]=point,[cx]=plan.center,h=plan.height;
  const yn=(y-plan.min[1])/h, xn=(x-cx)/h,absx=Math.abs(xn);
  const idx=Object.fromEntries(plan.bones.map((bone,i)=>[bone.name,i]));
  const pack=(values,zone)=>{
    const pairs=values.sort((a,b)=>b.score-a.score).slice(0,4);
    const sum=pairs.reduce((total,item)=>total+item.score,0);
    const indices=pairs.map(item=>item.index),weights=pairs.map(item=>item.score/sum);
    while(indices.length<4){indices.push(0);weights.push(0);}
    return {indices,weights,zone};
  };
  if(lockHead&&yn>=.865)
    return {indices:[idx.Head,0,0,0],weights:[1,0,0,0],zone:"head-protected"};
  const side=xn>=0?"Left":"Right";
  // Protect lower arms and hands from accidentally following legs or hips.
  // Arm region depends on the actual rest pose selected by the user.
  const ranges={
    down:{min:.32,max:.83,outer:.145},
    a:{min:.44,max:.84,outer:.155},
    t:{min:.67,max:.86,outer:.16}
  };
  const range=ranges[plan.armPose||"down"];
  const isArm=yn>=range.min&&yn<=range.max&&absx>=range.outer;
  let names,zone;
  if(isArm){
    names=[side+"Shoulder",side+"UpperArm",side+"LowerArm",side+"Hand"];
    zone="arm-"+side.toLowerCase();
  }else if(yn<.51){
    names=["Hips",side+"UpperLeg",side+"LowerLeg",side+"Foot"];
    zone="leg-"+side.toLowerCase();
  }else if(yn>.81){
    names=["Chest","Neck","Head"];zone="neck";
  }else{
    names=["Hips","Spine","Chest","Neck"];zone="torso";
  }
  // Local Gaussian weighting on actual bone segments. A small spatial
  // kernel avoids heavy influences from distant joints, while neighbouring
  // joints still blend across elbow, knee and shoulder folds.
  const sigma=.035*h;
  const values=names.map(name=>{
    const bone=plan.bones[idx[name]];
    const parent=plan.bones.find(other=>other.name===bone.parent)||bone;
    const distance=distToSegment(point,parent.position,bone.position);
    return {index:idx[name],score:Math.max(1e-12,Math.exp(-.5*(distance/sigma)**2))};
  });
  return pack(values,zone);
}
export function inspectInput({meshCount,skinCount,vertexCount,triangleCount,morphCount}) {
  return {
    meshCount,skinCount,vertexCount,triangleCount,morphCount,
    alreadyRigged:skinCount>0,
    canAutoRig:meshCount>0&&skinCount===0&&vertexCount>0,
    preservesOriginalTopology:true,
    warning:"Auto-rig expérimental : vérifier manuellement déformations et articulations ; le visage d'origine ne peut pas être reconstruit."
  };
}
