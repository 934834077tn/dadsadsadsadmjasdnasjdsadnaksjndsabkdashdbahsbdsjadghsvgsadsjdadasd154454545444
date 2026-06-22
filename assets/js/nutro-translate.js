/**
 * Nutro Cloud i18n + Currency v6
 * - Smarter price conversion (only converts standalone price elements)
 * - _textMap for broad English→Arabic text replacement
 * - Waits for dynamically loaded header
 * - Handles AJAX-loaded pricing plans
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

  // ===== PRICE CONVERSION =====
  // Only match full price strings like "$1.98/mo" or "US$ 288.52"
  // Avoids matching partial numbers in sentences
  var PRICE_RE = /(?:US\s?\$|USD|\$)\s?(\d[\d,]*(?:\.\d{1,2})?)/g;

  function convertPriceText(original, info){
    PRICE_RE.lastIndex = 0;
    return original.replace(PRICE_RE, function(match, numStr){
      var n = parseFloat(numStr.replace(/,/g,''));
      if(isNaN(n)) return match;
      var c = n * info.rate;
      var formatted;
      if(c >= 1000) formatted = Math.round(c).toLocaleString('en');
      else if(c === Math.floor(c)) formatted = c.toString();
      else formatted = c.toFixed(2);
      return info.symbol + formatted;
    });
  }

  function processTextNode(node){
    if(!node || node.nodeType !== 3) return;
    var p = node.parentElement;
    if(!p) return;
    var tag = p.tagName;
    if(tag==='SCRIPT'||tag==='STYLE'||tag==='NOSCRIPT'||tag==='TEXTAREA') return;

    var text = node.nodeValue;
    if(!text) return;
    PRICE_RE.lastIndex = 0;
    if(!PRICE_RE.test(text)) return;
    PRICE_RE.lastIndex = 0;

    if(!originals.has(node)) originals.set(node, text);
    var original = originals.get(node);

    if(currentLang === 'en'){
      node.nodeValue = original;
    } else {
      node.nodeValue = convertPriceText(original, LANGS[currentLang]);
    }
  }

  function scanPrices(){
    if(!document.body) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while(w.nextNode()) processTextNode(w.currentNode);
  }

  // ===== TEXT MAP TRANSLATION =====
  // Replaces exact English text with Arabic throughout the page
  var textMapApplied = new Map(); // node → original

  function applyTextMap(map){
    if(!map || typeof map !== 'object') return;
    var entries = Object.entries(map);
    if(entries.length === 0) return;

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while(walker.nextNode()){
      var node = walker.currentNode;
      var p = node.parentElement;
      if(!p) continue;
      var tag = p.tagName;
      if(tag==='SCRIPT'||tag==='STYLE'||tag==='NOSCRIPT') continue;

      var text = node.nodeValue;
      if(!text || text.trim().length < 2) continue;
      var trimmed = text.trim();

      // Exact match
      if(map[trimmed]){
        if(!textMapApplied.has(node)) textMapApplied.set(node, text);
        node.nodeValue = text.replace(trimmed, map[trimmed]);
        continue;
      }

      // Partial match (for longer sentences containing keywords)
      for(var i = 0; i < entries.length; i++){
        var en = entries[i][0];
        var ar = entries[i][1];
        if(en.length >= 4 && text.indexOf(en) !== -1){
          if(!textMapApplied.has(node)) textMapApplied.set(node, text);
          node.nodeValue = node.nodeValue.replace(en, ar);
        }
      }
    }
  }

  function revertTextMap(){
    textMapApplied.forEach(function(original, node){
      if(node.parentNode) node.nodeValue = original;
    });
    textMapApplied.clear();
  }

  // ===== DICTIONARY =====
  function loadDict(lang, cb){
    if(langCache[lang]) return cb(langCache[lang]);
    var x = new XMLHttpRequest();
    x.open('GET', '/assets/lang/' + lang + '.json?v=6', true);
    x.onload = function(){
      try{ langCache[lang] = JSON.parse(x.responseText); }
      catch(e){ langCache[lang] = {}; }
      cb(langCache[lang]);
    };
    x.onerror = function(){ langCache[lang] = {}; cb({}); };
    x.send();
  }

  function applyDict(d){
    // data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var k = el.getAttribute('data-i18n');
      if(!d[k]) return;
      if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') el.placeholder = d[k];
      else el.textContent = d[k];
    });

    // _textMap for broad replacement
    if(d._textMap) applyTextMap(d._textMap);
  }

  // ===== UI =====
  function setDir(lang){
    document.documentElement.dir = LANGS[lang].dir;
    document.documentElement.lang = lang;
  }

  function updateBtn(lang){
    var f = document.getElementById('currentLangFlag');
    var c = document.getElementById('currentLangCode');
    if(f) f.src = 'https://flagcdn.com/w40/' + LANGS[lang].flag + '.png';
    if(c) c.textContent = lang.toUpperCase();
  }

  // ===== MAIN SWITCH =====
  function switchLang(lang){
    if(!LANGS[lang]) return;

    // Revert everything first
    originals.forEach(function(original, node){
      if(node.parentNode) node.nodeValue = original;
    });
    revertTextMap();

    currentLang = lang;
    localStorage.setItem('nutro_lang', lang);
    var u = new URL(location);
    if(lang==='en') u.searchParams.delete('lang');
    else u.searchParams.set('lang', lang);
    history.replaceState({}, '', u);

    setDir(lang);
    updateBtn(lang);

    if(lang === 'en') return; // Already reverted

    loadDict(lang, function(d){
      if(Object.keys(d).length) applyDict(d);
      scanPrices();
      startRescan();
    });
  }

  function startRescan(){
    if(scanTimer) clearInterval(scanTimer);
    if(currentLang === 'en') return;
    var c = 0;
    scanTimer = setInterval(function(){
      scanPrices();
      // Also re-apply textMap for newly loaded content
      if(langCache[currentLang] && langCache[currentLang]._textMap){
        applyTextMap(langCache[currentLang]._textMap);
      }
      c++;
      if(c >= 30) clearInterval(scanTimer);
    }, 500);
  }

  function detect(){
    var p = new URLSearchParams(location.search);
    var u = p.get('lang'); if(u && LANGS[u]) return u;
    var s = localStorage.getItem('nutro_lang'); if(s && LANGS[s]) return s;
    return 'en';
  }

  // ===== BIND BUTTONS =====
  function bindButtons(){
    var btns = document.querySelectorAll('.nutro-lang-btn');
    if(btns.length === 0) return false;
    btns.forEach(function(btn){
      if(btn._nutrobound) return;
      btn._nutrobound = true;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        switchLang(this.getAttribute('data-lang'));
      });
    });
    return true;
  }

  function waitForHeader(){
    if(bindButtons()) return;
    var attempts = 0;
    var check = setInterval(function(){
      if(bindButtons() || attempts >= 20){ clearInterval(check); }
      attempts++;
    }, 300);
    // Also observe #header div
    var hDiv = document.getElementById('header');
    if(hDiv){
      var obs = new MutationObserver(function(){ bindButtons(); });
      obs.observe(hDiv, {childList:true, subtree:true});
    }
  }

  // ===== INIT =====
  function init(){
    var lang = detect();
    currentLang = lang;

    function onReady(){
      waitForHeader();
      updateBtn(lang);
      if(lang !== 'en') switchLang(lang);

      // Watch for AJAX content
      if(window.MutationObserver){
        var mo = new MutationObserver(function(muts){
          if(currentLang === 'en') return;
          var hasNew = false;
          muts.forEach(function(m){
            if(m.addedNodes.length) hasNew = true;
          });
          if(hasNew){
            setTimeout(function(){
              scanPrices();
              if(langCache[currentLang] && langCache[currentLang]._textMap){
                applyTextMap(langCache[currentLang]._textMap);
              }
            }, 100);
          }
        });
        mo.observe(document.body, {childList:true, subtree:true});
      }
    }

    if(document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
  }

  init();
  window.nutroTranslate = {switchLang:switchLang, getLang:function(){return currentLang;}, rescan:scanPrices};
})();
