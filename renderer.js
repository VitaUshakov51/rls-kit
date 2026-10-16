// Color rendering is separate from UI, so all views and exports use one model.
export const COLOR_KEYS = Object.freeze(['shirt','collar','cuffs','print','chestLogo','shorts','shortsNumber','shortsLogo','backNumber','backLogo','socks','printSecondary','surnameColor','printTertiary','printFourth','printFifth']);
export const PRINT_KEYS = Object.freeze(['print','printSecondary','printTertiary','printFourth','printFifth']);
export const OUTLINE_KEYS = Object.freeze(['chestLogo','shortsNumber','shortsLogo','backNumber','backLogo','surnameColor']);
export const PATTERNS = Object.freeze([
  {id:'original',name:'Текущий'}, {id:'none',name:'Без принта'},
  {id:'brush',name:'Мазки',secondary:true,colors:['#0b9c67','#015b3b'],base:'#01754b'}, {id:'dragon',name:'Дракон',secondary:true,colors:['#ff445a','#1a1a1a'],base:'#000000'},
  {id:'fingerprint',name:'Отпечатки',vector:true,colors:['#041d61'],base:'#ca1331'},
  {id:'lion',name:'Лев',vector:true,secondary:true,colors:['#eb262c','#000000'],base:'#000000'},
  {id:'geometry',name:'Геометрия',vector:true,secondary:true,colors:['#a60d43','#0c327a'],base:'#0c327a'}, {id:'speed',name:'Скорость',vector:true,secondary:true,tertiary:true,colors:['#9edbf4','#1e53bd','#ffffff','#fffcdb','#d9dadb'],base:'#003399'},
  {id:'camo',name:'Камуфляж',vector:true,secondary:true,tertiary:true,colors:['#838014','#b5ab24','#999122'],base:'#e3d400'}, {id:'graffiti',name:'Граффити',vector:true,secondary:true,tertiary:true,colors:['#f3e5ff','#b688db','#2e0054'],base:'#19002e'},
  {id:'slashes',name:'Диагонали',vector:true,secondary:true,tertiary:true,colors:['#565757','#931119','#333333'],base:'#000000'}, {id:'checker',name:'Клетка',colors:['#ad0c04'],base:'#dd0605'},
  {"id":"pink-angular","name":"Розовый импульс","vector":true,"secondary":true,"tertiary":true,"colors":["#ff1461","#868686","#000000","#131510"],"base":"#000000"},
  {"id":"barcode","name":"Вертикальные полосы","vector":true,"colors":["#000000"],"base":"#ad791b"},
  {"id":"gold-veins","name":"Золотые молнии","vector":true,"secondary":true,"tertiary":true,"colors":["#cf8d00","#6e6f70","#000000","#d18d00"],"base":"#ffffff"},
  {"id":"diagonal-halftone","name":"Диагональ","vector":true,"secondary":true,"tertiary":true,"colors":["#010000","#ffffff","#000000","#fefefe"],"base":"#ff0000"},
  {"id":"skyline","name":"Мегаполис","vector":true,"secondary":true,"tertiary":true,"colors":["#003399","#a0befa","#3a68c4","#000000","#ffffff"],"base":"#ffffff"},
  {"id":"red-lightning","name":"Красные молнии","vector":true,"secondary":true,"colors":["#e31e24","#ffffff"],"base":"#000000"},
  {"id":"teal-bars","name":"Бирюзовые штрихи","vector":true,"secondary":true,"tertiary":true,"colors":["#0f8185","#10595b","#ffffff"],"base":"#26a7ab"},
  {"id":"brush-strokes","name":"Кистевые полосы","vector":true,"colors":["#00553e"],"base":"#ffffff"}
]);
const SHIRT_ONLY_PATTERNS=new Set(['dragon','lion','geometry','speed','barcode','gold-veins','diagonal-halftone','skyline']);
export function canPrintShorts(id){
  return id!=='none'&&PATTERNS.some(p=>p.id===id)&&!SHIRT_ONLY_PATTERNS.has(id);
}
export function patternAsset(id,{preview=false,bitmap=false,extra=false}={}){
  // Preview bitmaps are rendered directly from the original curves at the
  // canvas resolution. Phones never need to parse the 419,075-point source.
  return 'assets/'+(preview?'preview/':'')+'patterns/'+id+(extra?'-extra':'')+'.'+(PATTERNS.find(p=>p.id===id)?.vector&&!preview&&!bitmap?'svg':'png')+'?v=8';
}
export function shortsPatternAsset(id,{preview=false,extra=false}={}){
  return 'assets/'+(preview?'preview/':'')+'short-patterns/'+id+(extra?'-extra':'')+'.png?v=8';
}
export function modelAsset(name,{preview=false}={}){
  const clean=['zones','coverage','ink','outlines'].includes(name);
  return 'assets/'+(preview?'preview/':'')+(clean?'clean/':'')+name+(name==='kit'&&preview?'.webp':'.png')+'?v='+(clean?(['zones','coverage'].includes(name)?'11':'10'):'8');
}
export function applyReferenceColors(value){
  const state=normalizeState(value),preset=PATTERNS.find(p=>p.id===state.pattern);
  if(preset?.colors){state.shirt=state.shorts=state.socks=preset.base;preset.colors.forEach((color,i)=>state[PRINT_KEYS[i]]=color);}
  return state;
}
const outlineDefaults = Object.freeze(Object.fromEntries(OUTLINE_KEYS.map(key=>[key,Object.freeze({enabled:false,color:'#ffffff'})])));
export const DEFAULTS = Object.freeze({
  shirt:'#ffffff', collar:'#003bb5', cuffs:'#003bb5', print:'#c2c2c2',
  chestLogo:'#003bb5', shorts:'#ffffff', shortsNumber:'#003bb5',
  shortsLogo:'#003bb5', backNumber:'#003bb5', backLogo:'#003bb5',
  socks:'#ffffff', pattern:'original', printSecondary:'#262626', printTertiary:'#9b9424', printFourth:'#fffcdb', printFifth:'#d9dadb', surnameColor:'#003bb5',
  surnameEnabled:false, surnameText:'', backLogoEnabled:false, shortsPrintEnabled:false, paletteVersion:7, outlines:outlineDefaults
});
export const REGION_KEYS = ['', 'shirt', 'collar', 'cuffs', 'chestLogo', 'shorts', 'shortsNumber', 'shortsLogo', 'backNumber', 'backLogo', 'socks'];
export function parseColor(value) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid color');
  return [1,3,5].map(i => parseInt(value.slice(i,i+2),16));
}
export function normalizeState(value) {
  const state = {...DEFAULTS,outlines:Object.fromEntries(OUTLINE_KEYS.map(key=>[key,{...outlineDefaults[key]}]))};
  if (!value || typeof value !== 'object') return state;
  for (const key of COLOR_KEYS) {
    if (/^#[0-9a-f]{6}$/i.test(value[key] || '')) state[key]=value[key].toLowerCase();
  }
  if (PATTERNS.some(p=>p.id===value.pattern)) state.pattern=value.pattern;
  state.surnameEnabled=value.surnameEnabled===true;
  state.backLogoEnabled=value.backLogoEnabled===true;
  state.shortsPrintEnabled=value.shortsPrintEnabled===true&&canPrintShorts(state.pattern);
  if(typeof value.surnameText==='string') state.surnameText=value.surnameText.replace(/[^\p{L}\p{N}\s'’-]/gu,'').replace(/\s+/g,' ').trim().slice(0,24);
  for(const key of OUTLINE_KEYS){
    const entry=value.outlines?.[key];
    if(entry&&typeof entry==='object'){
      state.outlines[key].enabled=entry.enabled===true;
      if(/^#[0-9a-f]{6}$/i.test(entry.color||''))state.outlines[key].color=entry.color.toLowerCase();
    }
  }
  return state;
}
export function restoreState(value){
  const state=normalizeState(value);
  const previous={geometry:['#0d3579','#a60c43'],speed:['#00349b','#efffff','#2054b9'],camo:['#e4d51d','#838212','#b4ac23','#9b9424'],graffiti:['#1a002e','#f5e5fc','#b78ddb','#2c0151'],slashes:['#000000','#5c5c5c','#931119']}[state.pattern];
  if(value&&Number(value.paletteVersion||0)<6&&previous){
    const preset=PATTERNS.find(p=>p.id===state.pattern);
    if(state.shirt===previous[0])state.shirt=preset.base;
    PRINT_KEYS.forEach((key,i)=>{if(preset.colors[i]&&(!value[key]||state[key]===previous[i+1]||i>=previous.length-1))state[key]=preset.colors[i];});
  }
  if(value&&Number(value.paletteVersion||0)<7&&state.pattern==='fingerprint'){
    if(state.shirt==='#ccffcc')state.shirt='#ca1331';
    if(state.print==='#99ff99')state.print='#041d61';
  }
  return state;
}
function inkSelection(pattern,p){
  const data=pattern?.data||pattern;
  if(data?.[p]>110)return 'print';if(data?.[p+1]>110)return 'printSecondary';if(data?.[p+2]>110)return 'printTertiary';
  if(pattern?.extra?.[p]>110)return 'printFourth';if(pattern?.extra?.[p+1]>110)return 'printFifth';return null;
}
export function selectionAt(atlas, width, height, x, y, state=null, layers={}) {
  if (x<0 || y<0 || x>=width || y>=height) return null;
  const p=(Math.floor(y)*width+Math.floor(x))*4;
  const outlined=layers.outlines?.[p];
  if(outlined&&(outlined!==9||state?.backLogoEnabled)&&layers.outlines[p+1]>110&&state?.outlines?.[REGION_KEYS[outlined]]?.enabled)return REGION_KEYS[outlined];
  const key=REGION_KEYS[atlas[p]===9&&state&&!state.backLogoEnabled?1:atlas[p]];
  if(key==='shorts'&&state?.shortsPrintEnabled&&canPrintShorts(state.pattern)&&layers.pattern?.shorts){
    return inkSelection(layers.pattern.shorts,p-layers.pattern.shorts.offsetY*width*4)||'shorts';
  }
  if(key==='shirt'&&state){
    if(state.pattern==='none')return 'shirt';
    if(state.pattern!=='original'){
      const pattern=layers.pattern?.data||layers.pattern;
      if(pattern?.[p]>110)return 'print';
      if(pattern?.[p+1]>110)return 'printSecondary';
      if(pattern?.[p+2]>110)return 'printTertiary';
      if(layers.pattern?.extra?.[p]>110)return 'printFourth';
      if(layers.pattern?.extra?.[p+1]>110)return 'printFifth';
      return 'shirt';
    }
  }
  const original=state&&!state.backLogoEnabled&&layers.rearFabric?.[p+2]>0?atlas[p+1]*(1-layers.rearFabric[p+2]/255)+layers.rearFabric[p]*layers.rearFabric[p+2]/255:atlas[p+1];
  return key === 'shirt' && original>110 ? 'print' : key || null;
}
export function createPicker(atlas,width,height,layers={}){
  const pixels=width*height,regions=new Uint8Array(pixels),flags=new Uint8Array(pixels),strokes=new Uint16Array(pixels);
  for(let i=0,p=0;i<pixels;i++,p+=4){
    regions[i]=atlas[p];const repair=(layers.rearFabric?.[p+2]||0)/255;
    const hidden=atlas[p+1]*(1-repair)+(layers.rearFabric?.[p]||0)*repair;
    flags[i]=(atlas[p+1]>110?1:0)|(hidden>110?2:0);
    if(layers.outlines?.[p+1]>110)strokes[i]=layers.outlines[p];
  }
  return (x,y,state,pattern)=>{
    if(x<0||y<0||x>=width||y>=height)return null;
    const i=Math.floor(y)*width+Math.floor(x),id=strokes[i];
    if(id&&(id!==9||state.backLogoEnabled)&&state.outlines?.[REGION_KEYS[id]]?.enabled)return REGION_KEYS[id];
    const key=REGION_KEYS[regions[i]===9&&!state.backLogoEnabled?1:regions[i]];
    if(key==='shorts'&&state.shortsPrintEnabled&&canPrintShorts(state.pattern)&&pattern?.shorts)return inkSelection(pattern.shorts,i*4-pattern.shorts.offsetY*width*4)||'shorts';
    if(key!=='shirt')return key||null;
    if(state.pattern==='none')return 'shirt';
    if(state.pattern==='original')return flags[i]&(state.backLogoEnabled?1:2)?'print':'shirt';
    const p=i*4,data=pattern?.data||pattern;if(data?.[p]>110)return 'print';if(data?.[p+1]>110)return 'printSecondary';if(data?.[p+2]>110)return 'printTertiary';if(pattern?.extra?.[p]>110)return 'printFourth';if(pattern?.extra?.[p+1]>110)return 'printFifth';return 'shirt';
  };
}
const clamp = value => Math.max(0,Math.min(255,Math.round(value)));
export function renderPixels(source, atlas, width, height, state, inkMask, output=new Uint8ClampedArray(source.length), layers={}) {
  const colors = Object.fromEntries(COLOR_KEYS.map(k=>[k,parseColor(state[k]||DEFAULTS[k])]));
  const patternPlate=layers.pattern?.data||layers.pattern,patternExtra=layers.pattern?.extra, stroke=layers.outlines, rearFabric=state.backLogoEnabled?null:layers.rearFabric;
  const shortsMaterial=state.shortsPrintEnabled&&canPrintShorts(state.pattern)?layers.pattern?.shorts:null;
  const shortsOffset=(shortsMaterial?.offsetY||0)*width*4;
  const borders=Object.fromEntries([4,6,7,8,9].map(id=>{const o=state.outlines?.[REGION_KEYS[id]];return [id,o?.enabled&&(id!==9||state.backLogoEnabled)?parseColor(o.color):null];}));
  const indices=layers.indices,count=indices?indices.length:source.length/4;
  const exclusive=state.pattern!=='original'&&state.pattern!=='none';
  const hasTertiary=PATTERNS.find(item=>item.id===state.pattern)?.tertiary;
  for (let i=0; i<count; i++) {
    const p=indices?indices[i]:i*4;
    const region=atlas[p], coverage=atlas[p+3]/255;
    output[p]=source[p]; output[p+1]=source[p+1]; output[p+2]=source[p+2]; output[p+3]=255;
    if (!region || !coverage) continue;
    const trim=region===2||region===3;
    const marked=trim||region===4||region===6||region===7||region===8||(region===9&&state.backLogoEnabled);
    const shirt=region===1 || trim || region===4 || region===8 || region===9;
    const key=REGION_KEYS[region];
    const base=colors[shirt?'shirt':(region===6||region===7)?'shorts':key];
    const repair=rearFabric?rearFabric[p+2]/255:0;
    const shade=Math.min(1,Math.max(.25,(atlas[p+2]*(1-repair)+(rearFabric?.[p+1]||0)*repair)/245));
    const pants=shortsMaterial&&(region===5||region===6||region===7),q=pants?p-shortsOffset:p;
    const plate=pants?shortsMaterial.data:shirt?patternPlate:null,extra=pants?shortsMaterial.extra:shirt?patternExtra:null;
    const pattern=shirt&&state.pattern==='original'?(atlas[p+1]*(1-repair)+(rearFabric?.[p]||0)*repair)/255:(pants||shirt&&exclusive)&&plate?(plate[q]||0)/255:0;
    const secondary=(exclusive||pants)&&plate?(plate[q+1]||0)/255:0;
    const tertiary=(exclusive||pants)&&plate&&hasTertiary?(plate[q+2]||0)/255:0;
    const fourth=(exclusive||pants)&&extra?(extra[q]||0)/255:0;
    const fifth=(exclusive||pants)&&extra?(extra[q+1]||0)/255:0;
    const opacity=marked ? (inkMask?.[p]||0)/255 : 0;
    // One neutral light multiplier retains saturation. Ink is composited over
    // the current fabric color, never over white pixels from the source photo.
    const inkShade=trim?Math.min(1,Math.max(.25,(inkMask?.[p+1]||245)/245)):.94+.06*shade;
    const border=stroke&&!trim?borders[stroke[p]]:null;
    const strokeOpacity=border?stroke[p+1]/255:0;
    for(let c=0;c<3;c++){
      const under=(1-secondary)*base[c]+secondary*colors.printSecondary[c];
      let fabric=exclusive?(base[c]*Math.max(0,1-pattern-secondary-tertiary-fourth-fifth)+colors.print[c]*pattern+colors.printSecondary[c]*secondary+colors.printTertiary[c]*tertiary+colors.printFourth[c]*fourth+colors.printFifth[c]*fifth)*shade:((1-pattern)*under+pattern*colors.print[c])*shade;
      if(border)fabric=fabric*(1-strokeOpacity)+border[c]*inkShade*strokeOpacity;
      const color=marked ? fabric*(1-opacity)+colors[key][c]*inkShade*opacity : fabric;
      output[p+c]=clamp(255*(1-coverage)+coverage*color);
    }
  }
  return output;
}

// Keep a body frame and redraw only the zones affected by changed controls.
export function createRenderer(source,atlas,width,height,ink,layers={}){
  const frame=new Uint8ClampedArray(source),groups=Array.from({length:11},()=>[]),halos=Array.from({length:11},()=>[]),active=[];
  for(let p=0;p<atlas.length;p+=4){const id=atlas[p];if(!id||!atlas[p+3])continue;groups[id].push(p);active.push(p);if(layers.outlines?.[p])halos[layers.outlines[p]].push(p);}
  const all=Uint32Array.from(active),shirt=Uint32Array.from(active.filter(p=>[1,2,3,4,8,9].includes(atlas[p]))),shorts=Uint32Array.from(active.filter(p=>[5,6,7].includes(atlas[p])));
  const grouped=groups.map(list=>Uint32Array.from(list)),marks=groups.map((list,id)=>Uint32Array.from(new Set([...list,...halos[id]])));
  let previous=null,previousPattern=null;
  return {frame,render(state,pattern){
    let indices=all;
    if(previous){
      const dirty=COLOR_KEYS.filter(key=>state[key]!==previous[key]);
      const outlines=OUTLINE_KEYS.filter(key=>state.outlines?.[key]?.enabled!==previous.outlines?.[key]?.enabled||state.outlines?.[key]?.color!==previous.outlines?.[key]?.color);
      if(state.shortsPrintEnabled!==previous.shortsPrintEnabled)indices=all;
      else if(state.pattern!==previous.pattern||pattern!==previousPattern||state.backLogoEnabled!==previous.backLogoEnabled||dirty.some(key=>['shirt',...PRINT_KEYS].includes(key))){
        const outside=dirty.some(key=>['shorts','shortsNumber','shortsLogo','socks'].includes(key))||outlines.some(key=>['shortsNumber','shortsLogo'].includes(key));
        indices=outside||state.shortsPrintEnabled?all:shirt;
      }
      else if(dirty.length===1&&!outlines.length){const key=dirty[0];indices=key==='shorts'?shorts:grouped[REGION_KEYS.indexOf(key)]||new Uint32Array();}
      else if(!dirty.length&&outlines.length===1&&outlines[0]!=='surnameColor')indices=marks[REGION_KEYS.indexOf(outlines[0])];
      else if(!dirty.length&&outlines.every(key=>key==='surnameColor'))indices=new Uint32Array();
    }
    renderPixels(source,atlas,width,height,state,ink,frame,{...layers,pattern,indices});
    previous=normalizeState(state);previousPattern=pattern;
    return {pixels:frame,processedPixels:indices.length};
  }};
}
