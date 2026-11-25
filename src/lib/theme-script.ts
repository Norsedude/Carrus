// Pre-paint script: resolves a "system" theme preference so there is no flash.
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;d.classList.add('js-reveal');var m=matchMedia('(prefers-color-scheme: dark)');function a(){if(d.dataset.themePref==='system'){d.dataset.theme=m.matches?'dark':'light'}}a();m.addEventListener('change',a)}catch(e){}})();`;
