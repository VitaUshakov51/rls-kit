// One lightweight status window, shared by worker and main-thread PNG export.
export function waitForExportPaint(){
  return new Promise(resolve=>{
    const timeout=setTimeout(resolve,180);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));
  });
}
export function createExportFeedback(dialog){
  const title=dialog.querySelector('[data-export-title]'),message=dialog.querySelector('[data-export-message]');
  const save=dialog.querySelector('[data-export-save]'),close=dialog.querySelector('[data-export-close]');
  let busy=false,url=null;
  function release(){if(url){URL.revokeObjectURL(url);url=null;}save.removeAttribute('href');}
  function open(){
    if(dialog.open)return;
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  close.addEventListener('click',()=>{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  return {
    begin(){
      release();busy=true;dialog.dataset.state='busy';save.hidden=true;close.hidden=true;
      title.textContent='Готовим макет';
      message.textContent='Пожалуйста, дождитесь подготовки. PNG скачается автоматически. На телефоне это может занять чуть больше времени.';
      open();
    },
    complete(blob){
      url=URL.createObjectURL(blob);save.href=url;save.hidden=false;close.hidden=false;busy=false;dialog.dataset.state='ready';
      title.textContent='Макет готов';
      message.textContent='Если скачивание не началось, нажмите «Скачать PNG».';
      save.focus();save.click();
    },
    fail(){
      release();busy=false;dialog.dataset.state='error';save.hidden=true;close.hidden=false;
      title.textContent='Не удалось подготовить макет';
      message.textContent='Проверьте соединение и попробуйте скачать макет ещё раз.';
      open();close.focus();
    },
    dispose:release
  };
}
