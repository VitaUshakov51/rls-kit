// Exactly two material colors. Kit markings and patterns are never accepted.
export const SUIT_DEFAULTS=Object.freeze({main:'#191d24',secondary:'#00b9f4'});
export function normalizeSuitState(value){
  const state={...SUIT_DEFAULTS};
  for(const key of Object.keys(state))if(/^#[0-9a-f]{6}$/i.test(value?.[key]||''))state[key]=value[key].toLowerCase();
  // Canonicalize the old default black to the same black used by the palette.
  for(const key of Object.keys(state))if(state[key]==='#191919')state[key]='#191d24';
  return state;
}
export function suitAsset(name,{preview=false}={}){
  const file=name==='model'?(preview?'preview.webp':'model.webp'):name==='poster'?(preview?'preview-poster.webp':'poster.webp'):(preview?'preview-materials.png':'materials.png');
  return 'assets/suit/'+file+'?v=14';
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const byte=value=>Math.max(0,Math.min(255,Math.round(value)));
export function renderSuitPixels(source,materials,value,output=new Uint8ClampedArray(source.length)){
  const state=normalizeSuitState(value),main=rgb(state.main),accent=rgb(state.secondary);
  output.set(source);
  // Both fabrics use one neutral lighting map with the same midtone. Equal
  // RGB choices therefore have equal shades, independent of the photo's
  // original black/cyan dyes. The underlay contains only fixed hardware,
  // lining and shoes on white, so partial masks cannot reveal old colors.
  for(let p=0;p<source.length;p+=4){
    const m=materials[p]/255,a=materials[p+1]/255;
    if(!m&&!a)continue;
    const weight=Math.min(1,m+a),shade=materials[p+2]/235;
    for(let c=0;c<3;c++){
      output[p+c]=byte(source[p+c]*(1-weight)+(main[c]*m+accent[c]*a)*shade);
    }
  }
  return output;
}
export function suitSelectionAt(materials,width,height,x,y){
  if(x<0||y<0||x>=width||y>=height)return null;
  const p=(Math.floor(y)*width+Math.floor(x))*4;
  if(Math.max(materials[p],materials[p+1])<64)return null;
  return materials[p+1]>materials[p]?'secondary':'main';
}
