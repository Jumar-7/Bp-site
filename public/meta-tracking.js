(function () {
    const fired = new Set();
    let activeConfig = null;

    function randomId() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    }

    function eventId(type) {
        const key = type + ':' + location.pathname;
        if (fired.has(key)) return null;
        fired.add(key);
        return randomId();
    }

    function cookie(name) {
        const match = document.cookie.split('; ').find(row => row.startsWith(name + '='));
        return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
    }

    function ensureFbp() {
        let fbp = cookie('_fbp');
        if (!fbp) {
            fbp = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1000000000);
            document.cookie = '_fbp=' + encodeURIComponent(fbp) + '; path=/; max-age=7776000; SameSite=Lax';
        }
        return fbp;
    }

    function ensureFbc() {
        let fbc = cookie('_fbc');
        const fbclid = new URLSearchParams(location.search).get('fbclid');
        if (fbclid) {
            fbc = 'fb.1.' + Date.now() + '.' + fbclid;
            document.cookie = '_fbc=' + encodeURIComponent(fbc) + '; path=/; max-age=7776000; SameSite=Lax';
        }
        return fbc;
    }

    function advancedData(extra) {
        const params = new URLSearchParams(location.search);
        const width = window.screen ? window.screen.width : 0;
        const height = window.screen ? window.screen.height : 0;
        const viewport = window.innerWidth + 'x' + window.innerHeight;
        const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        return {
            content_name: document.title,
            content_category: 'Landing Page',
            page_title: document.title,
            page_location: location.href,
            referrer: document.referrer || '(direct)',
            screen_resolution: width + 'x' + height,
            viewport,
            language: navigator.language || '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            device_type: device,
            utm_source: params.get('utm_source') || '',
            utm_medium: params.get('utm_medium') || '',
            utm_campaign: params.get('utm_campaign') || '',
            utm_term: params.get('utm_term') || '',
            utm_content: params.get('utm_content') || '',
            ad_id: params.get('ad_id') || params.get('adset_id') || '',
            fbclid: params.get('fbclid') || '',
            ...(extra || {})
        };
    }

    function loadPixel(pixelId) {
        if (!pixelId || window.__bpPixelLoaded) return;
        window.__bpPixelLoaded = true;
        (function (f, b, e, v, n, t, s) {
            if (f.fbq) return;
            n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = true;
            n.version = '2.0';
            n.queue = [];
            t = b.createElement(e);
            t.async = true;
            t.src = v;
            s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        window.fbq('init', pixelId);
    }

    async function collect(config, eventName, id, extra) {
        const customData = advancedData(extra);
        if (window.fbq) {
            const standardEvents = ['PageView', 'Lead', 'Schedule', 'Contact', 'CompleteRegistration', 'Purchase', 'ViewContent', 'AddToCart', 'InitiateCheckout'];
            if (standardEvents.includes(eventName)) {
                window.fbq('track', eventName, customData, { eventID: id });
            } else {
                window.fbq('trackCustom', eventName, customData, { eventID: id });
            }
        }

        const payload = {
            event_id: id,
            event_name: eventName,
            event_source_url: location.href,
            custom_data: customData,
            user_data: {
                fbp: ensureFbp(),
                fbc: ensureFbc()
            }
        };

        try {
            await fetch('/api/meta-tracking/collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (error) {
            console.debug('Meta CAPI event could not be sent', error);
        }
    }

    async function init() {
        let config;
        try {
            const response = await fetch('/api/meta-tracking/config', { cache: 'no-store' });
            config = await response.json();
        } catch (error) {
            return;
        }
        if (!config.enabled || !config.pixelId) return;
        activeConfig = config;

        loadPixel(config.pixelId);
        ensureFbp();
        ensureFbc();

        if (config.pageViewEnabled) {
            const id = eventId('page_view');
            if (id) collect(config, config.eventNames.pageView || 'PageView', id, { event_type: 'page_view' });
        }

        if (config.scrollEnabled) {
            let scrollFired = false;
            const checkScroll = () => {
                if (scrollFired) return;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                const available = document.documentElement.scrollHeight - window.innerHeight;
                const percent = available > 0 ? Math.round((scrollTop / available) * 100) : 100;
                if (percent >= Number(config.scrollPercent || 50)) {
                    scrollFired = true;
                    const id = eventId('scroll');
                    if (id) collect(config, config.eventNames.scroll || 'CustomScroll', id, {
                        event_type: 'scroll',
                        scroll_percent: percent,
                        threshold_percent: Number(config.scrollPercent || 50)
                    });
                }
            };
            window.addEventListener('scroll', checkScroll, { passive: true });
            checkScroll();
        }

        if (config.timeEnabled) {
            setTimeout(() => {
                const id = eventId('time_on_page');
                if (id) collect(config, config.eventNames.timeOnPage || 'TimeOnPage', id, {
                    event_type: 'time_on_page',
                    time_on_page_seconds: Number(config.timeSeconds || 30)
                });
            }, Number(config.timeSeconds || 30) * 1000);
        }

        if (config.whatsappEnabled) {
            document.addEventListener('click', (event) => {
                const link = event.target.closest && event.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]');
                if (!link) return;
                const id = eventId('whatsapp:' + (link.href || 'button'));
                if (!id) return;
                collect(config, config.eventNames.whatsapp || 'Contact', id, {
                    event_type: 'whatsapp_click',
                    button_source: link.innerText.trim().slice(0, 160) || link.title || link.href,
                    destination_url: link.href
                });
            }, true);
        }
    }

    window.BPMetaTrack = function (eventType, extra) {
        if (!activeConfig || !activeConfig.enabled) return null;
        let eventName;
        let key;

        if (eventType === 'meeting') {
            if (!activeConfig.meetingEnabled) return null;
            eventName = activeConfig.eventNames.meeting || 'Schedule';
            key = 'meeting';
        } else {
            return null;
        }

        const id = eventId(key);
        if (!id) return null;
        collect(activeConfig, eventName, id, {
            event_type: 'meeting_booked',
            ...(extra || {})
        });
        return id;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
