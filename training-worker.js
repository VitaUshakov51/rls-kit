import {renderTrainingPixels,trainingAsset,trainingPatternAsset} from './training-renderer.js?v=22t2';
import {PATTERNS} from './renderer.js?v=22p2';
let model,frame,pattern=null;
async function decode(url){
  const response=await fetch(url);if(!response.ok)throw new Error('Training asset unavailable');
  const bitmap=await createImageBitmap(await response.blob()),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);bitmap.close();const result={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};canvas.width=canvas.height=1;return result;
}
async function loadPattern(state){
  if(state.topMode!=='print')return null;
  const material={data:(await decode(trainingPatternAsset(state.pattern))).data};
  if((PATTERNS.find(p=>p.id===state.pattern)?.colors?.length||0)>3)material.extra=(await decode(trainingPatternAsset(state.pattern,{extra:true}))).data;
  return material;
}
globalThis.onmessage=async({data:message})=>{
  try{
    if(message.type==='init'){model=message.model;frame=null;pattern=null;globalThis.postMessage({type:'ready'});return;}
    if(message.type==='render'){
      if('pattern' in message)pattern=message.pattern;
      frame=message.recycle?new Uint8ClampedArray(message.recycle):new Uint8ClampedArray(model.source.length);
      renderTrainingPixels(model.source,model.materials,message.state,frame,model.lighting,model.extraMask,pattern,model.width);
      const buffer=frame.buffer;frame=null;globalThis.postMessage({type:'frame',id:message.id,buffer},[buffer]);return;
    }
    if(message.type==='export'){
      const [layers,material]=await Promise.all([Promise.all(['model','materials','lighting','pants-inserts'].map(name=>decode(trainingAsset(name)))),loadPattern(message.state)]);
      const [source,materials,lighting,inserts]=layers,pixels=renderTrainingPixels(source.data,materials.data,message.state,undefined,lighting.data,inserts.data,material,source.width);
      const native=new OffscreenCanvas(source.width,source.height),nativeCtx=native.getContext('2d',{alpha:false});nativeCtx.putImageData(new ImageData(pixels,source.width,source.height),0,0);
      const canvas=new OffscreenCanvas(2160,2880),ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(native,0,0,2160,2880);
      const blob=await canvas.convertToBlob({type:'image/png'});native.width=native.height=canvas.width=canvas.height=1;globalThis.postMessage({type:'complete',blob});
    }
  }catch(error){globalThis.postMessage({type:'error',message:error.message});}
};
