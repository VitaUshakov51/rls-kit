import {PATTERNS,PRINT_KEYS,patternAsset,canPrintSleeves} from './renderer.js?v=24';
export const TRAINING_COLOR_KEYS=Object.freeze(['jacket','inserts','pants','pantsInserts',...PRINT_KEYS]);
export const TRAINING_DEFAULTS=Object.freeze({jacket:'#bfc1c4',inserts:'#191d24',pants:'#191d24',pantsInserts:'#bfc1c4',designMode:'inserts',pattern:'original',print:'#c2c2c2',printSecondary:'#262626',printTertiary:'#9b9424',printFourth:'#fffcdb',printFifth:'#d9dadb'});
export function normalizeTrainingState(value){
  const result={...TRAINING_DEFAULTS};
  for(const key of TRAINING_COLOR_KEYS)if(/^#[0-9a-f]{6}$/i.test(value?.[key]||''))result[key]=value[key].toLowerCase();
  if(!/^#[0-9a-f]{6}$/i.test(value?.pantsInserts||''))result.pantsInserts=result.jacket;
  for(const key of ['jacket','inserts','pants','pantsInserts'])if(result[key]==='#191919')result[key]='#191d24';
  result.designMode=value?.designMode==='print'?'print':'inserts';
  if(PATTERNS.some(p=>p.id===value?.pattern))result.pattern=value.pattern;
  return result;
}
export function trainingAsset(name,{preview=false}={}){
  const file=name==='model'?(preview?'preview.webp':'model.webp'):(preview?'preview-':'')+name+(name==='poster'||preview?'.webp':'.png');
  return 'assets/training/'+file+'?v=20';
}
export function trainingPatternAsset(id,{preview=false,extra=false}={}){
  if(id==='original')return 'assets/'+(preview?'preview/':'')+'training-original-print.png?v=24';
  return patternAsset(id,{preview,extra,bitmap:true});
}
// Map artwork separately onto the jacket and trousers. Actual material masks
// clip every painted pixel to this model, including its inserts and logos.
export function mapTrainingPattern(plate,width,height,id){
  const result={data:new Uint8ClampedArray(width*height*4)};
  if(plate.extra)result.extra=new Uint8ClampedArray(width*height*4);
  const inputs=plate.extra?[plate.data,plate.extra]:[plate.data],outputs=plate.extra?[result.data,result.extra]:[result.data];
  const sleeves=canPrintSleeves(id),scale=1086/width,textureScale=plate.width/1086;
  for(let y=0;y<height;y++){
    const my=(y+.5)*scale,pants=my>=610;
    if(my<95||my>1270)continue;
    const v=(pants?110+(my-610)*500/660:110+(my-100)*500/510)*textureScale-.5;
    const y0=Math.max(0,Math.min(plate.height-1,Math.floor(v))),y1=Math.min(plate.height-1,y0+1),fy=Math.max(0,v-y0);
    for(let x=0;x<width;x++){
      const mx=(x+.5)*scale,back=mx>=550,center=back?800:310;
      if(pants&&Math.abs(mx-center)>185)continue;
      if(!pants&&!sleeves&&Math.abs(mx-center)>(my<170?106+(my-95)*.48:142+(Math.min(my,330)-170)*.1))continue;
      const u=((back?793:293)+(mx-center)*300/(pants?350:370))*textureScale-.5;
      if(u<0||u>=plate.width-1)continue;
      const x0=Math.floor(u),x1=x0+1,fx=u-x0,p=(y*width+x)*4;
      const q00=(y0*plate.width+x0)*4,q01=(y0*plate.width+x1)*4,q10=(y1*plate.width+x0)*4,q11=(y1*plate.width+x1)*4;
      const w00=(1-fx)*(1-fy),w01=fx*(1-fy),w10=(1-fx)*fy,w11=fx*fy;
      for(let i=0;i<inputs.length;i++){
        const input=inputs[i],output=outputs[i];
        for(let c=0;c<3;c++)output[p+c]=input[q00+c]*w00+input[q01+c]*w01+input[q10+c]*w10+input[q11+c]*w11;
        output[p+3]=255;
      }
    }
  }
  return result;
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const byte=value=>Math.max(0,Math.min(255,Math.round(value)));
export function renderTrainingPixels(source,materials,value,output=new Uint8ClampedArray(source.length),lighting,pantsInserts,pattern){
  const state=normalizeTrainingState(value),colors=['jacket','inserts','pants','pantsInserts'].map(key=>rgb(state[key]));
  const inks=PRINT_KEYS.map(key=>rgb(state[key])),printed=state.designMode==='print'&&state.pattern!=='none'&&pattern?.data;
  output.set(source);
  for(let p=0;p<source.length;p+=4){
    const a=materials[p]/255,b=materials[p+1]/255,c=materials[p+2]/255,d=pantsInserts[p]/255,weight=Math.min(1,a+b+c+d);
    if(!weight)continue;
    const shade=lighting[p]/235;
    const r=printed?pattern.data[p]/255:0,g=printed?pattern.data[p+1]/255:0,bp=printed?pattern.data[p+2]/255:0;
    const e0=printed?(pattern.extra?.[p]||0)/255:0,e1=printed?(pattern.extra?.[p+1]||0)/255:0;
    const baseWeight=Math.max(0,1-r-g-bp-e0-e1);
    for(let k=0;k<3;k++){
      const printColor=r*inks[0][k]+g*inks[1][k]+bp*inks[2][k]+e0*inks[3][k]+e1*inks[4][k];
      const jacket=colors[0][k]*baseWeight+printColor,pants=colors[2][k]*baseWeight+printColor;
      output[p+k]=byte(source[p+k]*(1-weight)+(jacket*a+colors[1][k]*b+pants*c+colors[3][k]*d)*shade);
    }
  }
  return output;
}
export function trainingSelectionAt(materials,width,height,x,y,pantsInserts){
  if(x<0||y<0||x>=width||y>=height)return null;
  const p=(Math.floor(y)*width+Math.floor(x))*4,values=[materials[p],materials[p+1],materials[p+2],pantsInserts[p]],maximum=Math.max(...values);
  if(maximum<64)return null;
  return ['jacket','inserts','pants','pantsInserts'][values.indexOf(maximum)];
}
