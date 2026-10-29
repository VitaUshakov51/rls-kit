import {renderPixels,normalizeState,patternAsset,shortsPatternAsset,PATTERNS,modelAsset} from './renderer.js?v=22p1';
import {drawSurname} from './surname.js?v=8';
import {drawBoots,BOOT_PLACEMENTS} from './boots.js?v=8';
async function image(url){
  const response=await fetch(url);if(!response.ok)throw new Error('Asset unavailable');
  return createImageBitmap(await response.blob());
}
async function pixels(url,width=2160,height=2880){
  const bitmap=await image(url);
  const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0);bitmap.close();const data=ctx.getImageData(0,0,width,height).data;canvas.width=canvas.height=1;return data;
}
globalThis.onmessage=async event=>{
  try{
    if(typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function')throw new Error('Use compatible export');
    const state=normalizeState(event.data.state),model={};
    if(state.surnameEnabled&&(typeof FontFace!=='function'||!globalThis.fonts))throw new Error('Use compatible font export');
    let bitmapOnly=false;
    if(PATTERNS.find(p=>p.id===state.pattern)?.vector){
      try{const probe=await createImageBitmap(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>'],{type:'image/svg+xml'}));probe.close();}
      catch{bitmapOnly=true;}
    }
    // Decode one full-sized map at a time to limit temporary canvas memory.
    for(const name of ['kit','zones','coverage','ink','outlines','rear-fabric'])model[name]=await pixels(modelAsset(name));
    for(let p=0;p<model.zones.length;p+=4)model.zones[p+3]=model.coverage[p];model.coverage=null;
    let pattern=null;
    if(!['none','original'].includes(state.pattern)){
      const decode=extra=>pixels(patternAsset(state.pattern,{extra,bitmap:bitmapOnly})).catch(()=>pixels(patternAsset(state.pattern,{extra,bitmap:true})));
      const data=await decode(false);pattern=PATTERNS.find(p=>p.id===state.pattern).colors.length>3?{data,extra:await decode(true)}:data;
    }
    if(state.shortsPrintEnabled){
      if(!pattern?.data)pattern={data:pattern};
      pattern.shorts={data:await pixels(shortsPatternAsset(state.pattern),2160,768),offsetY:1152};
      if((PATTERNS.find(p=>p.id===state.pattern)?.colors?.length||0)>3)pattern.shorts.extra=await pixels(shortsPatternAsset(state.pattern,{extra:true}),2160,768);
    }
    if(state.surnameEnabled){
      if(typeof FontFace!=='function'||!globalThis.fonts)throw new Error('Use compatible font export');
      const font=await new FontFace('KitName',"url('assets/name-font.woff2?v=8')",{weight:'400'}).load();globalThis.fonts.add(font);
    }
    const output=renderPixels(model.kit,model.zones,2160,2880,state,model.ink,undefined,{pattern,outlines:model.outlines,rearFabric:model['rear-fabric']});
    for(const key of Object.keys(model))model[key]=null;
    const canvas=new OffscreenCanvas(2160,2880),ctx=canvas.getContext('2d',{alpha:false});ctx.putImageData(new ImageData(output,2160,2880),0,0);
    drawSurname(ctx,state,2160);
    const boots={};for(const {id} of BOOT_PLACEMENTS)boots[id]=await image('assets/boots/'+id+'.png?v=8');drawBoots(ctx,2160,boots);for(const bitmap of Object.values(boots))bitmap.close();
    const blob=await canvas.convertToBlob({type:'image/png'});canvas.width=canvas.height=1;
    globalThis.postMessage({type:'complete',blob});
  }catch(error){globalThis.postMessage({type:'error',message:error.message});}
};
