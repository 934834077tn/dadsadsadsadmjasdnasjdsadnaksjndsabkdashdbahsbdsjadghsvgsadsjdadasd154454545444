/**
 * Nutro Cloud Translation v7
 * Strategy: reload page with ?lang=xx → translate.js handles everything
 * Loading overlay stays until translation completes
 * Price conversion runs after translate.js finishes
 */
(function(){
  'use strict';

  var LANGS = {
    en: {flag:'us', symbol:'$', rate:1, dir:'ltr', welcome:'Welcome to Nutro', emoji:'🇺🇸'},
    ar: {flag:'eg', symbol:'ج.م', rate:53, dir:'rtl', welcome:'أهلاً بك في نيترو', emoji:'🇪🇬'},
    es: {flag:'es', symbol:'€', rate:0.92, dir:'ltr', welcome:'Bienvenido a Nutro', emoji:'🇪🇸'},
    fr: {flag:'fr', symbol:'€', rate:0.92, dir:'ltr', welcome:'Bienvenue sur Nutro', emoji:'🇫🇷'},
    de: {flag:'de', symbol:'€', rate:0.92, dir:'ltr', welcome:'Willkommen bei Nutro', emoji:'🇩🇪'},
    pt: {flag:'br', symbol:'R$', rate:5.5, dir:'ltr', welcome:'Bem-vindo ao Nutro', emoji:'🇧🇷'},
    hi: {flag:'in', symbol:'₹', rate:83, dir:'ltr', welcome:'नूट्रो में स्वागत है', emoji:'🇮🇳'},
    zh: {flag:'cn', symbol:'¥', rate:7.2, dir:'ltr', welcome:'欢迎来到 Nutro', emoji:'🇨🇳'}
  };

  var currentLang = detect();
  var PRICE_RE = /(?:US\s?\$|USD|\$)\s?(\d[\d,]*(?:\.\d{1,2})?)/g;

  function detect(){
    var p = new URLSearchParams(location.search);
    var u = p.get('lang'); if(u && LANGS[u]) return u;
    var s = localStorage.getItem('nutro_lang'); if(s && LANGS[s]) return s;
    return 'en';
  }

  // ===== LOADING SCREEN =====
  function showLoader(lang){
    var info = LANGS[lang];
    var el = document.createElement('div');
    el.id = 'nutro-lang-overlay';
    el.innerHTML = '<div class="nlo-box">' +
      '<div class="nlo-emoji">' + info.emoji + '</div>' +
      '<div class="nlo-text">' + info.welcome + '</div>' +
      '<div class="nlo-dots"><span></span><span></span><span></span></div>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('show'); });
  }

  function hideLoader(){
    var el = document.getElementById('nutro-lang-overlay');
    if(!el) return;
    el.classList.add('done');
    setTimeout(function(){ if(el.parentNode) el.remove(); }, 500);
  }

  // ===== INJECT LOADER CSS =====
  function injectLoaderCSS(){
    var s = document.createElement('style');
    s.textContent = '#nutro-lang-overlay{position:fixed;inset:0;z-index:999999;' +
      'background:#fff;display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity .3s ease;}' +
      '#nutro-lang-overlay.show{opacity:1;}' +
      '#nutro-lang-overlay.done{opacity:0;pointer-events:none;}' +
      '.nlo-box{text-align:center;animation:nlo-enter .6s cubic-bezier(.4,0,.2,1) both;}' +
      '@keyframes nlo-enter{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}' +
      '.nlo-emoji{font-size:56px;margin-bottom:16px;}' +
      '.nlo-text{font-size:22px;font-weight:700;color:#1e293b;margin-bottom:20px;font-family:Inter,sans-serif;}' +
      '.nlo-dots{display:flex;gap:6px;justify-content:center;}' +
      '.nlo-dots span{width:8px;height:8px;border-radius:50%;background:#0774FF;animation:nlo-pulse 1.2s ease-in-out infinite;}' +
      '.nlo-dots span:nth-child(2){animation-delay:.2s;}' +
      '.nlo-dots span:nth-child(3){animation-delay:.4s;}' +
      '@keyframes nlo-pulse{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}';
    document.head.appendChild(s);
  }

  // ===== PRICE CONVERSION =====
  function convertPrices(){
    if(currentLang === 'en') return;
    var info = LANGS[currentLang];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    while(walker.nextNode()){
      var node = walker.currentNode;
      var p = node.parentElement;
      if(!p) continue;
      var tag = p.tagName;
      if(tag==='SCRIPT'||tag==='STYLE'||tag==='NOSCRIPT') continue;
      var text = node.nodeValue;
      if(!text) continue;
      PRICE_RE.lastIndex = 0;
      if(!PRICE_RE.test(text)) continue;
      PRICE_RE.lastIndex = 0;
      node.nodeValue = text.replace(PRICE_RE, function(match, numStr){
        var n = parseFloat(numStr.replace(/,/g,''));
        if(isNaN(n)) return match;
        var c = n * info.rate;
        var f = c>=1000 ? Math.round(c).toLocaleString('en') : (c===Math.floor(c)?c.toString():c.toFixed(2));
        return info.symbol + f;
      });
    }

    // Fix /mo → /شهر and other unit texts
    var unitMap = {
      '/mo':'/شهر', '/month':'/شهر', '/yr':'/سنة', '/year':'/سنة',
      'Renews at':'يتجدد بـ', 'for the first':'لأول',
      'months':'شهر', 'US$':'', 'USD':'', 'MOST POPULAR':'الأكثر شعبية'
    };
    if(currentLang === 'ar'){
      document.querySelectorAll('.pr-card, .card-plan, .pr-section, .card-plan-bg').forEach(function(card){
        var tw = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null);
        while(tw.nextNode()){
          var nd = tw.currentNode;
          var txt = nd.nodeValue;
          if(!txt) continue;
          Object.keys(unitMap).forEach(function(en){
            if(txt.indexOf(en) !== -1){
              nd.nodeValue = nd.nodeValue.split(en).join(unitMap[en]);
            }
          });
        }
      });
    }
  }

  // ===== HEADER BUTTON =====
  function updateBtn(){
    var info = LANGS[currentLang];
    var f = document.getElementById('currentLangFlag');
    var c = document.getElementById('currentLangCode');
    if(f) f.src = 'https://flagcdn.com/w40/' + info.flag + '.png';
    if(c) c.textContent = currentLang.toUpperCase();
  }

  // ===== BIND LANGUAGE BUTTONS (redirect approach) =====
  function bindButtons(){
    var btns = document.querySelectorAll('.nutro-lang-btn');
    if(btns.length === 0) return false;
    btns.forEach(function(btn){
      if(btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var lang = this.getAttribute('data-lang');
        if(lang === currentLang) return;
        localStorage.setItem('nutro_lang', lang);
        // Reload with ?lang=xx to get clean translation
        var u = new URL(location);
        if(lang === 'en') u.searchParams.delete('lang');
        else u.searchParams.set('lang', lang);
        location.href = u.toString();
      });
    });
    return true;
  }

  function waitForHeader(){
    if(bindButtons()) return;
    var tries = 0;
    var iv = setInterval(function(){
      if(bindButtons() || tries >= 20) clearInterval(iv);
      tries++;
    }, 300);
    var hDiv = document.getElementById('header');
    if(hDiv){
      new MutationObserver(function(){ bindButtons(); }).observe(hDiv, {childList:true, subtree:true});
    }
  }

  // ===== SEO: hreflang =====
  function injectHreflang(){
    var base = location.origin + location.pathname;
    Object.keys(LANGS).forEach(function(l){
      var link = document.createElement('link');
      link.rel = 'alternate'; link.hreflang = l;
      link.href = base + (l === 'en' ? '' : '?lang=' + l);
      document.head.appendChild(link);
    });
    var xd = document.createElement('link');
    xd.rel = 'alternate'; xd.hreflang = 'x-default'; xd.href = base;
    document.head.appendChild(xd);
  }

  // ===== INIT =====
  function init(){
    injectLoaderCSS();
    var info = LANGS[currentLang];

    // Set direction immediately
    document.documentElement.dir = info.dir;
    document.documentElement.lang = currentLang;

    // If non-English, show loader and wait for translate.js to finish
    if(currentLang !== 'en'){
      showLoader(currentLang);

      // Wait for translate.js to finish translating, then convert prices & hide loader
      var checkCount = 0;
      var checker = setInterval(function(){
        checkCount++;
        convertPrices();
        // Hide after translate.js has had enough time (3.5s max)
        if(checkCount >= 7){
          clearInterval(checker);
          hideLoader();
        }
      }, 500);
    }

    // On DOM ready
    function onReady(){
      waitForHeader();
      updateBtn();
      injectHreflang();

      // Periodic price conversion for AJAX content
      if(currentLang !== 'en'){
        var pc = 0;
        var priceIv = setInterval(function(){
          convertPrices(); pc++;
          if(pc >= 20) clearInterval(priceIv);
        }, 1000);
      }
    }

    if(document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
  }

  init();
  window.nutroTranslate = {getLang:function(){return currentLang;}, LANGS:LANGS};
})();
