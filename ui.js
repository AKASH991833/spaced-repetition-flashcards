/* Shared UI helpers: theme, toast, PWA */
(function(){
  const root=document.documentElement;
  const saved=localStorage.getItem('theme');
  if(saved) root.dataset.theme=saved;
  else if(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches) root.dataset.theme='dark';
  window.toggleTheme=function(){
    const next=root.dataset.theme==='dark'?'light':'dark';
    root.dataset.theme=next;localStorage.setItem('theme',next);
  };
  window.toast=function(msg,ms){
    let wrap=document.querySelector('.toast-wrap');
    if(!wrap){wrap=document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap);}
    const t=document.createElement('div');t.className='toast';t.textContent=msg;wrap.appendChild(t);
    setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),320);},ms||2600);
  };
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
  }
  window.esc=function(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
  window.download=function(filename,content,mime){
    const blob=content instanceof Blob?content:new Blob([content],{type:mime||'text/plain'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  };
})();
