/**
 * Nutro Cloud Auto-Translation + Currency Conversion v3
 * Handles: $X.XX, US$X.XX, US$ X.XX, USD X.XX patterns
 * MutationObserver for AJAX-loaded content
 * Proper revert to original on language switch back to EN
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
  // Store originals: Map<node, originalText>
  var originals = new Map();

  // ========== PRICE REGEX ==========
  // Matches: US$1.98, US$ 288.52, $2.99, USD 5.99, US$95.52
  var pricePattern = /(?:US\$\s?|USD\s?|\$)\s?(\d{1,6}(?:[.,]\d{1,2})?)/g;

  function convertMatch(fullMatch, numStr, lang){
    var info = LANGS[lang];
    if(!info || lang === 'en') return fullMatch;
    var num = parseFloat(numStr.replace(',', '.'));
    if(isNaN(num)) return fullMatch;
    var converted = num * info.rate;
    var formatted;
    if(converted >= 100 && converted === Math.floor(converted)){
      formatted = Math.floor(converted).toLocaleString();
    } else if(converted >= 100){
      formatted = Math.round(converted).toLocaleString();
    } else {
      formatted = converted.toFixed(2);
    }
    return info.symbol + formatted;
  }

  // ========== PROCESS TEXT NODES ==========

  function hasPrice(text){
    pricePattern.lastIndex = 0;
    return pricePattern.test(text);
  }

  function processNode(node){
    if(!node || node.nodeType !== 3) return;
    var text = node.nodeValue;
    if(!text || !hasPrice(text)) return;

    // Save original on first encounter
    if(!originals.has(node)){
      originals.set(node, text);
    }

    var original = originals.get(node);

    if(currentLang === 'en'){
      node.nodeValue = original;
    } else {
      pricePattern.lastIndex = 0;
      node.nodeValue = original.replace(pricePattern, function(match, num){
        return convertMatch(match, num, currentLang);
      });
    }
  }

  function walkDOM(root){
    if(!root) root = document.body;
    if(!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        var p = node.parentElement;
        if(!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA')
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()){
      processNode(walker.currentNode);
    }
  }

  function convertAllPrices(){
    walkDOM(document.body);
  }

  // ========== i18n DICTIONARY ==========

  function loadLang(lang, cb){
    if(langCache[lang]) return cb(langCache[lang]);
    fetch('/assets/lang/' + lang + '.json?v=3')
      .then(function(r){ return r.ok ? r.json() : {}; })
      .then(function(data){ langCache[lang] = data; cb(data); })
      .catch(function(){ langCache[lang] = {}; cb({}); });
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

  // ========== SEO ==========

  function injectHreflang(){
    document.querySelectorAll('link[data-nutro-hl]').forEach(function(el){ el.remove(); });
    var base = location.origin + location.pathname;
    Object.keys(LANGS).forEach(function(l){
      var link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = l;
      link.href = base + (l === 'en' ? '' : '?lang=' + l);
      link.setAttribute('data-nutro-hl', '1');
      document.head.appendChild(link);
    });
    var xd = document.createElement('link');
    xd.rel = 'alternate'; xd.hreflang = 'x-default'; xd.href = base;
    xd.setAttribute('data-nutro-hl', '1');
    document.head.appendChild(xd);
  }

  // ========== MUTATION OBSERVER ==========

  function startObserver(){
    if(observer) observer.disconnect();
    observer = new MutationObserver(function(muts){
      if(currentLang === 'en') return;
      muts.forEach(function(m){
        if(m.type === 'characterData'){
          processNode(m.target);
        }
        if(m.addedNodes){
          m.addedNodes.forEach(function(n){
            if(n.nodeType === 3) processNode(n);
            else if(n.nodeType === 1) walkDOM(n);
          });
        }
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
    if(lang === 'en') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    history.replaceState({}, '', url);

    setDirection(lang);
    updateHeader(lang);

    // Dictionary
    loadLang(lang, function(dict){
      if(Object.keys(dict).length > 0) applyDict(dict);
    });

    // Prices (including revert to original for EN)
    convertAllPrices();
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

  // ========== INIT ==========

  function init(){
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

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.nutroTranslate = {switchLang:switchLang, getLang:function(){return currentLang;}, LANGS:LANGS};
})();
