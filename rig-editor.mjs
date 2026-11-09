import * as THREE from "three";
import {TransformControls} from "three/addons/controls/TransformControls.js";

export const RIG_COLORS=Object.freeze({
  center:"#21d7ad",spine:"#19bde1",head:"#cf78ff",
  shoulders:"#ffd45a",elbows:"#ff9c44",hands:"#fb6888",
  hips:"#52e87d",knees:"#4394ff",feet:"#27d2cf"
});
export function rigGroup(name){
  if(name==="Head"||name==="Neck")return "head";
  if(name==="Hips"||name==="Spine"||name==="Chest")return name==="Hips"?"hips":"spine";
  if(name.endsWith("Shoulder")||name.endsWith("UpperArm"))return "shoulders";
  if(name.endsWith("LowerArm"))return "elbows";
  if(name.endsWith("Hand"))return "hands";
  if(name.endsWith("UpperLeg"))return "hips";
  if(name.endsWith("LowerLeg"))return "knees";
  if(name.endsWith("Foot"))return "feet";
  return "center";
}
export function mirrorBoneName(name){
  if(name.startsWith("Left"))return "Right"+name.slice(4);
  if(name.startsWith("Right"))return "Left"+name.slice(5);
  return null;
}
const numeric=v=>Math.round(v*10000)/10000;
export function createRigEditor({scene,camera,renderer,orbit,boneRoot,rigMap,skeleton,skinnedMeshes,plan,onSelect,onChange,onNotice}){
  let selected=null,active=false,destroyed=false;const history=[];\n  const snapshot=()=>new Map([...rigMap].map(([name,bone])=>[name,bone.position.clone()]));\n  const pushHistory=()=>{history.push(snapshot());if(history.length>30)history.shift();};
  const pivot=new THREE.Object3D();
  pivot.name="RigEditPivot";scene.add(pivot);
  const markerGroup=new THREE.Group();
  markerGroup.name="RigEditMarkers";scene.add(markerGroup);
  const transform=new TransformControls(camera,renderer.domElement);
  transform.setMode("translate");transform.setSpace("world");
  transform.setSize(.85);
  scene.add(transform);
  const sphere=new THREE.SphereGeometry(Math.max(.007,plan.height*.013),12,10);
  const hits=[],byName=new Map(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  for(const [name,bone] of rigMap){
    const category=rigGroup(name);
    const material=new THREE.MeshBasicMaterial({
      color:RIG_COLORS[category],depthTest:false,transparent:true,opacity:.95
    });
    const marker=new THREE.Mesh(sphere,material);
    marker.name="Joint:"+name;marker.userData.boneName=name;marker.renderOrder=100;
    markerGroup.add(marker);hits.push(marker);byName.set(name,marker);
  }
  function rigGroupName(name){return rigGroupFor(name);}
  function rigGroupFor(name){return globalGroup(name);}
  // Keep aliases local so the exported categorization remains easily testable.
  function globalGroup(name){
    if(name==="Head"||name==="Neck")return "head";
    if(name==="Hips"||name==="Spine"||name==="Chest")return name==="Hips"?"hips":"spine";
    if(/Shoulder|UpperArm$/.test(name))return "shoulders";
    if(/LowerArm$/.test(name))return "elbows";
    if(/Hand$/.test(name))return "hands";
    if(/UpperLeg$/.test(name))return "hips";
    if(/LowerLeg$/.test(name))return "knees";
    if(/Foot$/.test(name))return "feet";
    return "center";
  }
  const world=new THREE.Vector3();
  const childPositions=[];
  function worldPosition(bone){
    return bone.getWorldPosition(new THREE.Vector3());
  }
  function refresh(){
    if(destroyed)return;
    boneRoot.updateMatrixWorld(true);
    for(const [name,bone] of rigMap)byName.get(name).position.copy(worldPosition(bone));
    if(selected&&!transform.dragging)pivot.position.copy(worldPosition(rigMap.get(selected)));
  }
  function updateSkin(){
    boneRoot.updateMatrixWorld(true);
    skeleton.calculateInverses();
    skeleton.update();
    for(const mesh of skinnedMeshes){mesh.skeleton=skeleton;mesh.updateMatrixWorld(true);}
  }
  function setRestWorldPosition(name,target){
    const bone=rigMap.get(name);if(!bone)throw Error("Articulation absente : "+name);
    if(![target.x,target.y,target.z].every(Number.isFinite))throw Error("Coordonnées invalides.");
    boneRoot.updateMatrixWorld(true);
    const children=bone.children.filter(child=>child.isBone);
    childPositions.length=0;
    for(const child of children)childPositions.push([child,worldPosition(child)]);
    const parent=bone.parent;
    if(!parent)throw Error("L'os n'a pas de parent.");
    parent.updateWorldMatrix(true,false);
    bone.position.copy(parent.worldToLocal(target.clone()));
    boneRoot.updateMatrixWorld(true);
    for(const [child,position] of childPositions){
      child.position.copy(bone.worldToLocal(position.clone()));
    }
    updateSkin();
    refresh();
    if(selected===name)onChange(name,[numeric(target.x),numeric(target.y),numeric(target.z)]);
  }
  function select(name){
    if(!rigMap.has(name))return;
    if(selected&&byName.get(selected))byName.get(selected).scale.setScalar(1);
    selected=name;const b=rigMap.get(name);
    pivot.position.copy(worldPosition(b));
    transform.attach(pivot);
    if(active)transform.visible=true;
    byName.get(name).scale.setScalar(1.55);
    onSelect({name,category:rigGroup(name),position:pivot.position.toArray().map(numeric)});
  }
  function onPointerDown(event){
    if(!active||transform.dragging||event.button!==0)return;
    const bounds=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const result=raycaster.intersectObjects(hits,false);
    if(result.length)select(result[0].object.userData.boneName);
  }
  function onDragging(event){orbit.enabled=!event.value;}
  function onDragStart(){pushHistory();}\n  function onObjectChange(){
    if(!selected||!active)return;
    setRestWorldPosition(selected,pivot.position.clone());
    // Critical: the bind pose is recomputed while there is NO animation pose;
    // the source geometry stays intact and no decimation is performed.
  }
  renderer.domElement.addEventListener("pointerdown",onPointerDown);
  transform.addEventListener("dragging-changed",onDragging);
  transform.addEventListener("objectChange",onObjectChange);\n  transform.addEventListener("mouseDown",onDragStart);
  function enable(flag){
    active=!!flag;markerGroup.visible=active;
    transform.visible=active&&!!selected;
    transform.enabled=active&&!!selected;
    if(!active)transform.detach();
    else if(selected)transform.attach(pivot);
    refresh();
  }
  function moveSelected(position){
    if(!selected)throw Error("Sélectionne d'abord un point coloré.");
    const target=new THREE.Vector3(...position.map(Number));
    pushHistory();setRestWorldPosition(selected,target);refresh();
  }
  function mirrorSelected(){
    if(!selected)throw Error("Sélectionne d'abord un point.");
    const other=mirrorBoneName(selected);
    if(!other||!rigMap.has(other))throw Error("Pas de point symétrique pour cet os.");
    const position=worldPosition(rigMap.get(selected));
    position.x=2*plan.center[0]-position.x;
    pushHistory();setRestWorldPosition(other,position);
    select(other);
    onNotice("Point symétrique positionné : "+other);
  }
  function undo(){\n    const state=history.pop();if(!state)return false;\n    for(const [name,position] of state)rigMap.get(name)?.position.copy(position);\n    updateSkin();refresh();if(selected)select(selected);return true;\n  }\n  function reset(){\n    pushHistory();
    for(const bone of rigMap.values())bone.quaternion.identity();
    // Restore original rest joint positions, top-down.
    for(const reference of plan.bones){
      const bone=rigMap.get(reference.name);
      const parent=bone.parent;
      parent.updateWorldMatrix(true,false);
      bone.position.copy(parent.worldToLocal(new THREE.Vector3(...reference.position)));
      boneRoot.updateMatrixWorld(true);
    }
    updateSkin();refresh();
    if(selected)select(selected);
  }
  enable(false);
  refresh();
  return {
    select,enable,refresh,moveSelected,mirrorSelected,reset,undo,\n    get canUndo(){return history.length>0;},\n    setSnap(value){transform.setTranslationSnap(value||null);},
    get selected(){return selected;},
    get selectedPosition(){return selected?worldPosition(rigMap.get(selected)).toArray().map(numeric):null;},
    get colors(){return RIG_COLORS;},
    dispose(){
      destroyed=true;
      renderer.domElement.removeEventListener("pointerdown",onPointerDown);
      transform.removeEventListener("dragging-changed",onDragging);
      transform.removeEventListener("objectChange",onObjectChange);\n      transform.removeEventListener("mouseDown",onDragStart);
      transform.detach();scene.remove(transform);transform.dispose();
      scene.remove(markerGroup);scene.remove(pivot);
      sphere.dispose();for(const marker of hits)marker.material.dispose();
      orbit.enabled=true;
    }
  };
}
