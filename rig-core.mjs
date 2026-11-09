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
export function weightsAt(point,plan,{lockHead=true}={}) {
  const [x,y,z]=point,[cx,cz]=plan.center,h=plan.height;
  const yn=(y-plan.min[1])/h,xn=(x-cx)/h;
  const idx=Object.fromEntries(plan.bones.map((b,i)=>[b.name,i]));
  if(lockHead&&yn>=.865)return {indices:[idx.Head,0,0,0],weights:[1,0,0,0],zone:"head-protected"};
  const side=xn>=0?"Left":"Right";
  let names;
  if(yn<.51)names=[side+"UpperLeg",side+"LowerLeg",side+"Foot","Hips"];
  else if(Math.abs(xn)>.155&&yn>.50&&yn<.83)
    names=[side+"UpperArm",side+"LowerArm",side+"Hand",side+"Shoulder"];
  else if(yn>.79) names=["Neck","Head","Chest","Spine"];
  else names=["Spine","Chest","Hips","Neck"];
  const pairs=names.map(name=>{
    const b=plan.bones[idx[name]],parent=plan.bones.find(v=>v.name===b.parent)||b;
    const distance=distToSegment(point,parent.position,b.position);
    return {index:idx[name],score:1/Math.max(.055*h,distance)**1.6};
  }).sort((a,b)=>b.score-a.score).slice(0,4);
  const sum=pairs.reduce((s,a)=>s+a.score,0);
  const weights=pairs.map(a=>a.score/sum),indices=pairs.map(a=>a.index);
  while(weights.length<4){weights.push(0);indices.push(0);}
  return {indices,weights,zone:names[0]};
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
