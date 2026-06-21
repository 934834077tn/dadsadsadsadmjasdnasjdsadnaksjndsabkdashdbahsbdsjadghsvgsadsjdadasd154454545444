/**
 * Nutro Cloud Auto-Translation + Currency Conversion
 * Works on ALL pages. Watches AJAX-loaded prices via MutationObserver.
 * Called by main.js after header is loaded into DOM.
 */
(function(){
  'use strict';

  var LANGS = {
    en: {flag:'us', currency:'USD', symbol:'$', rate:1, dir:'ltr', name:'English'},
    ar: {flag:'eg', currency:'EGP', symbol:'ج.م', rate:53, dir:'rtl', name:'العربية'},
    es: {flag:'es', currency:'EUR', symbol:'€', rate:0.92, dir:'ltr', name:'Español'},
    fr: {flag:'fr', currency:'EUR', symbol:'€', rate:0.92, dir:'ltr', name:'Français'},
    de: {flag:'de', currency:'EUR', symbol:'€', rate:0.92, dir:'ltr', name:'Deutsch'},
    pt: {flag:'br', currency:'BRL', symbol:'R$', rate:5.5, dir:'ltr', name:'Português'},
    hi: {flag:'in', currency:'INR', symbol:'₹', rate:83, dir:'ltr', name:'हिन्दी'},
    zh: {flag:'cn', currency:'CNY', symbol:'¥', rate:7.2, dir:'ltr', name:'中文'}
  };

  var currentLang = 'en';
  var observer = null;
  var langCache = {};
  var priceRegex = /\$(\d+(?:\.\d{1,2})?)/g;

  // ========== CURRENCY ==========
  function convertPrice(usdStr, lang){
    var info = LANGS[lang];
    if(!info || lang === 'en') return '$' + usdStr;
    var usd = parseFloat(usdStr);
    var converted = usd * info.rate;
    if(converted >= 1000) converted = Math.round(converted);
    else if(converted === Math.floor(converted)) converted = Math.floor(converted);
    else converted = converted.toFixed(2);
    return info.symbol + converted;
  }

  function processTextNode(node){
    if(!node || !node.nodeValue) return;
    var text = node.nodeValue;
    if(!priceRegex.test(text)) return;
    priceRegex.lastIndex = 0;
    if(!node._nutroOrig) node._nutroOrig = text;
    if(currentLang === 'en'){
      node.nodeValue = node._nutroOrig;
    } else {
      node.nodeValue = node._nutroOrig.replace(priceRegex, function(m, num){
        return convertPrice(num, currentLang);
      });
    }
  }

  function walkAndConvert(root){
    if(!root) root = document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        var p = node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;
        var t = p.tagName;
        if(t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT'||t==='CODE') return NodeFilter.FILTER_REJECT;
        if(p.classList && p.classList.contains('notranslate')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()) processTextNode(walker.currentNode);
  }

  // ========== i18n DICT ==========
  function loadLang(lang, cb){
    if(langCache[lang]) return cb(langCache[lang]);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/assets/lang/' + lang + '.json?v=3', true);
    xhr.onload = function(){
      try{ langCache[lang] = JSON.parse(xhr.responseText); } catch(e){ langCache[lang] = {}; }
      cb(langCache[lang]);
    };
    xhr.onerror = function(){ langCache[lang] = {}; cb({}); };
    xhr.send();
  }

  function applyDict(dict){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      if(!dict[key]) return;
      if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') el.placeholder = dict[key];
      else el.textContent = dict[key];
    });
  }

  // ========== DIRECTION + HEADER ==========
  function setDirection(lang){
    var info = LANGS[lang];
    document.documentElement.dir = info.dir;
    document.documentElement.lang = lang;
  }

  function updateHeader(lang){
    var info = LANGS[lang];
    var flag = document.getElementById('currentLangFlag');
    var code = document.getElementById('currentLangCode');
    if(flag) flag.src = 'https://flagcdn.com/w40/' + info.flag + '.png';
    if(code) code.textContent = lang.toUpperCase();
  }

  // ========== SEO hreflang ==========
  function injectHreflang(){
    document.querySelectorAll('link[data-nutro-hl]').forEach(function(el){ el.remove(); });
    var base = location.origin + location.pathname;
    Object.keys(LANGS).forEach(function(l){
      var link = document.createElement('link');
      link.rel='alternate'; link.hreflang=l;
      link.href = base + (l==='en'?'':'?lang='+l);
      link.setAttribute('data-nutro-hl','1');
      document.head.appendChild(link);
    });
    var xd = document.createElement('link');
    xd.rel='alternate'; xd.hreflang='x-default'; xd.href=base;
    xd.setAttribute('data-nutro-hl','1');
    document.head.appendChild(xd);
  }

  // ========== OBSERVER ==========
  function startObserver(){
    if(observer) observer.disconnect();
    observer = new MutationObserver(function(mutations){
      if(currentLang === 'en') return;
      mutations.forEach(function(m){
        m.addedNodes.forEach(function(node){
          if(node.nodeType === 3) processTextNode(node);
          else if(node.nodeType === 1) walkAndConvert(node);
        });
      });
    });
    observer.observe(document.body, {childList:true, subtree:true, characterData:true});
  }

  // ========== SWITCH ==========
  function switchLang(lang){
    if(!LANGS[lang]) return;
    currentLang = lang;
    localStorage.setItem('nutro_lang', lang);
    var url = new URL(location);
    if(lang==='en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    history.replaceState({}, '', url);

    setDirection(lang);
    updateHeader(lang);
    loadLang(lang, function(dict){
      if(Object.keys(dict).length > 0) applyDict(dict);
    });
    walkAndConvert(document.body);
  }

  // ========== DETECT ==========
  function detect(){
    var p = new URLSearchParams(location.search);
    var u = p.get('lang');
    if(u && LANGS[u]) return u;
    var s = localStorage.getItem('nutro_lang');
    if(s && LANGS[s]) return s;
    return 'en';
  }

  // ========== INIT (called after header is in DOM) ==========
  function init(){
    // Bind language buttons in header
    document.querySelectorAll('.nutro-lang-btn').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        switchLang(this.getAttribute('data-lang'));
      });
    });

    injectHreflang();
    var lang = detect();
    currentLang = lang;
    updateHeader(lang);
    if(lang !== 'en') switchLang(lang);
    startObserver();
  }

  // Expose init for main.js to call after header loads
  window.nutroTranslateInit = init;

  // Also expose manual API
  window.nutroTranslate = {
    switchLang: switchLang,
    getLang: function(){ return currentLang; },
    LANGS: LANGS
  };
})();
