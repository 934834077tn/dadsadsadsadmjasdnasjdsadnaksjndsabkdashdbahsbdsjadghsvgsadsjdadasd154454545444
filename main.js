// NutroCloud Main.js - يعمل مع جميع القوائم والصفحات

document.addEventListener('DOMContentLoaded', function() {
    const headerElement = document.getElementById('header');
    const footerElement = document.getElementById('footer');

    // تحميل الهيدر
    if (headerElement) {
        fetch('header.html')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(data => {
                headerElement.innerHTML = data;
                // Execute scripts inside loaded header
                headerElement.querySelectorAll('script').forEach(function(oldScript){
                    var newScript = document.createElement('script');
                    if(oldScript.src) newScript.src = oldScript.src;
                    else newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                // Init translation system after header is in DOM
                if(window.nutroTranslateInit) window.nutroTranslateInit();
            })
            .catch(error => console.log('Header could not be loaded:', error));
    }

    // تحميل الفوتر
    if (footerElement) {
        fetch('footer.html')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(data => {
                footerElement.innerHTML = data;
            })
            .catch(error => console.log('Footer could not be loaded:', error));
    }

    console.log('NutroCloud main.js loaded successfully');
});

// تفعيل جميع القوائم المنسدلة (submenus) في كل الصفحات ولكل القوائم
document.addEventListener("click", function(event) {
    let mainLink = event.target.closest('.main');
    if (mainLink) {
        event.preventDefault();

        // إغلاق أي قائمة أخرى مفتوحة (اختياري)
        document.querySelectorAll('.submenu.mm-show').forEach(function(openSubmenu) {
            if (openSubmenu !== mainLink.nextElementSibling) {
                openSubmenu.classList.remove('mm-show');
                openSubmenu.classList.add('mm-collapse');
            }
        });

        // فتح/إغلاق القائمة الخاصة بالعنصر الحالي
        let submenu = mainLink.nextElementSibling;
        if (submenu && submenu.classList.contains('submenu')) {
            submenu.classList.toggle('mm-show');
            submenu.classList.toggle('mm-collapse');
        }
    }
});

// ===== AUTO TRANSLATION LOADER (works on ALL pages) =====
(function(){
  // Detect language
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') || localStorage.getItem('nutro_lang') || 'en';
  var langMap = {ar:'arabic',es:'spanish',fr:'french',de:'german',pt:'portuguese',hi:'hindi',zh:'chinese_simplified'};

  // Load nutro-translate.js (currency + loader + buttons)
  var ntScript = document.createElement('script');
  ntScript.src = '/assets/js/nutro-translate.js';
  document.head.appendChild(ntScript);

  // Load translate.js and initialize
  if(lang !== 'en' && langMap[lang]){
    var tScript = document.createElement('script');
    tScript.src = 'https://cdn.staticfile.net/translate.js/3.18.66/translate.js';
    tScript.onload = function(){
      translate.language.setLocal('english');
      translate.service.use('client.edge');
      translate.listener.start();
      translate.ignore.tag.push('script','style');
      translate.execute();
      translate.changeLanguage(langMap[lang]);
    };
    document.head.appendChild(tScript);
  }
})();
