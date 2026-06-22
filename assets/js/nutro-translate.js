/**
 * Nutro Cloud i18n + Currency v5
 * Fixes: waits for header to load before binding language buttons
 * Periodic rescan for AJAX prices
 */
(function(){
  'use strict';

  var LANGS = {
    en: {flag:'us', symbol:'$', rate:1, dir:'ltr'},
    ar: {flag:'eg', symbol:'ج.م', rate:53, dir:'rtl'},
    es: {flag:'es', symbol:'€', rate:0.92, dir:'ltr'},
    fr: {flag:'fr', symbol:'€', rate:0.92, dir:'ltr'},
    de: {flag:'de', symbol:'€', rate:0.92, dir:'ltr'},
    pt: {flag:'br', symbol:'R$', rate:5.5, dir:'ltr'},
    hi: {flag:'in', symbol:'₹', rate:83, dir:'ltr'},
    zh: {flag:'cn', symbol:'¥', rate:7.2, dir:'ltr'}
  };

  var currentLang = 'en';
  var originals = new Map();
  var langCache = {};
  var scanTimer = null;

  // Price regex: US$1.98, US$ 288, $2.99, USD 5.99
  var RE = /(?:US\s?\$\s?|USD\s?|\$)\s?(\d[\d,]*(?:\.\d{1,2})?)/g;

  function convert(numStr){
    var info = LANGS[currentLang];
    var n = parseFloat(numStr.replace(/,/g,''));
    if(isNaN(n)) return null;
    if(currentLang==='en') return null; // keep original
    var c = n * info.rate;
    if(c>=100) c = Math.round(c);
    else c = Math.round(c*100)/100;
    var formatted = c>=1000 ? c.toLocaleString('en') : (c===Math.floor(c)?c.toString():c.toFixed(2));
    return info.symbol + formatted;
  }

  function processNode(node){
    if(!node||node.nodeType!==3) return;
    var p = node.parentElement;
    if(!p) return;
    var t = p.tagName;
    if(t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT'||t==='TEXTAREA') return;

    var text = node.nodeValue;
    if(!text) return;
    RE.lastIndex=0;
    if(!RE.test(text)) return;
    RE.lastIndex=0;

    if(!originals.has(node)) originals.set(node, text);

    if(currentLang==='en'){
      node.nodeValue = originals.get(node);
      return;
    }

    node.nodeValue = originals.get(node).replace(RE, function(match, num){
      var r = convert(num);
      return r || match;
    });
  }

  function scanAll(){
    if(!document.body) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while(w.nextNode()) processNode(w.currentNode);
  }

  // Dictionary
  function loadDict(lang, cb){
    if(langCache[lang]) return cb(langCache[lang]);
    var x = new XMLHttpRequest();
    x.open('GET','/assets/lang/'+lang+'.json?v=5',true);
    x.onload=function(){
      try{langCache[lang]=JSON.parse(x.responseText);}catch(e){langCache[lang]={};}
      cb(langCache[lang]);
    };
    x.onerror=function(){langCache[lang]={};cb({});};
    x.send();
  }

  function applyDict(d){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var k=el.getAttribute('data-i18n');
      if(!d[k])return;
      if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') el.placeholder=d[k];
      else el.textContent=d[k];
    });
  }

  function setDir(lang){
    document.documentElement.dir=LANGS[lang].dir;
    document.documentElement.lang=lang;
  }

  function updateBtn(lang){
    var f=document.getElementById('currentLangFlag');
    var c=document.getElementById('currentLangCode');
    if(f) f.src='https://flagcdn.com/w40/'+LANGS[lang].flag+'.png';
    if(c) c.textContent=lang.toUpperCase();
  }

  function switchLang(lang){
    if(!LANGS[lang]) return;
    currentLang=lang;
    localStorage.setItem('nutro_lang',lang);
    var u=new URL(location);
    if(lang==='en') u.searchParams.delete('lang');
    else u.searchParams.set('lang',lang);
    history.replaceState({},'',u);
    setDir(lang);
    updateBtn(lang);
    loadDict(lang,function(d){if(Object.keys(d).length)applyDict(d);});
    scanAll();
    startRescan();
  }

  function startRescan(){
    if(scanTimer) clearInterval(scanTimer);
    if(currentLang==='en') return;
    var c=0;
    scanTimer=setInterval(function(){
      scanAll(); c++;
      if(c>=30) clearInterval(scanTimer);
    },500);
  }

  function detect(){
    var p=new URLSearchParams(location.search);
    var u=p.get('lang'); if(u&&LANGS[u]) return u;
    var s=localStorage.getItem('nutro_lang'); if(s&&LANGS[s]) return s;
    return 'en';
  }

  // Bind language buttons - with retry for dynamically loaded header
  function bindButtons(){
    var btns = document.querySelectorAll('.nutro-lang-btn');
    if(btns.length===0) return false;
    btns.forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        switchLang(this.getAttribute('data-lang'));
      });
    });
    return true;
  }

  function waitForHeader(){
    // Try immediately
    if(bindButtons()) return;
    // Retry every 300ms for up to 5 seconds (header loads via AJAX)
    var attempts=0;
    var check=setInterval(function(){
      if(bindButtons()||attempts>=16){
        clearInterval(check);
      }
      attempts++;
    },300);
  }

  // Also use MutationObserver to catch when header is injected
  function observeHeaderLoad(){
    var headerDiv = document.getElementById('header');
    if(!headerDiv) return;
    var obs = new MutationObserver(function(){
      bindButtons();
      obs.disconnect();
    });
    obs.observe(headerDiv, {childList:true, subtree:true});
  }

  function init(){
    var lang=detect();
    currentLang=lang;

    // Wait for DOM
    function onReady(){
      waitForHeader();
      observeHeaderLoad();
      updateBtn(lang);
      if(lang!=='en') switchLang(lang);

      // Watch for dynamically added content (AJAX plans etc)
      if(window.MutationObserver){
        var mo=new MutationObserver(function(muts){
          if(currentLang==='en') return;
          muts.forEach(function(m){
            if(m.addedNodes) m.addedNodes.forEach(function(n){
              if(n.nodeType===1){
                var w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT,null);
                while(w.nextNode()) processNode(w.currentNode);
              } else if(n.nodeType===3) processNode(n);
            });
          });
        });
        mo.observe(document.body,{childList:true,subtree:true});
      }
    }

    if(document.readyState==='loading')
      document.addEventListener('DOMContentLoaded',onReady);
    else onReady();
  }

  init();

  window.nutroTranslate={switchLang:switchLang,getLang:function(){return currentLang;},rescan:scanAll};
})();
