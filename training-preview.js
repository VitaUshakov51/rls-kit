import {normalizeTrainingState,renderTrainingPixels,trainingSelectionAt,trainingAsset,trainingPatternAsset} from './training-renderer.js?v=22t2';
import {PATTERNS} from './renderer.js?v=22p2';
import {createAssetCache} from './asset-cache.js?v=8';
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Training image unavailable'));image.src=url;});}
async function decode(url){
  const image=await loadImage(url),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const result={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};canvas.width=canvas.height=1;return result;
}
async function loadModel(preview){
  const [source,materials,lighting,inserts]=await Promise.all(['model','materials','lighting','pants-inserts'].map(name=>decode(trainingAsset(name,{preview}))));
  return {source:source.data,materials:materials.data,lighting:lighting.data,extraMask:inserts.data,width:source.width,height:source.height};
}
async function loadPattern(id,preview){
  const material={data:(await decode(trainingPatternAsset(id,{preview}))).data};
  if((PATTERNS.find(p=>p.id===id)?.colors?.length||0)>3)material.extra=(await decode(trainingPatternAsset(id,{preview,extra:true}))).data;
  return material;
}
export function createTrainingPreview(canvas,onPaint,onError){
  const ctx=canvas.getContext('2d',{alpha:false});
  let promise,model,worker,pending,recycleBuffer,busy=false,revision=0,latest,latestMaterial=null,output,workerPatternId;
  const patterns=createAssetCache(id=>loadPattern(id,true),{limit:2,protectedKey:()=>latest?.pattern});
  function paint(pixels,id){if(id!==revision)return;ctx.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);onPaint();}
  function renderFallback(){paint(renderTrainingPixels(model.source,model.materials,latest,output,model.lighting,model.extraMask,latestMaterial,model.width),revision);}
  function dispatch(){
    if(!pending||busy||!worker)return;
    const current=pending,message={type:'render',id:current.id,state:current.state},transfer=[];pending=null;busy=true;
    if(recycleBuffer){message.recycle=recycleBuffer;transfer.push(recycleBuffer);recycleBuffer=null;}
    const key=current.state.topMode==='print'?current.state.pattern:'none';
    if(workerPatternId!==key){
      message.pattern=null;
      if(current.material){message.pattern={};for(const name of ['data','extra'])if(current.material[name]){const copy=current.material[name].slice();message.pattern[name]=copy;transfer.push(copy.buffer);}}
      workerPatternId=key;
    }
    worker.postMessage(message,transfer);
  }
  function fallback(){worker?.terminate();worker=null;busy=false;pending=null;recycleBuffer=null;workerPatternId=null;if(model&&latest)renderFallback();}
  return {
    preparePattern(id){return patterns.request(id);},
    async load(){
      if(!promise)promise=(async()=>{
        model=await loadModel(true);canvas.width=model.width;canvas.height=model.height;output=new Uint8ClampedArray(model.source.length);
        if(typeof Worker==='function'){
          try{
            worker=new Worker(new URL('./training-worker.js?v=22t2',import.meta.url),{type:'module'});
            await new Promise((resolve,reject)=>{
              const timeout=setTimeout(()=>reject(new Error('Use compatible preview')),4000);
              worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Use compatible preview'));};
              worker.onmessage=({data})=>{clearTimeout(timeout);data.type==='ready'?resolve():reject(new Error('Use compatible preview'));};
              worker.postMessage({type:'init',model});
            });
            worker.onmessage=({data})=>{if(data.type==='error'){fallback();return;}if(data.type!=='frame')return;busy=false;paint(new Uint8ClampedArray(data.buffer),data.id);recycleBuffer=data.buffer;dispatch();};
            worker.onerror=fallback;
          }catch{worker?.terminate();worker=null;}
        }
        return model;
      })().catch(error=>{promise=null;throw error;});
      return promise;
    },
    render(value){
      latest=normalizeTrainingState(value);const id=++revision,snapshot=latest;
      if(!model)return;
      const material=snapshot.topMode==='print'?patterns.request(snapshot.pattern):Promise.resolve(null);
      material.then(plate=>{
        if(id!==revision)return;latestMaterial=plate;
        if(worker){pending={id,state:snapshot,material:plate};dispatch();}else renderFallback();
      }).catch(()=>{if(id===revision)onError?.('Принт не загрузился. Попробуйте выбрать его ещё раз.');});
    },
    pick(x,y){return model?trainingSelectionAt(model.materials,model.width,model.height,x,y,model.extraMask,latest,latestMaterial):null;},
    async export(value){
      const snapshot=normalizeTrainingState(value);
      if(typeof Worker==='function'){
        let exporter;
        try{
          exporter=new Worker(new URL('./training-worker.js?v=22t2',import.meta.url),{type:'module'});
          return await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>reject(new Error('Use compatible export')),20000);
            exporter.onmessage=({data})=>{clearTimeout(timeout);data.type==='complete'?resolve(data.blob):reject(new Error('Use compatible export'));};
            exporter.onerror=()=>{clearTimeout(timeout);reject(new Error('Use compatible export'));};exporter.postMessage({type:'export',state:snapshot});
          });
        }catch{}finally{exporter?.terminate();}
      }
      const [full,material]=await Promise.all([loadModel(false),snapshot.topMode==='print'?loadPattern(snapshot.pattern,false):null]);
      const native=document.createElement('canvas');native.width=full.width;native.height=full.height;
      native.getContext('2d',{alpha:false}).putImageData(new ImageData(renderTrainingPixels(full.source,full.materials,snapshot,undefined,full.lighting,full.extraMask,material,full.width),full.width,full.height),0,0);
      const canvas=document.createElement('canvas');canvas.width=2160;canvas.height=2880;const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingQuality='high';ctx.drawImage(native,0,0,2160,2880);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));native.width=native.height=canvas.width=canvas.height=1;return blob;
    }
  };
}
