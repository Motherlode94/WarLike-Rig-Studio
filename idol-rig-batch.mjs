export const MAX_FILES=7,MAX_FILE_BYTES=20*1048576,MAX_TOTAL_BYTES=100*1048576;
export function validateIdolRigFiles(files){
 const list=Array.from(files||[]);
 if(!list.length||list.length>MAX_FILES)throw Error('Choisis entre 1 et 7 fichiers GLB.');
 let total=0;
 for(const file of list){
  if(typeof file?.name!=='string'||!/\.glb$/i.test(file.name)||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_FILE_BYTES)
   throw Error('GLB invalide ou supérieur à 20 Mio : '+String(file?.name||'(sans nom)'));
  total+=file.size;
 }
 if(total>MAX_TOTAL_BYTES)throw Error('Lot supérieur à 100 Mio.');
 return list;
}
export function rigOutputName(filename){
 const base=String(filename||'avatar').replace(/\.glb$/i,'').replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,80)||'avatar';
 return base+'_warlike_rig.glb';
}
