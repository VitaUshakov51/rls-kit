import {OUTLINE_KEYS, PATTERNS, PRINT_KEYS, normalizeState,restoreState,applyReferenceColors, renderPixels,createRenderer,createPicker,patternAsset,shortsPatternAsset,canPrintShorts,modelAsset} from './renderer.js?v=11';
import {drawSurname} from './surname.js?v=8';
import {createAssetCache} from './asset-cache.js?v=8';
import {drawBoots,BOOT_PLACEMENTS} from './boots.js?v=8';
import {createExportFeedback,waitForExportPaint} from './export-feedback.js?v=11';
const $ = id => document.getElementById(id);
const STORAGE = 'rls-kit-builder-v1';
const GROUPS = {
  shirt:[['shirt','Ткань футболки','Цвет футболки'],['collar','Воротник','Цвет воротника'],['cuffs','Манжеты рукавов','Цвет манжет'],['print','Принт','Цвет принта'],['chestLogo','Логотип на груди','Цвет логотипа на груди'],['backNumber','Номер на спине','Цвет номера на спине'],['backLogo','Логотип на спине','Цвет логотипа на спине']],
  shorts:[['shorts','Ткань шорт','Цвет шорт'],['shortsNumber','Номер на шортах','Цвет номера на шортах'],['shortsLogo','Логотип на шортах','Цвет логотипа на шортах']],
  socks:[['socks','Гетры','Цвет гетр']]
};
const PALETTE=[['#ffffff','Белый'],['#191d24','Чёрный'],['#d3d6dc','Серый'],['#6d7586','Графит'],['#003bb5','Синий'],['#1b244a','Тёмно-синий'],['#28a6e7','Голубой'],['#58d2c9','Тиффани'],['#e33843','Красный'],['#a12b3b','Бордовый'],['#ed85ac','Розовый'],['#8859c5','Фиолетовый'],['#f4bf32','Жёлтый'],['#ec8836','Оранжевый'],['#269665','Зелёный'],['#92bb48','Лайм']];
let state=normalizeState(null), selected='shirt', group='shirt';
try {
  state=restoreState(JSON.parse(localStorage.getItem(STORAGE)));
} catch {}
let source,atlas,output,inkMask=null,strokeMap=null,rearFabric=null,renderFrame=0,ready=false,toastTimer,surnameBounds=null,patternRequest=0,exporting=false;
let partSignature='',controlsSelection='',bodyPicker=null,saveTimer;
let renderWorker=null,workerBusy=false,desiredRevision=0,pendingRender=null,workerPatternId=null,recycleBuffer=null,fallbackRenderer=null,recovering=false;
const bootImages={};
const partButtons=new Map();
const materialKey=(id,shorts=false)=>id+':'+Number(shorts&&canPrintShorts(id));
const currentMaterial=()=>patternCache.get(materialKey(state.pattern,state.shortsPrintEnabled));
const patternCache=createAssetCache(key=>{const [id,shorts]=key.split(':');return loadPatternMaterial(id,true,shorts==='1');},{limit:2,protectedKey:()=>materialKey(state.pattern,state.shortsPrintEnabled)});
const canvas=$('kitCanvas'),ctx=canvas.getContext('2d',{alpha:false});
const exportFeedback=createExportFeedback($('exportDialog'));
window.addEventListener('pagehide',event=>{if(!event.persisted)exportFeedback.dispose();});
const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

function toast(message) {
  $('toast').textContent=message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);
}
function persist(){clearTimeout(saveTimer);try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{}}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,120);}
window.addEventListener('pagehide',persist);
function renderCurrent(){
  if(!ready)return;
  const snapshot=normalizeState(state),pattern=currentMaterial();
  if(renderWorker){pendingRender={id:desiredRevision,state:snapshot,pattern};dispatchRender();}
  else{const {pixels}=fallbackRenderer.render(snapshot,pattern);paint(pixels,snapshot);}
}
function paint(pixels,snapshot){
  ctx.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);surnameBounds=drawSurname(ctx,snapshot,canvas.width);drawBoots(ctx,canvas.width,bootImages);
  $('canvasWrap').classList.add('ready');$('loading').hidden=true;
}
function dispatchRender(){
  if(workerBusy||!pendingRender||!renderWorker)return;
  const current=pendingRender;pendingRender=null;workerBusy=true;
  const key=materialKey(current.state.pattern,current.state.shortsPrintEnabled);
  const message={type:'render',id:current.id,state:current.state,patternId:key,recycle:recycleBuffer},transfer=[];
  if(recycleBuffer){transfer.push(recycleBuffer);recycleBuffer=null;}
  if(workerPatternId!==key){
    const clonePlate=plate=>{if(!plate)return null;const copy={};for(const field of ['data','extra'])if(plate[field]){copy[field]=plate[field].slice();transfer.push(copy[field].buffer);}return copy;};
    message.pattern=clonePlate(current.pattern);
    if(current.pattern?.shorts)message.pattern.shorts={...clonePlate(current.pattern.shorts),offsetY:current.pattern.shorts.offsetY};
    workerPatternId=key;
  }
  renderWorker.current=current;renderWorker.postMessage(message,transfer);
}
async function startWorker(){
  if(typeof Worker!=='function')return false;
  let worker;
  try{
    worker=new Worker(new URL('./render-worker.js?v=11',import.meta.url),{type:'module'});
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Worker unavailable')),5000);
      worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Worker unavailable'));};
      worker.onmessage=event=>{if(event.data.type==='ready'){clearTimeout(timeout);resolve();}else if(event.data.type==='error'){clearTimeout(timeout);reject(new Error(event.data.message));}};
      worker.postMessage({type:'init',model:{source:source.data,atlas:atlas.data,width:canvas.width,height:canvas.height,ink:inkMask,outlines:strokeMap,rearFabric}});
    });
    renderWorker=worker;source=null;inkMask=null;
    worker.onmessage=event=>{
      const result=event.data;if(result.type==='error'){recoverRenderer();return;}if(result.type!=='frame')return;
      workerBusy=false;recycleBuffer=result.buffer;
      if(result.id===desiredRevision)paint(new Uint8ClampedArray(result.buffer),worker.current.state);
      dispatchRender();
    };
    worker.onerror=()=>recoverRenderer();return true;
  }catch{worker?.terminate();return false;}
}
async function recoverRenderer(){
  if(recovering)return;recovering=true;ready=false;renderWorker?.terminate();renderWorker=null;workerBusy=false;pendingRender=null;
  try{const m=await loadModel();fallbackRenderer=createRenderer(m.source.data,m.atlas.data,canvas.width,canvas.height,m.ink,{outlines:m.outlines,rearFabric:m.rearFabric});ready=true;renderCurrent();}
  catch{toast('Обновите страницу, чтобы восстановить предпросмотр');}
  finally{recovering=false;}
}
function scheduleRender() {
  desiredRevision++;
  if (!ready || renderFrame) return;
  renderFrame=requestAnimationFrame(()=>{
    renderFrame=0;
    renderCurrent();
  });
}
function updateControls() {
  for (const tab of document.querySelectorAll('.tab')) {
    const active=tab.dataset.group===group;
    tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active)); tab.tabIndex=active?0:-1;
  }
  $('parts').setAttribute('aria-labelledby','tab-'+group);
  const entries=GROUPS[group].filter(([key])=>key!=='backLogo'||state.backLogoEnabled);
  if(group==='shirt'&&PATTERNS.find(p=>p.id===state.pattern)?.secondary)entries.splice(4,0,['printSecondary','Детали принта','Цвет деталей принта']);
  if(group==='shirt'&&PATTERNS.find(p=>p.id===state.pattern)?.tertiary)entries.splice(5,0,['printTertiary','Третий цвет принта','Третий цвет принта']);
  if(group==='shirt'&&(PATTERNS.find(p=>p.id===state.pattern)?.colors?.length||0)>=4)entries.splice(6,0,['printFourth','Четвёртый цвет принта','Четвёртый цвет принта']);
  if(group==='shirt'&&(PATTERNS.find(p=>p.id===state.pattern)?.colors?.length||0)>=5)entries.splice(7,0,['printFifth','Пятый цвет принта','Пятый цвет принта']);
  if(group==='shirt'&&state.surnameEnabled)entries.push(['surnameColor','Фамилия','Цвет фамилии']);
  if(!entries.some(p=>p[0]===selected))selected=entries[0][0];
  for (const [key,label] of entries) {
    let row=partButtons.get(key);
    if(!row){
    row=document.createElement('button'); row.type='button';
    row.dataset.part=key; row.setAttribute('aria-pressed',String(key===selected));
    const left=document.createElement('span'); left.className='part-label';
    const dot=document.createElement('span'); dot.className='part-dot'; dot.style.backgroundColor=state[key];
    const text=document.createElement('span'); text.textContent=label;
    left.append(dot,text);row.append(left);row.insertAdjacentHTML('beforeend',chevron);
    row.addEventListener('click',()=>select(key));partButtons.set(key,row);
    }
    row.className='part-row'+(key===selected?' active':'');row.setAttribute('aria-pressed',String(key===selected));row.querySelector('.part-dot').style.backgroundColor=state[key];
  }
  const signature=entries.map(([key])=>key).join(',');
  if(signature!==partSignature){$('parts').replaceChildren(...entries.map(([key])=>partButtons.get(key)));partSignature=signature;}
  $('selectedName').textContent=entries.find(p=>p[0]===selected)[2];
  $('colorValue').textContent=state[selected].toUpperCase();
  $('colorPicker').value=state[selected];
  if(document.activeElement!==$('hexInput')||controlsSelection!==selected)$('hexInput').value=state[selected].toUpperCase();
  controlsSelection=selected;
  $('hexInput').removeAttribute('aria-invalid');$('colorError').textContent='';
  for(const button of document.querySelectorAll('.swatch')) {
    const active=button.dataset.color===state[selected];button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
  $('patternSection').hidden=group!=='shirt';
  $('shortsPrintSection').hidden=group!=='shorts'||(state.pattern!=='none'&&!canPrintShorts(state.pattern));
  $('shortsPrintToggle').checked=state.shortsPrintEnabled;
  $('shortsPrintToggle').disabled=!canPrintShorts(state.pattern);
  $('shortsPrintHint').textContent=state.pattern==='none'?'Сначала выберите принт на футболке.':'Принт и его цвета берутся с футболки.';
  $('nameSection').hidden=group!=='shirt';
  $('backLogoSection').hidden=group!=='shirt';
  $('backLogoToggle').checked=state.backLogoEnabled;
  $('backLogoColorButton').hidden=!state.backLogoEnabled;
  $('backLogoDot').style.backgroundColor=state.backLogo;
  $('referenceColors').hidden=!PATTERNS.find(p=>p.id===state.pattern)?.colors;
  $('surnameToggle').checked=state.surnameEnabled;
  $('surnameFields').hidden=!state.surnameEnabled;
  $('surnameInput').value=state.surnameText;
  $('surnameDot').style.backgroundColor=state.surnameColor;
  const outline=state.outlines[selected];
  $('outlineSection').hidden=!OUTLINE_KEYS.includes(selected);
  $('outlineToggle').checked=!!outline?.enabled;
  $('outlineColorRow').hidden=!outline?.enabled;
  $('outlineColor').value=outline?.color||'#ffffff';
  for(const button of document.querySelectorAll('.pattern-card')) {
    const active=button.dataset.pattern===state.pattern;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
}
function select(key) {
  selected=key; group=[...PRINT_KEYS,'surnameColor'].includes(key)?'shirt':Object.keys(GROUPS).find(g=>GROUPS[g].some(p=>p[0]===key));updateControls();
}
function applyColor(color) {
  if(!/^#[0-9a-f]{6}$/i.test(color)) return;
  state[selected]=color.toLowerCase();save();updateControls();scheduleRender();
}
for(const [color,name] of PALETTE) {
  const button=document.createElement('button');button.className='swatch';button.type='button';button.dataset.color=color;
  button.style.backgroundColor=color;button.style.color=['#ffffff','#d3d6dc','#f4bf32','#58d2c9','#92bb48'].includes(color)?'#31404f':'#fff';
  button.setAttribute('aria-label',name);button.title=name;button.innerHTML=check;
  button.addEventListener('click',()=>applyColor(color));$('swatches').append(button);
}
// Checkmarks only show for the selected color.
const style=document.createElement('style');style.textContent='.swatch:not(.active) svg{visibility:hidden}';document.head.append(style);
for(const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click',()=>select(GROUPS[tab.dataset.group][0][0]));
  tab.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();const keys=Object.keys(GROUPS),i=keys.indexOf(group);
    const next=event.key==='Home'?0:event.key==='End'?keys.length-1:(i+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
    select(GROUPS[keys[next]][0][0]);$('tab-'+keys[next]).focus();
  });
}
$('colorPicker').addEventListener('input',event=>applyColor(event.target.value));
$('hexInput').addEventListener('input',event=>{
  const raw=event.target.value.trim();const value=raw.startsWith('#')?raw:'#'+raw;
  if(/^#[0-9a-f]{6}$/i.test(value)) applyColor(value);
});
$('hexInput').addEventListener('change',event=>{
  const raw=event.target.value.trim(),value=raw.startsWith('#')?raw:'#'+raw;
  if(/^#[0-9a-f]{6}$/i.test(value)){
    event.target.value=value.toUpperCase();applyColor(value);
  }else{
    event.target.setAttribute('aria-invalid','true');$('colorError').textContent='Введите цвет в формате #FFFFFF';
  }
});
for(const pattern of PATTERNS.filter(p=>!['none','original'].includes(p.id))){
  const button=document.createElement('button');button.type='button';button.className='pattern-card';button.dataset.pattern=pattern.id;button.setAttribute('aria-pressed','false');
  const thumb=document.createElement('img');thumb.className='pattern-thumb texture';thumb.src='assets/patterns/'+pattern.id+'-thumb.png?v=8';thumb.alt='';thumb.loading='lazy';thumb.decoding='async';thumb.width=240;thumb.height=160;
  const label=document.createElement('span');label.textContent=pattern.name;const count=document.createElement('small');count.textContent=pattern.colors.length+' '+(pattern.colors.length===1?'цвет':pattern.colors.length<5?'цвета':'цветов');button.append(thumb,label,count);button.insertAdjacentHTML('beforeend',check);$('patternOptions').append(button);
}
async function loadPattern(id,shorts=state.shortsPrintEnabled){
  shorts=shorts&&canPrintShorts(id);
  if(id==='none'||id==='original'&&!shorts)return null;
  return patternCache.request(materialKey(id,shorts));
}
for(const button of document.querySelectorAll('.pattern-card')) button.addEventListener('click',async()=>{
  const request=++patternRequest;
  button.disabled=true;button.classList.add('loading');button.setAttribute('aria-busy','true');
  try{await loadPattern(button.dataset.pattern);if(request===patternRequest){state.pattern=button.dataset.pattern;if(!canPrintShorts(state.pattern))state.shortsPrintEnabled=false;const preset=PATTERNS.find(p=>p.id===state.pattern);preset.colors?.forEach((color,i)=>state[PRINT_KEYS[i]]=color);if(PRINT_KEYS.indexOf(selected)>=(preset.colors?.length||1))selected='print';save();updateControls();scheduleRender();}}
  catch{if(request===patternRequest)toast('Принт не загрузился. Попробуйте ещё раз.');}
  finally{button.disabled=false;button.classList.remove('loading');button.removeAttribute('aria-busy');}
});
$('referenceColors').addEventListener('click',()=>{state=applyReferenceColors(state);save();updateControls();scheduleRender();});
$('shortsPrintToggle').addEventListener('change',async event=>{
  const enabled=event.target.checked,request=++patternRequest;
  event.target.disabled=true;event.target.setAttribute('aria-busy','true');
  try{await loadPattern(state.pattern,enabled);if(request===patternRequest){state.shortsPrintEnabled=enabled&&canPrintShorts(state.pattern);save();updateControls();scheduleRender();}}
  catch{if(request===patternRequest)toast('Принт для шорт не загрузился. Попробуйте ещё раз.');}
  finally{event.target.removeAttribute('aria-busy');updateControls();}
});
$('outlineToggle').addEventListener('change',event=>{state.outlines[selected].enabled=event.target.checked;save();updateControls();scheduleRender();});
$('outlineColor').addEventListener('input',event=>{state.outlines[selected].color=event.target.value;save();scheduleRender();});
$('surnameToggle').addEventListener('change',event=>{state.surnameEnabled=event.target.checked;if(!state.surnameEnabled&&selected==='surnameColor')selected='backNumber';save();updateControls();scheduleRender();});
$('surnameInput').addEventListener('input',event=>{state.surnameText=event.target.value.replace(/[^\p{L}\p{N}\s'’-]/gu,'').slice(0,24);save();scheduleRender();});
$('surnameColorButton').addEventListener('click',()=>select('surnameColor'));
$('backLogoToggle').addEventListener('change',event=>{state.backLogoEnabled=event.target.checked;if(!state.backLogoEnabled&&selected==='backLogo')selected='backNumber';save();updateControls();scheduleRender();});
$('backLogoColorButton').addEventListener('click',()=>select('backLogo'));
$('reset').addEventListener('click',()=>{patternRequest++;state=normalizeState(null);save();updateControls();scheduleRender();toast('Исходный комплект восстановлен');});
function pickPart(x,y){
  const scale=canvas.width/1086;if(BOOT_PLACEMENTS.some(({box:[x0,y0,x1,y1]})=>x>=x0*scale&&x<=x1*scale&&y>=y0*scale&&y<=y1*scale))return null;
  if(state.surnameEnabled&&surnameBounds&&x>=surnameBounds.x&&x<=surnameBounds.x+surnameBounds.width&&y>=surnameBounds.y&&y<=surnameBounds.y+surnameBounds.height)return 'surnameColor';
  return bodyPicker(x,y,state,currentMaterial());
}
$('canvasWrap').addEventListener('click',event=>{
  if(!ready) return;
  const rect=canvas.getBoundingClientRect();
  const key=pickPart((event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height);
  if(key){select(key);if(window.innerWidth<=800)$('selectedName').scrollIntoView({behavior:'smooth',block:'center'});}
});
$('canvasWrap').addEventListener('pointermove',event=>{
  if(!ready)return;const rect=canvas.getBoundingClientRect();
  const key=pickPart((event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height);
  $('canvasWrap').style.cursor=key?'pointer':'default';
});
function loadImage(url) { return new Promise((resolve,reject)=>{const image=new Image();image.decoding='async';image.onload=()=>resolve(image);image.onerror=reject;image.src=url;}); }
function imageData(image,width=canvas.width,height=canvas.height) {const c=document.createElement('canvas');c.width=width;c.height=height;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(image,0,0,width,height);return cx.getImageData(0,0,width,height);}
async function loadPatternMaterial(id,preview=false,shorts=false){
  shorts=shorts&&canPrintShorts(id);
  const decode=async extra=>{const image=await loadImage(patternAsset(id,{preview,extra})).catch(()=>loadImage(patternAsset(id,{preview,extra,bitmap:true})));return imageData(image,preview?image.naturalWidth:2160,preview?image.naturalHeight:2880).data;};
  const material={};
  if(!['none','original'].includes(id)){material.data=await decode(false);if(PATTERNS.find(p=>p.id===id).colors.length>3)material.extra=await decode(true);}
  if(shorts&&id!=='none'){
    const decodeShorts=async extra=>{const image=await loadImage(shortsPatternAsset(id,{preview,extra}));return imageData(image,image.naturalWidth,image.naturalHeight).data;};
    material.shorts={data:await decodeShorts(false),offsetY:preview?576:1152};
    if((PATTERNS.find(p=>p.id===id)?.colors?.length||0)>3)material.shorts.extra=await decodeShorts(true);
  }
  return material;
}
async function loadModel(full=false){
  const width=full?2160:canvas.width,height=full?2880:canvas.height;
  const [base,zones,coverage,ink,stroke,rear]=await Promise.all(['kit','zones','coverage','ink','outlines','rear-fabric'].map(name=>loadImage(modelAsset(name,{preview:!full})).then(image=>imageData(image,width,height))));
  for(let p=0;p<zones.data.length;p+=4)zones.data[p+3]=coverage.data[p];
  return {source:base,atlas:zones,ink:ink.data,outlines:stroke.data,rearFabric:rear.data,width,height};
}
$('download').addEventListener('click',async()=>{
  if(!ready||exporting)return;
  exporting=true;$('download').disabled=true;$('download').setAttribute('aria-busy','true');
  $('downloadLabel').textContent='Готовим макет…';
  const exportState=normalizeState(state);
  try{
    exportFeedback.begin();
    await waitForExportPaint();
    let blob=null;
    if(typeof Worker==='function'){
      let exporter;
      try{exporter=new Worker(new URL('./export-worker.js?v=11',import.meta.url),{type:'module'});blob=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Export timeout')),20000);exporter.onmessage=event=>{clearTimeout(timeout);event.data.type==='complete'?resolve(event.data.blob):reject(new Error('Use compatible export'));};exporter.onerror=()=>{clearTimeout(timeout);reject(new Error('Use compatible export'));};exporter.postMessage({state:exportState});});}
      catch{}finally{exporter?.terminate();}
    }
    if(!blob){
    const [model,pattern]=await Promise.all([loadModel(true),loadPatternMaterial(exportState.pattern,false,exportState.shortsPrintEnabled)]);
    const fullCanvas=document.createElement('canvas');fullCanvas.width=model.width;fullCanvas.height=model.height;const fullCtx=fullCanvas.getContext('2d',{alpha:false});
    const pixels=fullCtx.createImageData(model.width,model.height);
    renderPixels(model.source.data,model.atlas.data,model.width,model.height,exportState,model.ink,pixels.data,{pattern,outlines:model.outlines,rearFabric:model.rearFabric});
    fullCtx.putImageData(pixels,0,0);drawSurname(fullCtx,exportState,model.width);drawBoots(fullCtx,model.width,bootImages);
    blob=await new Promise(resolve=>fullCanvas.toBlob(resolve,'image/png'));
    fullCanvas.width=fullCanvas.height=1;
    }
    if(!blob)throw new Error('Export failed');
    exportFeedback.complete(blob);
  }catch{exportFeedback.fail();}
  finally{exporting=false;$('download').disabled=false;$('download').removeAttribute('aria-busy');$('downloadLabel').textContent='Скачать макет';}
});
updateControls();
try {
  const [model]=await Promise.all([loadModel(),loadPattern(state.pattern),document.fonts.load('400 106px KitName').catch(()=>[]),Promise.all(BOOT_PLACEMENTS.map(async({id})=>{bootImages[id]=await loadImage('assets/boots/'+id+'.png?v=8');}))]);
  source=model.source;atlas=model.atlas;inkMask=model.ink;strokeMap=model.outlines;rearFabric=model.rearFabric;
  bodyPicker=createPicker(atlas.data,canvas.width,canvas.height,{outlines:strokeMap,rearFabric});
  const workerReady=await startWorker();if(!workerReady)fallbackRenderer=createRenderer(source.data,atlas.data,canvas.width,canvas.height,inkMask,{outlines:strokeMap,rearFabric});
  else{atlas=null;strokeMap=null;rearFabric=null;}ready=true;
  renderCurrent();
  $('download').disabled=false;
} catch {
  $('loading').textContent='Модель не загрузилась. Обновите страницу.';toast('Не удалось загрузить модель');
}
