import {renderTrainingPixels,trainingAsset,trainingPatternAsset,mapTrainingPattern} from './training-renderer.js?v=24';
import {PATTERNS} from './renderer.js?v=24';
let model,frame,pattern=null;
async function decode(name,url=trainingAsset(name)){
  const response=await fetch(url);if(!response.ok)throw new Error('Training asset unavailable');
  const bitmap=await createImageBitmap(await response.blob()),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);bitmap.close();const result={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};canvas.width=canvas.height=1;return result;
}
globalThis.onmessage=async({data:message})=>{
  try{
    if(message.type==='init'){model=message.model;frame=null;globalThis.postMessage({type:'ready'});return;}
    if(message.type==='render'){
      if('pattern' in message)pattern=message.pattern;
      frame=message.recycle?new Uint8ClampedArray(message.recycle):new Uint8ClampedArray(model.source.length);
      renderTrainingPixels(model.source,model.materials,message.state,frame,model.lighting,model.extraMask,pattern);
      const buffer=frame.buffer;frame=null;globalThis.postMessage({type:'frame',id:message.id,buffer},[buffer]);return;
    }
    if(message.type==='export'){
      const [source,materials,lighting,inserts]=await Promise.all(['model','materials','lighting','pants-inserts'].map(name=>decode(name)));
      let artwork=null;
      if(message.state.designMode==='print'&&message.state.pattern!=='none'){
        const plate=await decode(null,trainingPatternAsset(message.state.pattern));
        if((PATTERNS.find(p=>p.id===message.state.pattern)?.colors?.length||0)>3)plate.extra=(await decode(null,trainingPatternAsset(message.state.pattern,{extra:true}))).data;
        artwork=mapTrainingPattern(plate,source.width,source.height,message.state.pattern);
      }
      const pixels=renderTrainingPixels(source.data,materials.data,message.state,undefined,lighting.data,inserts.data,artwork);
      const native=new OffscreenCanvas(source.width,source.height),nativeCtx=native.getContext('2d',{alpha:false});
      nativeCtx.putImageData(new ImageData(pixels,source.width,source.height),0,0);
      const canvas=new OffscreenCanvas(2160,2880),ctx=canvas.getContext('2d',{alpha:false});
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(native,0,0,2160,2880);
      const blob=await canvas.convertToBlob({type:'image/png'});native.width=native.height=canvas.width=canvas.height=1;
      globalThis.postMessage({type:'complete',blob});
    }
  }catch(error){globalThis.postMessage({type:'error',message:error.message});}
};
