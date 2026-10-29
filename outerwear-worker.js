import {outerwearAsset,renderOuterwearPixels} from './outerwear-renderer.js?v=20';
export function startOuterwearWorker(id){
  let model,frame;
  async function decode(name){
    const response=await fetch(outerwearAsset(id,name));if(!response.ok)throw new Error('Model asset unavailable');
    const bitmap=await createImageBitmap(await response.blob()),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0);bitmap.close();const result={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};canvas.width=canvas.height=1;return result;
  }
  globalThis.onmessage=async({data:message})=>{
    try{
      if(message.type==='init'){model=message.model;frame=null;globalThis.postMessage({type:'ready'});return;}
      if(message.type==='render'){
        frame=message.recycle?new Uint8ClampedArray(message.recycle):new Uint8ClampedArray(model.source.length);
        renderOuterwearPixels(id,model.source,model.materials,message.state,frame,model.lighting);
        const buffer=frame.buffer;frame=null;globalThis.postMessage({type:'frame',id:message.id,buffer},[buffer]);return;
      }
      if(message.type==='export'){
        const [source,materials,lighting]=await Promise.all(['model','materials','lighting'].map(decode));
        const pixels=renderOuterwearPixels(id,source.data,materials.data,message.state,undefined,lighting.data);
        const native=new OffscreenCanvas(source.width,source.height);native.getContext('2d',{alpha:false}).putImageData(new ImageData(pixels,source.width,source.height),0,0);
        const canvas=new OffscreenCanvas(2160,2880),ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(native,0,0,2160,2880);
        const blob=await canvas.convertToBlob({type:'image/png'});native.width=native.height=canvas.width=canvas.height=1;globalThis.postMessage({type:'complete',blob});
      }
    }catch(error){globalThis.postMessage({type:'error',message:error.message});}
  };
}
