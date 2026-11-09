// WarLike Rig Studio - procedural deformation tests, no geometry changes.
// Angles are radians in each bone's local axes; this is a diagnostic tester,
// not imported mocap or a final animation system.
export const RIG_TESTS=Object.freeze({
  idle:{label:"Respiration",duration:3,loop:true},
  arms:{label:"Bras et coudes",duration:4,loop:true},
  walk:{label:"Marche sur place",duration:2.4,loop:true},
  legs:{label:"Genoux et jambes",duration:4,loop:true},
  head:{label:"Cou et tête",duration:4,loop:true},
  torso:{label:"Torse et épaules",duration:4,loop:true},
  all:{label:"Contrôle complet",duration:6,loop:true}
});
export const TEST_BONES=Object.freeze([
  "Hips","Spine","Chest","Neck","Head",
  "LeftShoulder","LeftUpperArm","LeftLowerArm","LeftHand",
  "RightShoulder","RightUpperArm","RightLowerArm","RightHand",
  "LeftUpperLeg","LeftLowerLeg","LeftFoot",
  "RightUpperLeg","RightLowerLeg","RightFoot"
]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const sin=Math.sin,PI=Math.PI;
const ZERO=()=>[0,0,0];
export function testAngles(preset,time,amplitude=1){
  if(!RIG_TESTS[preset])throw new Error("Test inconnu : "+preset);
  if(!Number.isFinite(time)||!Number.isFinite(amplitude))throw new Error("Paramètres de test invalides.");
  const amp=clamp(amplitude,0,1.5),duration=RIG_TESTS[preset].duration;
  const t=((time%duration)+duration)%duration;
  const phase=t*2*PI/duration;
  const pose={};
  const set=(name,x=0,y=0,z=0)=>{pose[name]=[x*amp,y*amp,z*amp];};
  const breathe=()=>{set("Spine",.025*sin(phase),0,.01*sin(phase));set("Chest",-.025*sin(phase));};
  const arms=()=>{const a=sin(phase),b=sin(phase-.8);
    set("LeftUpperArm",.08,0,-.52*a);
    set("RightUpperArm",.08,0,.52*a);
    set("LeftLowerArm",0,0,-.48*Math.max(0,b));
    set("RightLowerArm",0,0,.48*Math.max(0,-b));
  };
  const walk=()=>{const a=sin(phase),b=sin(phase+PI/2);
    set("LeftUpperLeg",.38*a);set("RightUpperLeg",-.38*a);
    set("LeftLowerLeg",-.42*Math.max(0,-a));
    set("RightLowerLeg",-.42*Math.max(0,a));
    set("LeftUpperArm",-.23*a,0,-.10);set("RightUpperArm",.23*a,0,.10);
    set("LeftFoot",.11*b);set("RightFoot",-.11*b);
    set("Hips",0,.065*sin(phase),.025*sin(2*phase));
  };
  const legs=()=>{const a=Math.max(0,sin(phase));
    set("LeftUpperLeg",.35*a);set("LeftLowerLeg",-.6*a);
    set("RightUpperLeg",-.35*Math.max(0,-sin(phase)));
    set("RightLowerLeg",-.6*Math.max(0,-sin(phase)));
  };
  const head=()=>{set("Head",.10*sin(phase*2),.38*sin(phase),.13*sin(phase*.5));
    set("Neck",0,.12*sin(phase),0);
  };
  const torso=()=>{set("Spine",.13*sin(phase),.15*sin(phase),.12*sin(phase));
    set("Chest",-.08*sin(phase),.18*sin(phase),-.05*sin(phase));
    set("LeftShoulder",0,0,-.10*sin(phase));
    set("RightShoulder",0,0,.10*sin(phase));
  };
  switch(preset){
    case "idle":breathe();break;
    case "arms":arms();break;
    case "walk":walk();break;
    case "legs":legs();break;
    case "head":head();break;
    case "torso":torso();break;
    case "all":{
      // stagger actions: each region gets a full check during the 6s cycle
      const region=Math.min(4,Math.floor(t/1.2));
      const local=t%1.2;
      const test=["arms","walk","legs","head","torso"][region];
      return testAngles(test,local/RIG_TESTS[test].duration*RIG_TESTS[test].duration,amp);
    }
  }
  return pose;
}
export function restoreBoneRotations(bones,rest){
  for(const [name,bone] of bones){
    const rotation=rest.get(name);
    if(rotation)bone.quaternion.copy(rotation);
  }
}
export function diagnosticSummary(angles){
  return Object.keys(angles).sort();
}
