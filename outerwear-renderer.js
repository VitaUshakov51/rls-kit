export const OUTERWEAR=Object.freeze({
  windbreaker:{title:'Ветровка',storage:'rls-windbreaker-v1',filename:'RLS-vetrovka.png',defaults:{main:'#269665',inserts:'#191d24'},parts:[['main','Основной цвет','Основной цвет ветровки'],['inserts','Вставки и логотип','Цвет вставок и логотипа']]},
  winter:{title:'Зимняя куртка',storage:'rls-winter-v1',filename:'RLS-zimnyaya-kurtka.png',defaults:{main:'#e33843',secondary:'#191d24',logo:'#ffffff'},parts:[['main','Основной цвет','Основной цвет куртки'],['secondary','Второй цвет','Второй цвет куртки'],['logo','Логотип','Цвет логотипа']]}
});
export function normalizeOuterwearState(id,value){
  const result={...OUTERWEAR[id].defaults};
  for(const key of Object.keys(result))if(/^#[0-9a-f]{6}$/i.test(value?.[key]||''))result[key]=value[key].toLowerCase();
  for(const key of Object.keys(result))if(result[key]==='#191919')result[key]='#191d24';
  return result;
}
export function outerwearAsset(id,name,{preview=false}={}){
  const file=name==='model'?(preview?'preview.webp':'model.webp'):(preview?'preview-':'')+name+(name==='poster'||preview?'.webp':'.png');
  return 'assets/'+id+'/'+file+'?v=20';
}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export function renderOuterwearPixels(id,source,materials,value,output=new Uint8ClampedArray(source.length),lighting){
  const state=normalizeOuterwearState(id,value),colors=Object.values(state).map(rgb);
  while(colors.length<3)colors.push([0,0,0]);
  output.set(source);
  for(let p=0;p<source.length;p+=4){
    const a=materials[p]/255,b=materials[p+1]/255,c=materials[p+2]/255,weight=Math.min(1,a+b+c);
    if(!weight)continue;
    const shade=lighting[p]/235;
    for(let k=0;k<3;k++)output[p+k]=Math.max(0,Math.min(255,Math.round(source[p+k]*(1-weight)+(colors[0][k]*a+colors[1][k]*b+colors[2][k]*c)*shade)));
  }
  return output;
}
export function outerwearSelectionAt(id,materials,width,height,x,y){
  if(x<0||y<0||x>=width||y>=height)return null;
  const p=(Math.floor(y)*width+Math.floor(x))*4,keys=Object.keys(OUTERWEAR[id].defaults),values=keys.map((_,i)=>materials[p+i]),maximum=Math.max(...values);
  return maximum>=64?keys[values.indexOf(maximum)]:null;
}
export function createOuterwearConfig(id){
  return {asset:(name,options)=>outerwearAsset(id,name,options),normalize:value=>normalizeOuterwearState(id,value),render:(source,materials,value,output,lighting)=>renderOuterwearPixels(id,source,materials,value,output,lighting),pick:(materials,width,height,x,y)=>outerwearSelectionAt(id,materials,width,height,x,y),workerURL:new URL('./'+id+'-worker.js?v=20',import.meta.url),lighting:true};
}
