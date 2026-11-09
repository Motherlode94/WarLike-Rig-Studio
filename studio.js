import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {makeHumanoidPlan,weightsAt,inspectInput} from "./rig-core.mjs";
import {createRigEditor,rigGroup,RIG_COLORS} from "./rig-editor.mjs";
import {RIG_TESTS,testAngles,diagnosticSummary} from "./rig-tester.mjs";
import {inspectExistingSkeletons} from "./existing-rig.mjs";

const $=id=>document.getElementById(id), status=(message,level="info")=>{
  $("status").textContent=message;$("status").dataset.level=level;
};
const renderer=new THREE.WebGLRenderer({canvas:$("viewport"),antialias:true,alpha:false,powerPreference:"high-performance"});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
const scene=new THREE.Scene();
scene.background=new THREE.Color("#111724");
scene.add(new THREE.HemisphereLight(0xffffff,0x546179,2.2));
const key=new THREE.DirectionalLight(0xffe8d7,2.7);
key.position.set(3,6,4);scene.add(key);
const rim=new THREE.DirectionalLight(0x88b8ff,1.4);rim.position.set(-4,2,-3);scene.add(rim);
const grid=new THREE.GridHelper(10,20,0x3c5366,0x23313f);scene.add(grid);
const camera=new THREE.PerspectiveCamera(37,1,.01,2000);
camera.position.set(2,1.7,4);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.07;
const loader=new GLTFLoader(),exporter=new GLTFExporter();
let original=null,rigged=null,helpers=null,sourceName="",modelInfo=null,rigMap=null,rigPose=null;
let pending=false,sourceBlobUrl=null,originalIsRigged=false;
let editor=null,poseActive=false,nativeClips=[],nativeMixer=null,restTransforms=null,existingInfo=null;
function motionDef(){const id=$("motionPreset").value;if(id.startsWith("native:")){const clip=nativeClips[Number(id.slice(7))];return clip?{label:"GLB · "+clip.name,duration:clip.duration}:RIG_TESTS.idle;}return RIG_TESTS[id]||RIG_TESTS.idle;}
function restoreReference(){nativeMixer?.stopAllAction();if(restTransforms){for(const [node,t] of restTransforms){node.position.copy(t.position);node.quaternion.copy(t.quaternion);node.scale.copy(t.scale);}}else if(rigMap&&rigPose){for(const [name,b] of rigMap)b.quaternion.copy(rigPose.get(name));}rigged?.updateMatrixWorld(true);}
function configureImportedClips(){const select=$("motionPreset"),before=select.value;for(const o of [...select.options])if(o.value.startsWith("native:"))o.remove();nativeClips.forEach((clip,i)=>select.add(new Option("GLB · "+(clip.name||"Clip "+(i+1)),"native:"+i)));select.value=originalIsRigged&&nativeClips.length?"native:0":before.startsWith("native:")?"idle":before;}
function setImportedReadOnly(){for(const id of ["applyJoint","mirrorJoint","undoJoint","resetJoints","snap"]){$(id).disabled=originalIsRigged;$(id).title=originalIsRigged?"Rig importé : les matrices de liaison sont protégées.":"";}$("importRigNotice").textContent=originalIsRigged?"Rig existant reconnu : inspection et animation disponibles ; édition de liaison verrouillée.":"Rig créé ici : points ajustables.";}

const motion={playing:false,time:0,previousFrame:null};
function stopMotion({keepPose=false}={}){
  motion.playing=false;motion.previousFrame=null;
  $("motionPlay").textContent="▶ Lire";
  if(!keepPose&&rigMap){restoreReference();poseActive=false;}
  if(rigMap)setMode($("modeRigged").checked?"rigged":"original");
}
function syncMotionUI(){
  const def=motionDef();
  $("motionTime").max=String(def.duration);
  $("motionTime").value=String(Math.min(motion.time,def.duration));
  $("motionTimeLabel").textContent=motion.time.toFixed(2).replace(".",",")+" s / "+def.duration.toFixed(2).replace(".",",")+" s";
  $("motionAmplitudeLabel").textContent=$("motionAmplitude").value+" %";
  $("motionSpeedLabel").textContent=(Number($("motionSpeed").value)/100).toLocaleString("fr")+"×";
  $("motionSmoothnessLabel").textContent=$("motionSmoothness").value+" %";
  $("motionPlay").disabled=!rigMap||pending;
  $("motionPause").disabled=!rigMap||!motion.playing||pending;
  $("motionTime").disabled=!rigMap||pending;
}
function sampleMotion({instant=false,dt=1/60}={}){
  if(!rigMap)return;
  const preset=$("motionPreset").value;
  let poses={};
  if(preset.startsWith("native:")){
    // Native animation keys belong to the source GLB. Never rewrite the original clip.
    restoreReference();
    const clip=nativeClips[Number(preset.slice(7))];
    if(clip&&nativeMixer){nativeMixer.clipAction(clip).play();nativeMixer.setTime(motion.time);}
  }else{
    poses=testAngles(preset,motion.time,Number($("motionAmplitude").value)/100);
    // Quaternion damping toward the desired pose, rather than snapping from
    // bind pose every frame. Each target is computed FROM the stored rest pose.
    const smoothing=Number($("motionSmoothness").value)/100;
    const response=THREE.MathUtils.lerp(32,5.5,smoothing);
    const alpha=instant?1:1-Math.exp(-response*Math.min(.1,Math.max(0,dt)));
    for(const [name,bone] of rigMap){
      const rest=rigPose.get(name);
      if(!rest)continue;
      const angles=poses[name]||[0,0,0];
      const desired=rest.clone().multiply(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(...angles,"XYZ")
      ));
      bone.quaternion.slerp(desired,alpha);
    }
  }
  poseActive=true;
  $("modeRigged").checked=true;setMode("rigged");
  const changed=diagnosticSummary(poses);
  $("motionDiagnostic").textContent=preset.startsWith("native:")
    ?"Clip GLB : "+motionDef().label+". Animation et rig d'origine conservés."
    :motionDef().label+" · "+changed.length+" articulation(s) sollicitées : "+changed.join(", ")+
     ". Transitions amorties, sans modification du squelette ni des poids.";
  syncMotionUI();
}
function resetMotion(){
  stopMotion();
  motion.time=0;syncMotionUI();
  $("motionDiagnostic").textContent="Pose de repos restaurée. Les poids de skinning et le placement des os restent inchangés.";
}

function setBusy(value){
  pending=value;
  for(const id of ["file","rig","save","resetPose","testPose","showRestPose"])$(id).disabled=value;
  syncMotionUI();
}
function frame(object){
  object.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(object);
  if(box.isEmpty())throw Error("Aucune géométrie visible dans le GLB.");
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  controls.target.copy(center);
  const distance=Math.max(1,size.length()/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)));
  camera.position.copy(center).add(new THREE.Vector3(distance*.30,distance*.15,distance*.95));
  camera.near=Math.max(.001,distance/300);camera.far=Math.max(100,distance*12);camera.updateProjectionMatrix();
  grid.position.y=box.min.y;
  controls.update();return box;
}
function clearObject(o){if(o){scene.remove(o);}}
function disposeHelpers(){if(helpers){scene.remove(helpers);helpers=null;}}
function updateMetrics(data){
  $("metrics").replaceChildren();
  for(const [label,value] of Object.entries(data)){
    const row=document.createElement("div"),a=document.createElement("span"),b=document.createElement("strong");
    a.textContent=label;b.textContent=String(value);row.append(a,b);$("metrics").append(row);
  }
}
function inspect(root) {
  const stats={meshCount:0,skinCount:0,vertexCount:0,triangleCount:0,morphCount:0};
  root.traverse(o=>{
    if(!o.isMesh)return;stats.meshCount++;
    if(o.isSkinnedMesh)stats.skinCount++;
    const g=o.geometry,p=g?.getAttribute("position"),index=g?.index;
    stats.vertexCount+=p?.count||0;
    stats.triangleCount+=index?index.count/3:(p?.count||0)/3;
    stats.morphCount+=Object.keys(o.morphTargetDictionary||{}).length;
  });
  return inspectInput(stats);
}
function setMode(mode){
  if(original)original.visible=mode==="original";
  if(rigged)rigged.visible=mode==="rigged";
  if(helpers)helpers.visible=mode==="rigged"&&$("showBones").checked;
  editor?.enable(mode==="rigged"&&$("editJoints").checked&&!poseActive);
  $("modeOriginal").disabled=!original;
  $("modeRigged").disabled=!rigged;
}
async function load(file){
  if(!file || !/\.glb$/i.test(file.name))throw Error("Un fichier GLB est nécessaire.");
  if(file.size>150*1024*1024)throw Error("Limite de sécurité : 150 Mio par GLB.");
  if(sourceBlobUrl)URL.revokeObjectURL(sourceBlobUrl);
  sourceBlobUrl=URL.createObjectURL(file);
  try {
    const gltf=await loader.loadAsync(sourceBlobUrl);
    const next=gltf.scene;
    const info=inspect(next);
    if(!info.meshCount)throw Error("Le GLB ne contient aucun maillage.");
    stopMotion();editor?.dispose();editor=null;poseActive=false;
    disposeHelpers();clearObject(original);clearObject(rigged);
    original=info.alreadyRigged?null:next;rigged=info.alreadyRigged?next:null;rigMap=null;modelInfo=info;rigPose=null;
    originalIsRigged=info.alreadyRigged;
    nativeClips=gltf.animations||[];
    nativeMixer=originalIsRigged&&nativeClips.length?new THREE.AnimationMixer(next):null;
    restTransforms=originalIsRigged?new Map():null;
    if(restTransforms)next.traverse(o=>restTransforms.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()}));
    configureImportedClips();
    $("jointSelect").replaceChildren(new Option("Aucune articulation",""));
    $("jointSelect").disabled=true;updateSelectedJoint(null);
    // Load either an unrigged source or an already-skinned model.
    // In the latter case original is intentionally null: add the actual GLTF scene.
    scene.add(next);
    next.visible=true;
    sourceName=file.name.replace(/\.glb$/i,"");sourceName=sourceName.slice(0,96);
    frame(next);
    if(originalIsRigged){
      const meshes=[];next.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
      existingInfo=inspectExistingSkeletons(meshes);
      if(existingInfo.valid){
        rigMap=existingInfo.mappedBones;
        rigPose=new Map([...rigMap].map(([name,b])=>[name,b.quaternion.clone()]));
        const debug=new THREE.SkeletonHelper(next);
        debug.material.depthTest=false;debug.material.transparent=true;debug.material.opacity=.95;
        scene.add(debug);helpers=debug;
        if(rigMap.size){
          const plan=makeHumanoidPlan(new THREE.Box3().setFromObject(next));
          editor=createRigEditor({scene,camera,renderer,orbit:controls,boneRoot:next,rigMap,skeleton:existingInfo.skeleton,skinnedMeshes:meshes,plan,readOnly:true,
            onSelect:({name,category,position})=>updateSelectedJoint({name,category,position}),
            onChange:()=>{},onNotice:message=>status(message)});
          $("jointSelect").replaceChildren(...[...rigMap.keys()].map(name=>new Option(name,name)));
          $("jointSelect").disabled=false;editor.select(rigMap.keys().next().value);
        }
        $("boneCount").textContent=String(existingInfo.boneCount);
        $("vertexCount").textContent=String(info.vertexCount);
        $("protectedCount").textContent="—";
        $("motionDiagnostic").textContent=nativeClips.length?nativeClips.length+" animation(s) du GLB reconnue(s).":"Squelette reconnu : tests procéduraux selon les noms des os.";
      }
      $("modeRigged").checked=true;setMode("rigged");
    }else{existingInfo=null;$("modeOriginal").checked=true;setMode("original");}
    $("rig").disabled=!info.canAutoRig;
    $("save").disabled=!existingInfo?.valid;$("testPose").disabled=!existingInfo?.valid;$("resetPose").disabled=!existingInfo?.valid;$("showRestPose").disabled=!existingInfo?.valid;
    setImportedReadOnly();motion.time=0;syncMotionUI();
    updateMetrics({
      "Maillages":info.meshCount,"Sommets":info.vertexCount.toLocaleString("fr"),
      "Triangles":Math.round(info.triangleCount).toLocaleString("fr"),
      "Squelettes présents":info.skinCount,"Morph targets":info.morphCount,
      "Fichier":(file.size/1048576).toFixed(1)+" Mio"
    });
    status(info.alreadyRigged?(existingInfo?.valid?"GLB déjà riggé reconnu : "+existingInfo.boneCount+" os, "+nativeClips.length+" clips. Rig original préservé. "+existingInfo.warnings.join(" "):"Skin présent mais squelette inutilisable."):"GLB non riggé chargé : créer son squelette.",existingInfo?.valid?"success":"info");
  } finally {URL.revokeObjectURL(sourceBlobUrl);sourceBlobUrl=null;}
}
function boneRig(plan) {
  const map=new Map();
  for(const b of plan.bones){
    const bone=new THREE.Bone();bone.name=b.name;
    bone.position.set(...b.position);
    map.set(b.name,bone);
  }
  const group=new THREE.Group();group.name="WarLikeRig";
  const worldPositions=new Map(plan.bones.map(b=>[b.name,new THREE.Vector3(...b.position)]));
  // Compute local transforms against the parent's ORIGINAL world position.
  // Subtracting already-local parent coordinates breaks all deeper chains.
  for(const b of plan.bones){
    const bone=map.get(b.name);
    if(b.parent){
      const parent=map.get(b.parent);
      bone.position.copy(worldPositions.get(b.name)).sub(worldPositions.get(b.parent));
      parent.add(bone);
    }else group.add(bone);
  }
  group.updateMatrixWorld(true);
  return {group,bones:plan.bones.map(b=>map.get(b.name)),map};
}
function generateRig(){
  if(!original||!modelInfo?.canAutoRig)throw Error("Importe d'abord un GLB non riggé.");
  original.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(original);
  const plan=makeHumanoidPlan(bounds,{armPose:$("armPose").value});
  const {group,bones,map}=boneRig(plan);
  const target=new THREE.Group();target.name="WarLike_Rigged_Character";
  target.add(group);
  const skeleton=new THREE.Skeleton(bones);
  let total=0,protectedVertices=0;
  original.traverse(object=>{
    if(!object.isMesh)return;
    if(object.isSkinnedMesh)throw Error("Rig préexistant détecté : opération annulée.");
    const geo=object.geometry.clone();
    geo.applyMatrix4(object.matrixWorld);
    const positions=geo.getAttribute("position");
    if(!positions)return;
    const indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4);
    for(let i=0;i<positions.count;i++){
      const value=weightsAt([positions.getX(i),positions.getY(i),positions.getZ(i)],plan,{lockHead:$("lockHead").checked});
      if(value.zone==="head-protected")protectedVertices++;
      for(let j=0;j<4;j++){indices[i*4+j]=value.indices[j];weights[i*4+j]=value.weights[j];}
    }
    geo.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));
    geo.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
    // Rigid head deformation and PBR textures retain the original vertex density.
    const mesh=new THREE.SkinnedMesh(geo,object.material);
    mesh.name=object.name||"WarLikeSkinnedMesh";
    mesh.frustumCulled=false;
    mesh.bind(skeleton,new THREE.Matrix4());
    target.add(mesh);total+=positions.count;
  });
  if(!total)throw Error("Aucun sommet utilisable.");
  stopMotion();editor?.dispose();editor=null;poseActive=false;
  disposeHelpers();clearObject(rigged);
  rigged=target;scene.add(rigged);
  rigMap=map;rigPose=new Map([...map].map(([name,b])=>[name,b.quaternion.clone()]));
  const debug=new THREE.SkeletonHelper(group);
  debug.material.depthTest=false;debug.material.transparent=true;debug.material.opacity=.95;
  debug.name="SkeletonPreview";scene.add(debug);helpers=debug;
  editor=createRigEditor({
    scene,camera,renderer,orbit:controls,boneRoot:group,rigMap:map,
    skeleton,skinnedMeshes:target.children.filter(o=>o.isSkinnedMesh),plan,
    onSelect:({name,category,position})=>updateSelectedJoint({name,category,position}),
    onChange:(name,position)=>updateSelectedJoint({name,category:rigGroup(name),position}),
    onNotice:message=>status(message)
  });
  $("jointSelect").replaceChildren(...plan.bones.map(({name})=>new Option(name,name)));
  $("jointSelect").disabled=false;
  editor.select("Hips");
  editor.setSnap(Number($("snap").value)||null);
  $("modeRigged").checked=true;setMode("rigged");
  $("save").disabled=false;$("testPose").disabled=false;$("resetPose").disabled=false;$("showRestPose").disabled=false;setImportedReadOnly();
  motion.time=0;syncMotionUI();
  $("boneCount").textContent=String(bones.length);
  $("protectedCount").textContent=protectedVertices.toLocaleString("fr");
  $("vertexCount").textContent=total.toLocaleString("fr");
  frame(rigged);
  status("Rig expérimental créé : "+bones.length+" os, "+protectedVertices+" sommets de tête verrouillés. Contrôle les déformations avant l'export.","success");
}
function updateSelectedJoint(value){
  const label=$("selectedJoint"),inputs=[$("jointX"),$("jointY"),$("jointZ")];
  if(!value){label.textContent="Sélectionne un point coloré";label.style.color="";
    for(const control of inputs){control.value="";control.disabled=true;}
    $("mirrorJoint").disabled=true;return;}
  const {name,category,position}=value;
  label.textContent=name+" · "+category;label.style.color=RIG_COLORS[category];
  $("jointSelect").value=name;
  for(let i=0;i<3;i++){inputs[i].disabled=originalIsRigged;inputs[i].value=Number(position[i]).toFixed(4);}
  $("mirrorJoint").disabled=originalIsRigged||!/^Left|^Right/.test(name);
}
function resetPose(){
  if(!rigMap)return;
  motion.playing=false;motion.previousFrame=null;syncMotionUI();
  restoreReference();
  poseActive=false;
  setMode($("modeRigged").checked?"rigged":"original");
  status("Pose de repos restaurée.");
}
function demoPose(){
  if(!rigMap)return;stopMotion();resetPose();
  const rotate=(name,x,y,z)=>{const b=rigMap.get(name);if(b)b.rotation.set(x,y,z);};
  rotate("LeftUpperArm",0,0,-.30);
  rotate("RightUpperArm",0,0,.30);
  rotate("LeftLowerArm",0,0,-.15);
  rotate("RightLowerArm",0,0,.15);
  rotate("Head",.07,0,.08);
  poseActive=true;setMode("rigged");
  status("Pose de test appliquée. Clique sur Repos avant de déplacer les articulations.");
}
async function save(){
  if(!rigged)throw Error("Aucun rig à exporter.");
  resetPose();
  const visible=rigged.visible;
  rigged.visible=true;
  const detached=helpers?.visible; if(helpers)helpers.visible=false;
  try{
    const buffer=await exporter.parseAsync(rigged,{binary:true,onlyVisible:true,trs:true,animations:originalIsRigged?nativeClips:[]});
    const blob=new Blob([buffer],{type:"model/gltf-binary"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=(sourceName||"avatar")+"_warlike_rig.glb";
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),6000);
    status("GLB riggé exporté ("+(blob.size/1048576).toFixed(1)+" Mio). Contrôle son import dans WarLike Engine.","success");
  }finally{rigged.visible=visible;if(helpers)helpers.visible=detached;}
}
$("file").addEventListener("change",async e=>{
  const f=e.target.files?.[0];e.target.value="";if(!f)return;
  setBusy(true);status("Chargement du modèle…");
  try{await load(f);}catch(error){status("Import : "+error.message,"error");}finally{setBusy(false);$("rig").disabled=!modelInfo?.canAutoRig;$("save").disabled=!rigged;$("testPose").disabled=!rigMap;$("resetPose").disabled=!rigMap;$("showRestPose").disabled=!rigMap;}
});
$("rig").addEventListener("click",()=>{try{generateRig();}catch(error){status("Rig : "+error.message,"error");}});
$("save").addEventListener("click",async()=>{
  setBusy(true);try{await save();}catch(error){status("Export : "+error.message,"error");}
  finally{setBusy(false);$("rig").disabled=!modelInfo?.canAutoRig;$("save").disabled=!rigged;$("testPose").disabled=!rigMap;$("resetPose").disabled=!rigMap;$("showRestPose").disabled=!rigMap;}
});
$("resetPose").addEventListener("click",resetMotion);
$("showRestPose").addEventListener("click",resetMotion);
$("motionPreset").addEventListener("change",()=>{
  motion.playing=false;motion.previousFrame=null;motion.time=0;
  if(rigMap)sampleMotion({instant:true});else syncMotionUI();
});
$("motionTime").addEventListener("input",event=>{
  motion.time=Number(event.target.value);
  if(rigMap)sampleMotion({instant:true});else syncMotionUI();
});
$("motionAmplitude").addEventListener("input",()=>{
  if(rigMap)sampleMotion({instant:true});else syncMotionUI();
});
$("motionSpeed").addEventListener("input",syncMotionUI);
$("motionSmoothness").addEventListener("input",syncMotionUI);
$("motionPlay").addEventListener("click",()=>{
  if(!rigMap||pending)return;
  if(motion.time>=motionDef().duration)motion.time=0;
  motion.playing=true;motion.previousFrame=null;
  sampleMotion({instant:true});syncMotionUI();
  status("Lecture du test : inspecte les articulations pendant le mouvement.","success");
});
$("motionPause").addEventListener("click",()=>{
  motion.playing=false;motion.previousFrame=null;syncMotionUI();
  status("Test en pause : la pose reste affichée. Repos pour revenir à la pose neutre.");
});

$("testPose").addEventListener("click",demoPose);
$("showBones").addEventListener("change",()=>setMode($("modeRigged").checked?"rigged":"original"));
$("editJoints").addEventListener("change",()=>setMode($("modeRigged").checked?"rigged":"original"));
$("jointSelect").addEventListener("change",event=>editor?.select(event.target.value));
$("snap").addEventListener("change",event=>editor?.setSnap(Number(event.target.value)||null));
$("applyJoint").addEventListener("click",()=>{
  if(!editor)return;
  try{
    if(poseActive)resetPose();
    editor.moveSelected([Number($("jointX").value),Number($("jointY").value),Number($("jointZ").value)]);
    status("Articulation déplacée, pose de référence recalculée sans décimation.","success");
  }catch(error){status(error.message,"error");}
});
$("mirrorJoint").addEventListener("click",()=>{
  try{if(poseActive)resetPose();editor?.mirrorSelected();}
  catch(error){status(error.message,"error");}
});
$("undoJoint").addEventListener("click",()=>{
  if(!editor)return;
  if(poseActive)resetPose();
  if(editor.undo())status("Dernier déplacement annulé.");else status("Aucune modification à annuler.");
});
$("resetJoints").addEventListener("click",()=>{
  if(!editor)return;
  if(poseActive)resetPose();
  editor.reset();status("Tous les points sont revenus à leur position initiale.");
});
window.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"&&editor&&
     !["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)){
    event.preventDefault();if(poseActive)resetPose();editor.undo();
  }
});
$("modeOriginal").addEventListener("change",()=>setMode("original"));
$("modeRigged").addEventListener("change",()=>setMode("rigged"));
function resize(){
 const rect=$("stage").getBoundingClientRect();
 const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
 renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($("stage"));
function loop(now){
  requestAnimationFrame(loop);
  if(motion.playing&&rigMap){
    if(motion.previousFrame!==null){
      const dt=Math.min(.08,Math.max(0,(now-motion.previousFrame)/1000));
      const duration=motionDef().duration;
      const speed=Number($("motionSpeed").value)/100;
      motion.time+=dt*speed;
      if(motion.time>=duration){
        if($("motionLoop").checked)motion.time%=duration;
        else{motion.time=duration-1e-6;motion.playing=false;motion.previousFrame=null;}
      }
      sampleMotion({dt});
    }
    motion.previousFrame=motion.playing?now:null;
  }
  controls.update();renderer.render(scene,camera);
}
resize();syncMotionUI();requestAnimationFrame(loop);
