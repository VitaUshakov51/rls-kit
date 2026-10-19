import {renderSuitPixels,suitAsset} from './suit-renderer.js?v=14';
let model,frame;
async function decode(name){
  const response=await fetch(suitAsset(name));if(!response.ok)throw new Error('Suit asset unavailable');
  const bitmap=await createImageBitmap(await response.blob()),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);bitmap.close();const result={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};canvas.width=canvas.height=1;return result;
}
globalThis.onmessage=async({data:message})=>{
  try{
    if(message.type==='init'){model=message.model;frame=new Uint8ClampedArray(model.source.length);globalThis.postMessage({type:'ready'});return;}
    if(message.type==='render'){
      renderSuitPixels(model.source,model.materials,message.state,frame);
      const copy=frame.slice();globalThis.postMessage({type:'frame',id:message.id,buffer:copy.buffer},[copy.buffer]);return;
    }
    if(message.type==='export'){
      const source=await decode('model'),materials=await decode('materials');
      const pixels=renderSuitPixels(source.data,materials.data,message.state);
      const native=new OffscreenCanvas(source.width,source.height),nativeCtx=native.getContext('2d',{alpha:false});
      nativeCtx.putImageData(new ImageData(pixels,source.width,source.height),0,0);
      const canvas=new OffscreenCanvas(2160,2880),ctx=canvas.getContext('2d',{alpha:false});
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(native,0,0,2160,2880);
      const blob=await canvas.convertToBlob({type:'image/png'});native.width=native.height=canvas.width=canvas.height=1;
      globalThis.postMessage({type:'complete',blob});
    }
  }catch(error){globalThis.postMessage({type:'error',message:error.message});}
};
