/**
 * Nutro Cloud Auto-Translation + Currency Conversion
 * Works on ALL pages — no manual data attributes needed for prices.
 * Watches DOM changes (AJAX/server-loaded prices) via MutationObserver.
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
  var processedNodes = new WeakSet();

  // ========== CURRENCY CONVERSION ==========

  // Regex to match $XX.XX or $XX patterns (not inside script/style)
  var priceRegex = /\$(\d+(?:\.\d{1,2})?)/g;

  function convertPrice(usdStr, lang){
    var info = LANGS[lang];
    if(!info || lang === 'en') return '$' + usdStr;
    var usd = parseFloat(usdStr);
    var converted = usd * info.rate;
    // Clean display
    if(converted >= 1000) converted = Math.round(converted);
    else if(converted === Math.floor(converted)) converted = Math.floor(converted);
    else converted = converted.toFixed(2);
    return info.symbol + converted;
  }

  function processTextNode(node){
    if(!node || !node.nodeValue) return;
    if(processedNodes.has(node)) return;
    var text = node.nodeValue;
    if(!priceRegex.test(text)) return;
    priceRegex.lastIndex = 0;

    // Store original
    if(!node._nutroOriginal) node._nutroOriginal = text;

    if(currentLang === 'en'){
      node.nodeValue = node._nutroOriginal;
    } else {
      node.nodeValue = node._nutroOriginal.replace(priceRegex, function(match, num){
        return convertPrice(num, currentLang);
      });
    }
    processedNodes.add(node);
  }

  function walkAndConvert(root){
    if(!root) root = document.body;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        var parent = node.parentElement;
        if(!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'CODE') 
          return NodeFilter.FILTER_REJECT;
        if(parent.classList && parent.classList.contains('notranslate'))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()){
      processTextNode(walker.currentNode);
    }
  }

  function reconvertAll(){
    processedNodes = new WeakSet();
    walkAndConvert(document.body);
  }

  // ========== i18n DICTIONARY (for data-i18n elements) ==========

  function loadLang(lang, cb){
    if(langCache[lang]) return cb(langCache[lang]);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/assets/lang/' + lang + '.json?v=2', true);
    xhr.onload = function(){
      if(xhr.status === 200){
        try{ langCache[lang] = JSON.parse(xhr.responseText); }
        catch(e){ langCache[lang] = {}; }
      } else { langCache[lang] = {}; }
      cb(langCache[lang]);
    };
    xhr.onerror = function(){ langCache[lang] = {}; cb({}); };
    xhr.send();
  }

  function applyDict(dict){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      if(!dict[key]) return;
      if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
        el.placeholder = dict[key];
      } else {
        el.textContent = dict[key];
      }
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

  // ========== SEO: Dynamic hreflang ==========

  function injectHreflang(){
    // Remove old dynamic ones
    document.querySelectorAll('link[data-nutro-hreflang]').forEach(function(el){ el.remove(); });
    var base = window.location.origin + window.location.pathname;
    var langs = Object.keys(LANGS);
    langs.forEach(function(l){
      var link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = l;
      link.href = base + (l === 'en' ? '' : '?lang=' + l);
      link.setAttribute('data-nutro-hreflang', 'true');
      document.head.appendChild(link);
    });
    // x-default
    var xd = document.createElement('link');
    xd.rel = 'alternate'; xd.hreflang = 'x-default'; xd.href = base;
    xd.setAttribute('data-nutro-hreflang', 'true');
    document.head.appendChild(xd);
  }

  // ========== MUTATION OBSERVER (for AJAX-loaded prices) ==========

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
    observer.observe(document.body, {childList: true, subtree: true, characterData: true});
  }

  // ========== MAIN SWITCH ==========

  function switchLang(lang){
    if(!LANGS[lang]) return;
    currentLang = lang;
    localStorage.setItem('nutro_lang', lang);

    // URL update
    var url = new URL(window.location);
    if(lang === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);

    setDirection(lang);
    updateHeader(lang);

    // Dictionary translations (if data-i18n elements exist)
    loadLang(lang, function(dict){
      if(Object.keys(dict).length > 0) applyDict(dict);
    });

    // Auto currency conversion on entire page
    reconvertAll();
  }

  // ========== DETECT ==========

  function detect(){
    var p = new URLSearchParams(window.location.search);
    var urlLang = p.get('lang');
    if(urlLang && LANGS[urlLang]) return urlLang;
    var saved = localStorage.getItem('nutro_lang');
    if(saved && LANGS[saved]) return saved;
    return 'en';
  }

  // ========== INIT ==========

  function init(){
    // Bind language buttons
    document.querySelectorAll('.nutro-lang-btn').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        switchLang(this.getAttribute('data-lang'));
      });
    });

    // Inject hreflang for SEO
    injectHreflang();

    // Detect & apply
    var lang = detect();
    currentLang = lang;
    updateHeader(lang);
    if(lang !== 'en'){
      switchLang(lang);
    }

    // Start watching for AJAX-loaded content
    startObserver();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.nutroTranslate = {
    switchLang: switchLang,
    getLang: function(){ return currentLang; },
    LANGS: LANGS
  };
})();
