import {createRenderer} from './renderer.js?v=24';
let renderer,pattern=null,patternId=null;
globalThis.onmessage=event=>{
  const message=event.data;
  try{
    if(message.type==='init'){
      const m=message.model;renderer=createRenderer(m.source,m.atlas,m.width,m.height,m.ink,{outlines:m.outlines,rearFabric:m.rearFabric,printArea:m.printArea});
      globalThis.postMessage({type:'ready'});return;
    }
    if(message.type==='render'){
      if(message.patternId!==patternId){pattern=message.pattern||null;patternId=message.patternId;}
      const start=performance.now(),{pixels,processedPixels}=renderer.render(message.state,pattern);
      const result=message.recycle?new Uint8ClampedArray(message.recycle):new Uint8ClampedArray(pixels.length);result.set(pixels);
      globalThis.postMessage({type:'frame',id:message.id,buffer:result.buffer,processedPixels,renderMs:performance.now()-start},[result.buffer]);
    }
  }catch(error){globalThis.postMessage({type:'error',id:message.id,message:error.message});}
};
