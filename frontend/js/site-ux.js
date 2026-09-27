/* Shared semantics and keyboard navigation. No data requests or persistence. */
(function(){
  'use strict';
  const copy=(ru,kk,en)=>window.currentLanguage==='kk'?kk:window.currentLanguage==='en'?en:ru;
  const dialogSelector='.mobile-menu,.bottom-sheet,.modal';
  let activeDialog=null,returnFocus=null,routePending=false,focusVersion=0,tipId=0;
  const matches=(root,selector)=>[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
  function isVisible(el){return el?.isConnected&&!el.closest('[inert]')&&el.getClientRects().length&&getComputedStyle(el).visibility==='visible';}
  function visibleControls(root){return [...root.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&isVisible(el));}
  function syncFavorite(button){button.setAttribute('aria-pressed',String(button.classList.contains('favorited')));button.setAttribute('aria-label',button.title||copy('Избранное','Таңдаулылар','Favorites'));}
  function syncTip(card){card.querySelector('.tip-card-header')?.setAttribute('aria-expanded',String(card.classList.contains('open')));}
  function enhance(root=document){
    matches(root,'#grant-filters input,#grant-filters select').forEach(control=>{
      if(control.closest('label'))return;
      const names={q:copy('Поиск гранта','Грант іздеу','Search grants'),type:copy('Тип финансирования','Қаржыландыру түрі','Funding type'),coverage_type:copy('Покрытие','Қамту','Coverage'),status:copy('Проверка условий','Шарттарды тексеру','Verification'),sort:copy('Порядок показа','Көрсету реті','Sort order')};
      const label=document.createElement('label');label.className='grant-filter-field';label.textContent=names[control.name]||control.name;control.before(label);label.append(control);
    });
    matches(root,'a[onclick]').forEach(link=>{
      const route=link.getAttribute('onclick').match(/navigate\('([a-z]+)'(?:,\s*(\d+))?\)/);
      if(route){link.dataset.route=route[1];link.setAttribute('href','#'+route[1]+(route[2]?'/'+route[2]:''));}
      else if(!link.hasAttribute('href')){link.setAttribute('role','button');link.tabIndex=0;}
    });
    matches(root,'label:not([for])').forEach(label=>{if(label.querySelector('input,select,textarea'))return;const control=label.nextElementSibling;if(control?.matches('input,select,textarea')&&control.id)label.htmlFor=control.id;});
    matches(root,'.compare-table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label',copy('Сравнение университетов, горизонтальная прокрутка','Университеттерді салыстыру, көлденең айналдыру','University comparison, scroll horizontally'));});
    matches(root,'.btn-favorite').forEach(syncFavorite);
    matches(root,'.modal-close,.sheet-close').forEach(button=>button.setAttribute('aria-label',copy('Закрыть','Жабу','Close')));
    matches(root,'#chat-send').forEach(button=>button.setAttribute('aria-label',copy('Отправить сообщение','Хабарлама жіберу','Send message')));
    matches(root,'.tip-card').forEach(card=>{const header=card.querySelector('.tip-card-header'),body=card.querySelector('.tip-body');if(!header||!body)return;card.removeAttribute('onclick');header.setAttribute('role','button');header.tabIndex=0;if(!body.id)body.id='tip-content-'+(++tipId);header.setAttribute('aria-controls',body.id);syncTip(card);});
  }
  function focusRoute(){
    const heading=document.querySelector('.page.active h1,.page.active h2');if(!heading)return;
    heading.tabIndex=-1;heading.classList.add('route-heading-focus');heading.focus({preventScroll:true});
    document.title=heading.innerText.replace(/\s+/g,' ').trim()+' — EduMatch KZ';
  }
  function focusDialog(dialog){
    const version=++focusVersion;
    // Newly opened menus may still be transitioning from visibility:hidden.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(version!==focusVersion||activeDialog!==dialog)return;dialog.tabIndex=-1;(visibleControls(dialog)[0]||dialog).focus({preventScroll:true});}));
  }
  function syncDialog(){
    const dialog=document.querySelector('.modal.active')||document.querySelector('.bottom-sheet.open')||document.querySelector('.mobile-menu.open');
    document.querySelectorAll(dialogSelector).forEach(el=>{el.inert=el!==dialog;el.setAttribute('aria-hidden',String(el!==dialog));});
    if(dialog===activeDialog){if(dialog)document.body.style.overflow='hidden';return;}
    const old=activeDialog;activeDialog=dialog;++focusVersion;
    if(dialog){
      if(!old)returnFocus=document.activeElement;
      dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
      const title=dialog.querySelector('h1,h2,h3,.sheet-title,.mobile-menu-title');
      if(title){if(!title.id)title.id=(dialog.id||'site-dialog')+'-title';dialog.setAttribute('aria-labelledby',title.id);}
      else dialog.setAttribute('aria-label',copy('Меню','Мәзір','Menu'));
      document.getElementById('app').inert=!dialog.closest('#app');document.querySelector('.footer').inert=!dialog.closest('.footer');document.getElementById('nav').inert=!dialog.closest('#nav');
      document.body.style.overflow='hidden';document.getElementById('mobile-tabs')?.setAttribute('inert','');focusDialog(dialog);
    }else{
      document.getElementById('app').inert=false;document.querySelector('.footer').inert=false;document.getElementById('nav').inert=false;document.getElementById('mobile-tabs')?.removeAttribute('inert');document.body.style.overflow='';
      if(routePending){routePending=false;focusRoute();}else if(isVisible(returnFocus))returnFocus.focus({preventScroll:true});returnFocus=null;
    }
  }
  window.syncSiteDialog=syncDialog;
  function onRoute(){
    const page=window.state?.currentPage;
    document.querySelectorAll('a[data-route]').forEach(link=>{if(link.dataset.route===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    syncMobileShell();syncDialog();if(activeDialog){routePending=true;returnFocus=null;}else focusRoute();
  }
  function syncMobileShell(){
    const mobile=window.matchMedia('(max-width:768px)').matches;
    const page=window.state?.currentPage;
    const enabled=mobile&&!['advisor','login','register'].includes(page);
    const editing=document.activeElement?.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]');
    const keyboard=editing&&window.visualViewport&&window.innerHeight-window.visualViewport.height>120;
    document.body.classList.toggle('mobile-nav-enabled',enabled);
    document.body.classList.toggle('mobile-keyboard-open',!!keyboard);
    const tabs=document.getElementById('mobile-tabs');
    if(tabs)tabs.inert=!!activeDialog;
  }
  document.addEventListener('keydown',event=>{
    if(activeDialog&&event.key==='Tab'){
      const controls=visibleControls(activeDialog).filter(el=>el.tabIndex>=0);
      event.preventDefault();
      if(!controls.length){activeDialog.focus();return;}
      const index=controls.indexOf(document.activeElement),next=index<0?(event.shiftKey?controls.length-1:0):(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
      controls[next].focus();
    }
    if(activeDialog&&event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();
      if(typeof activeDialog.closeDialog==='function')activeDialog.closeDialog();
      else if(activeDialog.id==='mobile-menu')window.closeMobileMenu();
      else if(activeDialog.classList.contains('modal'))window.closeModal();
      else window.closeSheet(activeDialog.id+'-overlay',activeDialog.id);syncDialog();
    }
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('a[role="button"],.tip-card-header[role="button"]')){event.preventDefault();event.target.click();}
  },true);
  document.addEventListener('click',event=>{if(event.target.closest('a[data-route]'))event.preventDefault();},true);
  document.addEventListener('click',event=>{const header=event.target.closest('.tip-card-header[role="button"]');if(!header)return;const card=header.closest('.tip-card');card.classList.toggle('open');syncTip(card);});
  document.addEventListener('DOMContentLoaded',()=>{
    if(typeof AOS==='undefined')document.documentElement.classList.add('no-motion-library');enhance();
    const tabs=document.getElementById('mobile-tabs');
    if(tabs){tabs.setAttribute('aria-label',copy('Основные разделы','Негізгі бөлімдер','Main sections'));const names={home:copy('Каталог','Каталог','Explore'),planner:copy('План','Жоспар','Plan'),grants:copy('Гранты','Гранттар','Funding'),advisor:copy('Чат','Чат','Chat'),profile:copy('Профиль','Профиль','Profile')};tabs.querySelectorAll('.mobile-tab').forEach(link=>link.querySelector('span').textContent=names[link.dataset.route]);}
    window.addEventListener('resize',syncMobileShell,{passive:true});
    window.visualViewport?.addEventListener('resize',syncMobileShell,{passive:true});
    const compareBar=document.getElementById('sticky-compare');
    if(compareBar&&typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{
      // Wrapped actions make the bar taller on narrow screens and in translation.
      document.documentElement.style.setProperty('--compare-bar-height',Math.ceil(compareBar.getBoundingClientRect().height)+'px');
    }).observe(compareBar);
    document.addEventListener('focusin',syncMobileShell);
    document.addEventListener('focusout',()=>requestAnimationFrame(syncMobileShell));
    const skip=document.querySelector('.skip-link');skip.textContent=copy('Перейти к содержимому','Мазмұнға өту','Skip to content');skip.onclick=event=>{event.preventDefault();const current=document.querySelector('.page.active');current.tabIndex=-1;current.focus();};
    ['search-input','map-search','chat-input'].forEach(id=>{const input=document.getElementById(id);if(input)input.setAttribute('aria-label',input.placeholder||copy('Поиск университета','Университетті іздеу','Search universities'));});
    ['toggleMobileMenu','closeMobileMenu','openModal','closeModal','openSheet','closeSheet'].forEach(name=>{const original=window[name];if(typeof original!=='function')return;window[name]=function(...args){const result=original.apply(this,args);syncDialog();return result;};});
    const observer=new MutationObserver(records=>{
      const additions=new Set();let dialogsChanged=false;
      for(const record of records){
        if(record.type==='attributes'){
          if(record.target.matches('.btn-favorite'))syncFavorite(record.target);
          if(record.target.matches('.tip-card'))syncTip(record.target);
          if(record.target.matches(dialogSelector))dialogsChanged=true;
        }else{
          record.addedNodes.forEach(node=>{if(node.nodeType===1){additions.add(node);if(node.matches(dialogSelector)||node.querySelector(dialogSelector))dialogsChanged=true;}});
          record.removedNodes.forEach(node=>{if(activeDialog&&(node===activeDialog||node.contains?.(activeDialog)))dialogsChanged=true;});
        }
      }
      additions.forEach(node=>{if(node.isConnected&&![...additions].some(other=>other!==node&&other.contains(node)))enhance(node);});if(dialogsChanged)syncDialog();
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','title']});
    window.addEventListener('edumatch-route-changed',onRoute);onRoute();syncDialog();
  });
})();
