import {OUTLINE_KEYS, PATTERNS, PRINT_KEYS, normalizeState,restoreState,applyReferenceColors, renderPixels,createRenderer,createPicker,patternAsset,shortsPatternAsset,canPrintShorts,modelAsset} from './renderer.js?v=23';
import {drawSurname} from './surname.js?v=8';
import {createAssetCache} from './asset-cache.js?v=8';
import {drawBoots,BOOT_PLACEMENTS} from './boots.js?v=8';
import {createExportFeedback,waitForExportPaint} from './export-feedback.js?v=12';
import {normalizeSuitState,suitAsset} from './suit-renderer.js?v=20';
import {createSuitPreview} from './suit-preview.js?v=20';
import {normalizeTrainingState,trainingAsset,renderTrainingPixels,trainingSelectionAt} from './training-renderer.js?v=20';
import {OUTERWEAR,createOuterwearConfig} from './outerwear-renderer.js?v=20';
import {recordMockupDownload} from './download-stats.js?v=22';
const $ = id => document.getElementById(id);
const STORAGE = 'rls-kit-builder-v1';
const SUIT_STORAGE='rls-tracksuit-v1';
const SUIT_PARTS=[['main','Основной цвет','Основной цвет костюма'],['secondary','Второстепенный цвет','Второстепенный цвет костюма']];
const TRAINING_STORAGE='rls-training-v1';
const TRAINING_PARTS=[['jacket','Кофта','Цвет кофты'],['inserts','Вставки сверху','Цвет вставок сверху'],['pants','Брюки','Цвет брюк'],['pantsInserts','Вставки снизу','Цвет вставок снизу']];
let trainingState=normalizeTrainingState(null),trainingSelected='jacket',trainingReady=false;
try{trainingState=normalizeTrainingState(JSON.parse(localStorage.getItem(TRAINING_STORAGE)));}catch{}
let product='kit',suitState=normalizeSuitState(null),suitSelected='main',suitReady=false,productRequest=0;
try{suitState=normalizeSuitState(JSON.parse(localStorage.getItem(SUIT_STORAGE)));}catch{}
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
const suitCanvas=$('suitCanvas');
const suitPreview=createSuitPreview(suitCanvas,()=>{
  $('canvasWrap').classList.add('suit-ready');
  if(product==='suit'){$('loading').hidden=true;$('canvasWrap').removeAttribute('aria-busy');$('download').disabled=exporting;}
});
const trainingCanvas=$('trainingCanvas');
const trainingPreview=createSuitPreview(trainingCanvas,()=>{
  $('canvasWrap').classList.add('training-ready');
  if(product==='training'){$('loading').hidden=true;$('canvasWrap').removeAttribute('aria-busy');$('download').disabled=exporting;}
},{asset:trainingAsset,normalize:normalizeTrainingState,render:renderTrainingPixels,pick:trainingSelectionAt,workerURL:new URL('./training-worker.js?v=20',import.meta.url),lighting:true,extraAsset:'pants-inserts'});
const outerwear=Object.fromEntries(Object.entries(OUTERWEAR).map(([id,definition])=>{
  const config=createOuterwearConfig(id),item={...definition,config,canvas:$(id+'Canvas'),poster:$(id+'BasePreview'),state:config.normalize(null),selected:definition.parts[0][0],ready:false};
  try{item.state=config.normalize(JSON.parse(localStorage.getItem(item.storage)));}catch{}
  item.preview=createSuitPreview(item.canvas,()=>{
    $('canvasWrap').classList.add(id+'-ready');
    if(product===id){$('loading').hidden=true;$('canvasWrap').removeAttribute('aria-busy');$('download').disabled=exporting;}
  },config);
  return [id,item];
}));
const activeReady=()=>outerwear[product]?.ready??(product==='training'?trainingReady:product==='suit'?suitReady:ready);
const activeCanvas=()=>outerwear[product]?.canvas??(product==='training'?trainingCanvas:product==='suit'?suitCanvas:canvas);
const exportFeedback=createExportFeedback($('exportDialog'));
window.addEventListener('pagehide',event=>{if(!event.persisted)exportFeedback.dispose();});
const chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

function toast(message) {
  $('toast').textContent=message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2500);
}
function persist(){clearTimeout(saveTimer);try{localStorage.setItem(STORAGE,JSON.stringify(state));localStorage.setItem(SUIT_STORAGE,JSON.stringify(suitState));localStorage.setItem(TRAINING_STORAGE,JSON.stringify(trainingState));for(const item of Object.values(outerwear))localStorage.setItem(item.storage,JSON.stringify(item.state));}catch{}}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,120);}
window.addEventListener('pagehide',persist);
function renderCurrent(){
  const outer=outerwear[product];if(outer){if(outer.ready)outer.preview.render(outer.state);return;}
  if(product==='training'){if(trainingReady)trainingPreview.render(trainingState);return;}
  if(product==='suit'){if(suitReady)suitPreview.render(suitState);return;}
  if(!ready)return;
  const snapshot=normalizeState(state),pattern=currentMaterial();
  if(renderWorker){pendingRender={id:desiredRevision,state:snapshot,pattern};dispatchRender();}
  else{const {pixels}=fallbackRenderer.render(snapshot,pattern);paint(pixels,snapshot);}
}
function paint(pixels,snapshot){
  if(product!=='kit')return;
  ctx.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);surnameBounds=drawSurname(ctx,snapshot,canvas.width);drawBoots(ctx,canvas.width,bootImages);
  $('canvasWrap').classList.add('ready');$('loading').hidden=true;$('canvasWrap').removeAttribute('aria-busy');
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
    worker=new Worker(new URL('./render-worker.js?v=23',import.meta.url),{type:'module'});
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
  if (!activeReady() || renderFrame) return;
  renderFrame=requestAnimationFrame(()=>{
    renderFrame=0;
    renderCurrent();
  });
}
function updateControls() {
  const outer=outerwear[product],isTraining=product==='training',isSuit=product!=='kit',colors=outer?outer.state:isTraining?trainingState:isSuit?suitState:state;
  $('kitTabs').hidden=isSuit;
  $('previewTitle').textContent=outer?outer.title:isTraining?'Тренировочный костюм':isSuit?'Костюм в ваших цветах':'Форма в ваших цветах';
  $('controlsHint').textContent=outer?(product==='winter'?'Выберите основной, второй цвет или логотип.':'Выберите основной цвет или вставки.'):isTraining?'Выберите кофту, вставки или брюки.':isSuit?'Выберите основной или второстепенный цвет.':'Выберите деталь, затем цвет.';
  $('stageTip').textContent=isSuit?'Нажмите на ткань или вставку, чтобы изменить цвет':'Нажмите на деталь формы, чтобы изменить цвет';
  for(const button of document.querySelectorAll('.product-button')){const active=button.dataset.product===product;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  for (const tab of document.querySelectorAll('.tab')) {
    const active=tab.dataset.group===group;
    tab.classList.toggle('active',active); tab.setAttribute('aria-selected',String(active)); tab.tabIndex=active?0:-1;
  }
  if(isSuit){$('parts').removeAttribute('aria-labelledby');$('parts').setAttribute('aria-label',outer?'Цвета: '+outer.title:isTraining?'Цвета тренировочного костюма':'Цвета парадного костюма');$('parts').setAttribute('role','group');}
  else{$('parts').removeAttribute('aria-label');$('parts').setAttribute('aria-labelledby','tab-'+group);$('parts').setAttribute('role','tabpanel');}
  const entries=outer?[...outer.parts]:isTraining?[...TRAINING_PARTS]:isSuit?[...SUIT_PARTS]:GROUPS[group].filter(([key])=>key!=='backLogo'||state.backLogoEnabled);
  if(!isSuit&&group==='shirt'&&PATTERNS.find(p=>p.id===state.pattern)?.secondary)entries.splice(4,0,['printSecondary','Детали принта','Цвет деталей принта']);
  if(!isSuit&&group==='shirt'&&PATTERNS.find(p=>p.id===state.pattern)?.tertiary)entries.splice(5,0,['printTertiary','Третий цвет принта','Третий цвет принта']);
  if(!isSuit&&group==='shirt'&&(PATTERNS.find(p=>p.id===state.pattern)?.colors?.length||0)>=4)entries.splice(6,0,['printFourth','Четвёртый цвет принта','Четвёртый цвет принта']);
  if(!isSuit&&group==='shirt'&&(PATTERNS.find(p=>p.id===state.pattern)?.colors?.length||0)>=5)entries.splice(7,0,['printFifth','Пятый цвет принта','Пятый цвет принта']);
  if(!isSuit&&group==='shirt'&&state.surnameEnabled)entries.push(['surnameColor','Фамилия','Цвет фамилии']);
  if(!isSuit&&!entries.some(p=>p[0]===selected))selected=entries[0][0];
  const selection=outer?outer.selected:isTraining?trainingSelected:isSuit?suitSelected:selected;
  for (const [key,label] of entries) {
    let row=partButtons.get(key);
    if(!row){
    row=document.createElement('button'); row.type='button';
    row.dataset.part=key; row.setAttribute('aria-pressed',String(key===selection));
    const left=document.createElement('span'); left.className='part-label';
    const dot=document.createElement('span'); dot.className='part-dot'; dot.style.backgroundColor=colors[key];
    const text=document.createElement('span'); text.textContent=label;
    left.append(dot,text);row.append(left);row.insertAdjacentHTML('beforeend',chevron);
    row.addEventListener('click',()=>select(key));partButtons.set(key,row);
    }
    row.className='part-row'+(key===selection?' active':'');row.setAttribute('aria-pressed',String(key===selection));row.querySelector('.part-dot').style.backgroundColor=colors[key];row.querySelector('.part-label').children[1].textContent=label;
  }
  const signature=entries.map(([key])=>key).join(',');
  if(signature!==partSignature){$('parts').replaceChildren(...entries.map(([key])=>partButtons.get(key)));partSignature=signature;}
  $('selectedName').textContent=entries.find(p=>p[0]===selection)[2];
  $('colorValue').textContent=colors[selection].toUpperCase();
  $('colorPicker').value=colors[selection];
  if(document.activeElement!==$('hexInput')||controlsSelection!==selection)$('hexInput').value=colors[selection].toUpperCase();
  controlsSelection=selection;
  $('hexInput').removeAttribute('aria-invalid');$('colorError').textContent='';
  for(const button of document.querySelectorAll('.swatch')) {
    const active=button.dataset.color===colors[selection];button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
  $('patternSection').hidden=isSuit||group!=='shirt';
  $('shortsPrintSection').hidden=isSuit||group!=='shorts'||(state.pattern!=='none'&&!canPrintShorts(state.pattern));
  $('shortsPrintToggle').checked=state.shortsPrintEnabled;
  $('shortsPrintToggle').disabled=isSuit||!canPrintShorts(state.pattern);
  $('shortsPrintHint').textContent=state.pattern==='none'?'Сначала выберите принт на футболке.':'Принт и его цвета берутся с футболки.';
  $('nameSection').hidden=isSuit||group!=='shirt';
  $('backLogoSection').hidden=isSuit||group!=='shirt';
  $('backLogoToggle').checked=state.backLogoEnabled;
  $('backLogoColorButton').hidden=!state.backLogoEnabled;
  $('backLogoDot').style.backgroundColor=state.backLogo;
  $('referenceColors').hidden=!PATTERNS.find(p=>p.id===state.pattern)?.colors;
  $('surnameToggle').checked=state.surnameEnabled;
  $('surnameFields').hidden=!state.surnameEnabled;
  $('surnameInput').value=state.surnameText;
  $('surnameDot').style.backgroundColor=state.surnameColor;
  const outline=isSuit?null:state.outlines[selected];
  $('outlineSection').hidden=isSuit||!OUTLINE_KEYS.includes(selected);
  $('outlineToggle').checked=!!outline?.enabled;
  $('outlineColorRow').hidden=!outline?.enabled;
  $('outlineColor').value=outline?.color||'#ffffff';
  for(const button of document.querySelectorAll('.pattern-card')) {
    const active=button.dataset.pattern===state.pattern;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  }
}
function select(key) {
  const outer=outerwear[product];if(outer){if(outer.parts.some(p=>p[0]===key)){outer.selected=key;updateControls();}return;}
  if(product==='training'){if(TRAINING_PARTS.some(p=>p[0]===key)){trainingSelected=key;updateControls();}return;}
  if(product==='suit'){if(SUIT_PARTS.some(p=>p[0]===key)){suitSelected=key;updateControls();}return;}
  selected=key; group=[...PRINT_KEYS,'surnameColor'].includes(key)?'shirt':Object.keys(GROUPS).find(g=>GROUPS[g].some(p=>p[0]===key));updateControls();
}
function applyColor(color) {
  if(!/^#[0-9a-f]{6}$/i.test(color)) return;
  const current=outerwear[product],colors=current?current.state:product==='training'?trainingState:product==='suit'?suitState:state,key=current?current.selected:product==='training'?trainingSelected:product==='suit'?suitSelected:selected;
  if(colors[key]===color.toLowerCase()){updateControls();return;}
  const outer=outerwear[product];if(outer)outer.state[outer.selected]=color.toLowerCase();else if(product==='training')trainingState[trainingSelected]=color.toLowerCase();else if(product==='suit')suitState[suitSelected]=color.toLowerCase();else state[selected]=color.toLowerCase();save();updateControls();scheduleRender();
}
async function switchProduct(next){
  if(!['kit','suit','training',...Object.keys(outerwear)].includes(next)||product===next)return;
  const request=++productRequest;product=next;
  $('canvasWrap').classList.toggle('suit-mode',next==='suit');
  $('canvasWrap').classList.toggle('training-mode',next==='training');
  for(const [id,item]of Object.entries(outerwear)){$('canvasWrap').classList.toggle(id+'-mode',next===id);item.canvas.hidden=next!==id;item.poster.hidden=next!==id;}
  $('canvasWrap').setAttribute('aria-label',next==='training'?'Тренировочный костюм спереди и сзади. Нажмите на кофту, вставки или брюки, чтобы выбрать цвет.':next==='suit'?'Парадный костюм спереди и сзади. Нажмите на ткань или вставку, чтобы выбрать цвет.':'Футболка, шорты и гетры спереди и сзади. Нажмите на деталь, чтобы выбрать ее цвет.');
  if(outerwear[next])$('canvasWrap').setAttribute('aria-label',outerwear[next].title+' спереди и сзади. Нажмите на ткань, вставку или логотип, чтобы выбрать цвет.');
  canvas.hidden=next!=='kit';$('basePreview').hidden=next!=='kit';suitCanvas.hidden=next!=='suit';$('suitBasePreview').hidden=next!=='suit';
  trainingCanvas.hidden=next!=='training';$('trainingBasePreview').hidden=next!=='training';
  $('download').disabled=!activeReady()||exporting;
  $('loading').innerHTML='<span class="spinner"></span>Подготавливаем комплект';
  $('loading').hidden=activeReady();$('canvasWrap').setAttribute('aria-busy',String(!activeReady()));
  updateControls();
  if(next!=='kit'){
    const outer=outerwear[next],training=next==='training',preview=outer?outer.preview:training?trainingPreview:suitPreview,poster=outer?outer.poster:training?$('trainingBasePreview'):$('suitBasePreview'),asset=outer?outer.config.asset:training?trainingAsset:suitAsset;
    if(!poster.getAttribute('src'))poster.src=asset('poster',{preview:true});
    try{
      await preview.load();if(outer)outer.ready=true;else if(training)trainingReady=true;else suitReady=true;
      if(request!==productRequest)return;
      renderCurrent();$('download').disabled=exporting;
    }catch{
      if(request!==productRequest)return;
      $('loading').hidden=false;$('loading').textContent='Модель не загрузилась. Выберите другую вкладку и попробуйте снова.';toast('Не удалось загрузить модель');
    }
  }else renderCurrent();
}
for(const button of document.querySelectorAll('.product-button'))button.addEventListener('click',()=>switchProduct(button.dataset.product));
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
$('reset').addEventListener('click',()=>{const outer=outerwear[product];if(outer)outer.state=outer.config.normalize(null);else if(product==='training')trainingState=normalizeTrainingState(null);else if(product==='suit')suitState=normalizeSuitState(null);else{patternRequest++;state=normalizeState(null);}save();updateControls();scheduleRender();toast('Исходный комплект восстановлен');});
function pickPart(x,y){
  if(outerwear[product])return outerwear[product].preview.pick(x,y);
  if(product==='training')return trainingPreview.pick(x,y);
  if(product==='suit')return suitPreview.pick(x,y);
  const scale=canvas.width/1086;if(BOOT_PLACEMENTS.some(({box:[x0,y0,x1,y1]})=>x>=x0*scale&&x<=x1*scale&&y>=y0*scale&&y<=y1*scale))return null;
  if(state.surnameEnabled&&surnameBounds&&x>=surnameBounds.x&&x<=surnameBounds.x+surnameBounds.width&&y>=surnameBounds.y&&y<=surnameBounds.y+surnameBounds.height)return 'surnameColor';
  return bodyPicker(x,y,state,currentMaterial());
}
$('canvasWrap').addEventListener('click',event=>{
  if(!activeReady()) return;
  const target=activeCanvas(),rect=target.getBoundingClientRect();
  const key=pickPart((event.clientX-rect.left)*target.width/rect.width,(event.clientY-rect.top)*target.height/rect.height);
  if(key){select(key);if(window.innerWidth<=800)$('selectedName').scrollIntoView({behavior:'smooth',block:'center'});}
});
$('canvasWrap').addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  if(!activeReady())return;const target=activeCanvas(),rect=target.getBoundingClientRect();
  const key=pickPart((event.clientX-rect.left)*target.width/rect.width,(event.clientY-rect.top)*target.height/rect.height);
  const cursor=key?'pointer':'default';if($('canvasWrap').style.cursor!==cursor)$('canvasWrap').style.cursor=cursor;
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
  if(!activeReady()||exporting)return;
  exporting=true;$('download').disabled=true;$('download').setAttribute('aria-busy','true');
  $('downloadLabel').textContent='Готовим макет…';
  const exportProduct=product,exportOuter=outerwear[exportProduct],exportState=exportOuter?exportOuter.config.normalize(exportOuter.state):exportProduct==='training'?normalizeTrainingState(trainingState):exportProduct==='suit'?normalizeSuitState(suitState):normalizeState(state);
  try{
    exportFeedback.begin(exportOuter?exportOuter.filename:exportProduct==='training'?'RLS-trenirovochny-kostyum.png':exportProduct==='suit'?'RLS-paradny-kostyum.png':'RLS-komplekt.png');
    await waitForExportPaint();
    let blob=null;
    if(exportOuter)blob=await exportOuter.preview.export(exportState);
    if(exportProduct==='training')blob=await trainingPreview.export(exportState);
    if(exportProduct==='suit')blob=await suitPreview.export(exportState);
    if(exportProduct==='kit'&&typeof Worker==='function'){
      let exporter;
      try{exporter=new Worker(new URL('./export-worker.js?v=23',import.meta.url),{type:'module'});blob=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Export timeout')),20000);exporter.onmessage=event=>{clearTimeout(timeout);event.data.type==='complete'?resolve(event.data.blob):reject(new Error('Use compatible export'));};exporter.onerror=()=>{clearTimeout(timeout);reject(new Error('Use compatible export'));};exporter.postMessage({state:exportState});});}
      catch{}finally{exporter?.terminate();}
    }
    if(!blob&&exportProduct==='kit'){
    const [model,pattern]=await Promise.all([loadModel(true),loadPatternMaterial(exportState.pattern,false,exportState.shortsPrintEnabled)]);
    const fullCanvas=document.createElement('canvas');fullCanvas.width=model.width;fullCanvas.height=model.height;const fullCtx=fullCanvas.getContext('2d',{alpha:false});
    const pixels=fullCtx.createImageData(model.width,model.height);
    renderPixels(model.source.data,model.atlas.data,model.width,model.height,exportState,model.ink,pixels.data,{pattern,outlines:model.outlines,rearFabric:model.rearFabric});
    fullCtx.putImageData(pixels,0,0);drawSurname(fullCtx,exportState,model.width);drawBoots(fullCtx,model.width,bootImages);
    blob=await new Promise(resolve=>fullCanvas.toBlob(resolve,'image/png'));
    fullCanvas.width=fullCanvas.height=1;
    }
    if(!blob||!blob.size)throw new Error('Export failed');
    exportFeedback.complete(blob);
    recordMockupDownload(exportProduct);
  }catch{exportFeedback.fail();}
  finally{exporting=false;$('download').disabled=!activeReady();$('download').removeAttribute('aria-busy');$('downloadLabel').textContent='Скачать макет';}
});
updateControls();
try {
  const [model]=await Promise.all([loadModel(),loadPattern(state.pattern),document.fonts.load('400 106px KitName').catch(()=>[]),Promise.all(BOOT_PLACEMENTS.map(async({id})=>{bootImages[id]=await loadImage('assets/boots/'+id+'.png?v=8');}))]);
  source=model.source;atlas=model.atlas;inkMask=model.ink;strokeMap=model.outlines;rearFabric=model.rearFabric;
  bodyPicker=createPicker(atlas.data,canvas.width,canvas.height,{outlines:strokeMap,rearFabric});
  const workerReady=await startWorker();if(!workerReady)fallbackRenderer=createRenderer(source.data,atlas.data,canvas.width,canvas.height,inkMask,{outlines:strokeMap,rearFabric});
  else{atlas=null;strokeMap=null;rearFabric=null;}ready=true;
  renderCurrent();
  if(product==='kit')$('download').disabled=false;
} catch {
  if(product==='kit'){$('loading').textContent='Модель не загрузилась. Обновите страницу.';toast('Не удалось загрузить модель');}
}
