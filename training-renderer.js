import {PATTERNS,PRINT_KEYS} from './renderer.js?v=22p2';
export const TRAINING_COLOR_KEYS=Object.freeze(['jacket','inserts','pants','pantsInserts',...PRINT_KEYS]);
export const TRAINING_DEFAULTS=Object.freeze({jacket:'#bfc1c4',inserts:'#191d24',pants:'#191d24',pantsInserts:'#bfc1c4',print:'#191d24',printSecondary:'#262626',printTertiary:'#9b9424',printFourth:'#fffcdb',printFifth:'#d9dadb',topMode:'inserts',pantsMode:'inserts',pattern:'original'});
export function normalizeTrainingState(value){
  const result={...TRAINING_DEFAULTS};
  for(const key of TRAINING_COLOR_KEYS)if(/^#[0-9a-f]{6}$/i.test(value?.[key]||''))result[key]=value[key].toLowerCase();
  if(!/^#[0-9a-f]{6}$/i.test(value?.pantsInserts||''))result.pantsInserts=result.jacket;
  for(const key of ['jacket','inserts','pants','pantsInserts'])if(result[key]==='#191919')result[key]='#191d24';
  if(['inserts','print','plain'].includes(value?.topMode))result.topMode=value.topMode;
  if(['inserts','plain'].includes(value?.pantsMode))result.pantsMode=value.pantsMode;
  if(PATTERNS.some(p=>p.id===value?.pattern&&p.id!=='none'))result.pattern=value.pattern;
  return result;
}
export function trainingAsset(name,{preview=false}={}){
  const file=name==='model'?(preview?'preview.webp':'model.webp'):(preview?'preview-':'')+name+(name==='poster'||preview?'.webp':'.png');
  return 'assets/training/'+file+'?v=20';
}
export function trainingPatternAsset(id,{preview=false,extra=false}={}){
  if(!PATTERNS.some(p=>p.id===id&&id!=='none'))throw new Error('Unknown training pattern');
  return 'assets/training/'+(preview?'preview/':'')+'patterns/'+id+(extra?'-extra':'')+'.png?v=22t1';
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const byte=value=>Math.max(0,Math.min(255,Math.round(value)));
function isLogo(p,width,bottom=false){
  const x=(p/4%width)*1086/width,y=Math.floor(p/4/width)*1086/width;
  return bottom?x>=388&&x<458&&y>=688&&y<722:x>=194&&x<270&&y>=206&&y<239;
}
export function renderTrainingPixels(source,materials,value,output=new Uint8ClampedArray(source.length),lighting,pantsInserts,pattern=null,width=1086){
  const state=normalizeTrainingState(value),colors=['jacket','inserts','pants','pantsInserts'].map(key=>rgb(state[key]));
  const printed=state.topMode==='print',inks=printed?PRINT_KEYS.map(key=>rgb(state[key])):null;
  output.set(source);
  for(let p=0;p<source.length;p+=4){
    const a=materials[p]/255,b=materials[p+1]/255,c=materials[p+2]/255,d=pantsInserts[p]/255,weight=Math.min(1,a+b+c+d);
    if(!weight)continue;
    const shade=lighting[p]/235;
    // Keep the original inserts mode pixel-for-pixel compatible with version 22.
    if(state.topMode==='inserts'&&state.pantsMode==='inserts'){
      for(let k=0;k<3;k++)output[p+k]=byte(source[p+k]*(1-weight)+(colors[0][k]*a+colors[1][k]*b+colors[2][k]*c+colors[3][k]*d)*shade);
      continue;
    }
    const logo=b&&isLogo(p,width)?b:0,topInsert=state.topMode==='inserts'?b:logo;
    const top=a+b-topInsert,bottomInsert=state.pantsMode==='inserts'||(d&&isLogo(p,width,true))?d:0,bottom=c+d-bottomInsert;
    const hasPrint=printed&&top&&pattern;
    const w0=hasPrint?pattern.data[p]/255:0,w1=hasPrint?pattern.data[p+1]/255:0,w2=hasPrint?pattern.data[p+2]/255:0,w3=hasPrint?(pattern.extra?.[p]||0)/255:0,w4=hasPrint?(pattern.extra?.[p+1]||0)/255:0;
    const base=Math.max(0,1-(w0+w1+w2+w3+w4));
    for(let k=0;k<3;k++){
      let fabric=colors[0][k];
      if(hasPrint)fabric=colors[0][k]*base+inks[0][k]*w0+inks[1][k]*w1+inks[2][k]*w2+inks[3][k]*w3+inks[4][k]*w4;
      output[p+k]=byte(source[p+k]*(1-weight)+(fabric*top+colors[1][k]*topInsert+colors[2][k]*bottom+colors[3][k]*bottomInsert)*shade);
    }
  }
  return output;
}
export function trainingSelectionAt(materials,width,height,x,y,pantsInserts,value=null,pattern=null){
  if(x<0||y<0||x>=width||y>=height)return null;
  const state=normalizeTrainingState(value),p=(Math.floor(y)*width+Math.floor(x))*4,values=[materials[p],materials[p+1],materials[p+2],pantsInserts[p]],maximum=Math.max(...values);
  if(maximum<64)return null;
  const key=['jacket','inserts','pants','pantsInserts'][values.indexOf(maximum)];
  if(key==='pantsInserts'&&state.pantsMode==='plain'&&!isLogo(p,width,true))return 'pants';
  if(key==='pants'||key==='pantsInserts')return key;
  if(key==='inserts'&&(state.topMode==='inserts'||isLogo(p,width)))return 'inserts';
  if(state.topMode==='print'&&pattern){
    const values=[pattern.data[p],pattern.data[p+1],pattern.data[p+2],pattern.extra?.[p]||0,pattern.extra?.[p+1]||0],max=Math.max(...values);
    if(max>110)return PRINT_KEYS[values.indexOf(max)];
  }
  return 'jacket';
}
