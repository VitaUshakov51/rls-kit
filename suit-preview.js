import {normalizeSuitState,renderSuitPixels,suitSelectionAt,suitAsset} from './suit-renderer.js?v=14';
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});}
async function loadModel(preview,config){
  const names=config.lighting?['model','materials','lighting']:['model','materials'];
  if(config.extraAsset)names.push(config.extraAsset);
  const images=await Promise.all(names.map(name=>loadImage(config.asset(name,{preview}))));
  const width=images[0].naturalWidth,height=images[0].naturalHeight;
  const data=images.map(image=>{const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const result=ctx.getImageData(0,0,width,height).data;c.width=c.height=1;return result;});
  return {source:data[0],materials:data[1],lighting:config.lighting?data[2]:undefined,extraMask:config.extraAsset?data.at(-1):undefined,width,height};
}
export function createSuitPreview(canvas,onPaint,options={}){
  const config={asset:suitAsset,normalize:normalizeSuitState,render:renderSuitPixels,pick:suitSelectionAt,workerURL:new URL('./suit-worker.js?v=14',import.meta.url),...options};
  const ctx=canvas.getContext('2d',{alpha:false});
  let promise,model,worker,pending,busy=false,revision=0,latest,output;
  function paint(pixels,id){if(id!==revision)return;ctx.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);onPaint();}
  function dispatch(){
    if(!pending||busy||!worker)return;
    const message=pending;pending=null;busy=true;worker.postMessage(message);
  }
  function fallback(){worker?.terminate();worker=null;busy=false;pending=null;if(model&&latest)paint(config.render(model.source,model.materials,latest,output,model.lighting,model.extraMask),revision);}
  return {
    async load(){
      if(!promise)promise=(async()=>{
        model=await loadModel(true,config);canvas.width=model.width;canvas.height=model.height;output=new Uint8ClampedArray(model.source.length);
        if(typeof Worker==='function'){
          try{
            worker=new Worker(config.workerURL,{type:'module'});
            await new Promise((resolve,reject)=>{
              const timeout=setTimeout(()=>reject(new Error('Use compatible preview')),4000);
              worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Use compatible preview'));};
              worker.onmessage=({data})=>{clearTimeout(timeout);data.type==='ready'?resolve():reject(new Error('Use compatible preview'));};
              worker.postMessage({type:'init',model});
            });
            worker.onmessage=({data})=>{if(data.type==='error'){fallback();return;}if(data.type!=='frame')return;busy=false;paint(new Uint8ClampedArray(data.buffer),data.id);dispatch();};
            worker.onerror=fallback;
          }catch{worker?.terminate();worker=null;}
        }
        return model;
      })().catch(error=>{promise=null;throw error;});
      return promise;
    },
    render(value){
      latest=config.normalize(value);revision++;
      if(!model)return;
      if(worker){pending={type:'render',id:revision,state:latest};dispatch();}
      else paint(config.render(model.source,model.materials,latest,output,model.lighting,model.extraMask),revision);
    },
    pick(x,y){return model?config.pick(model.materials,model.width,model.height,x,y,model.extraMask):null;},
    async export(value){
      const snapshot=config.normalize(value);
      if(typeof Worker==='function'){
        let exporter;
        try{
          exporter=new Worker(config.workerURL,{type:'module'});
          return await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(new Error('Use compatible export')),20000);
            exporter.onmessage=({data})=>{clearTimeout(timeout);data.type==='complete'?resolve(data.blob):reject(new Error('Use compatible export'));};
            exporter.onerror=()=>{clearTimeout(timeout);reject(new Error('Use compatible export'));};
            exporter.postMessage({type:'export',state:snapshot});
          });
        }catch{}finally{exporter?.terminate();}
      }
      const full=await loadModel(false,config),native=document.createElement('canvas');native.width=full.width;native.height=full.height;
      native.getContext('2d',{alpha:false}).putImageData(new ImageData(config.render(full.source,full.materials,snapshot,undefined,full.lighting,full.extraMask),full.width,full.height),0,0);
      const canvas=document.createElement('canvas');canvas.width=2160;canvas.height=2880;const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingQuality='high';ctx.drawImage(native,0,0,2160,2880);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));native.width=native.height=canvas.width=canvas.height=1;return blob;
    }
  };
}
