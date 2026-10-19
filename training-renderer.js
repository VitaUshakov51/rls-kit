export const TRAINING_DEFAULTS=Object.freeze({jacket:'#bfc1c4',inserts:'#191d24',pants:'#191d24',pantsInserts:'#bfc1c4'});
export function normalizeTrainingState(value){
  const result={...TRAINING_DEFAULTS};
  for(const key of Object.keys(result))if(/^#[0-9a-f]{6}$/i.test(value?.[key]||''))result[key]=value[key].toLowerCase();
  if(!/^#[0-9a-f]{6}$/i.test(value?.pantsInserts||''))result.pantsInserts=result.jacket;
  for(const key of Object.keys(result))if(result[key]==='#191919')result[key]='#191d24';
  return result;
}
export function trainingAsset(name,{preview=false}={}){
  const file=name==='model'?(preview?'preview.webp':'model.webp'):(preview?'preview-':'')+name+(name==='poster'?'.webp':'.png');
  return 'assets/training/'+file+'?v=19';
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const byte=value=>Math.max(0,Math.min(255,Math.round(value)));
export function renderTrainingPixels(source,materials,value,output=new Uint8ClampedArray(source.length),lighting,pantsInserts){
  const state=normalizeTrainingState(value),colors=['jacket','inserts','pants','pantsInserts'].map(key=>rgb(state[key]));
  output.set(source);
  for(let p=0;p<source.length;p+=4){
    const a=materials[p]/255,b=materials[p+1]/255,c=materials[p+2]/255,d=pantsInserts[p]/255,weight=Math.min(1,a+b+c+d);
    if(!weight)continue;
    const shade=lighting[p]/235;
    for(let k=0;k<3;k++)output[p+k]=byte(source[p+k]*(1-weight)+(colors[0][k]*a+colors[1][k]*b+colors[2][k]*c+colors[3][k]*d)*shade);
  }
  return output;
}
export function trainingSelectionAt(materials,width,height,x,y,pantsInserts){
  if(x<0||y<0||x>=width||y>=height)return null;
  const p=(Math.floor(y)*width+Math.floor(x))*4,values=[materials[p],materials[p+1],materials[p+2],pantsInserts[p]],maximum=Math.max(...values);
  if(maximum<64)return null;
  return ['jacket','inserts','pants','pantsInserts'][values.indexOf(maximum)];
}
