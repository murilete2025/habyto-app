/**
 * Habyto Pixels Helper
 * Carrega e injeta dinámicamente os pixels configurados no Admin
 */
(function() {
    const PIXEL_CONFIG_PATH = "https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/config/global";

    async function initPixels() {
        try {
            const response = await fetch(PIXEL_CONFIG_PATH);
            const data = await response.json();
            const fields = data.fields;

            if (!fields) return;

            // 1. FACEBOOK PIXEL
            const fbId = fields.pixel_fb?.stringValue;
            if (fbId && fbId.length > 5) {
                console.log(" Injetando Facebook Pixel:", fbId);
                injectFB(fbId);
            }

            // 2. KWAI PIXEL
            const kwaiId = fields.pixel_kwai?.stringValue;
            if (kwaiId && kwaiId.length > 5) {
                console.log(" Injetando Kwai Pixel:", kwaiId);
                injectKwai(kwaiId);
            }

        } catch (e) {
            console.error("Erro ao carregar pixels dinámicos:", e);
        }
    }

    function injectFB(id) {
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', id);
        fbq('track', 'PageView');
    }

    function injectKwai(id) {
        !function(e,t,n,s,i){"use strict";var o=e.kwaiq=e.kwaiq||[];o.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","setAnonymousId","setUserId"],o.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);return t.unshift(e),o.push(t),o}};for(var r=0;r<o.methods.length;r++){var c=o.methods[r];o[c]=o.factory(c)}o.load=function(e,t){var n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src="https://s1.kwai.net/kos/s101/nlav11109/pixel/events.js?v="+e;var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(n,s),o.instances=o.instances||{},o.instances[e]=o.factory(e),o.instances[e].ready=function(n){var s="readyCallbacks_"+e;o[s]=o[s]||[],o[s].push(n),t&&t()}},window._kwaiq=o}(window,document);
        kwaiq.load(id);
        kwaiq.page();
    }

    // Inicia quando o DOM estiver pronto ou agora mesmo se j estiver
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPixels);
    } else {
        initPixels();
    }
})();
