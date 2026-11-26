(function () {
    'use strict';

    const firedKeys = new Set();
    let trackingConfig = null;
    let configPromise = null;

    // Helper: Generate unique event ID for deduplication
    function generateEventId(prefix) {
        const rnd = Math.random().toString(36).substring(2, 9);
        return (prefix || 'bp') + '_' + Date.now() + '_' + rnd;
    }

    // Helper: Read cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return decodeURIComponent(parts.pop().split(';').shift().trim());
        }
        return undefined;
    }

    // Helper: Set cookie
    function setCookie(name, value, days = 90) {
        const maxAge = days * 24 * 60 * 60;
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }

    // Helper: Ensure _fbp cookie
    function getOrSetFbp() {
        let fbp = getCookie('_fbp');
        if (!fbp) {
            fbp = `fb.1.${Date.now()}.${Math.floor(1000000000 + Math.random() * 9000000000)}`;
            setCookie('_fbp', fbp);
        }
        return fbp;
    }

    // Helper: Ensure _fbc cookie
    function getOrSetFbc() {
        let fbc = getCookie('_fbc');
        try {
            const params = new URLSearchParams(window.location.search);
            const fbclid = params.get('fbclid');
            if (fbclid) {
                fbc = `fb.1.${Date.now()}.${fbclid}`;
                setCookie('_fbc', fbc);
            }
        } catch (e) {}
        return fbc;
    }

    // Clean standard custom data to prevent Meta Pixel Helper "Data Advisor" warnings
    function getCleanCustomData(eventName, extra = {}) {
        const params = new URLSearchParams(window.location.search);
        const data = {};

        // Standard properties only
        if (extra.content_name) data.content_name = extra.content_name;
        if (extra.content_category) data.content_category = extra.content_category;
        if (extra.value !== undefined) {
            data.value = Number(extra.value) || 0;
            data.currency = extra.currency || 'BDT';
        }

        // UTM parameters for attribution
        if (params.get('utm_source')) data.utm_source = params.get('utm_source');
        if (params.get('utm_medium')) data.utm_medium = params.get('utm_medium');
        if (params.get('utm_campaign')) data.utm_campaign = params.get('utm_campaign');

        // Merge any other custom event-specific properties (e.g. scroll_depth)
        Object.keys(extra).forEach(k => {
            if (!['content_name', 'content_category', 'value', 'currency'].includes(k)) {
                data[k] = extra[k];
            }
        });

        return data;
    }

    // Ensure fbq initialization if not already in <head>
    function ensureMetaPixel(pixelId) {
        if (!pixelId) return;
        if (!window.fbq) {
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
        }

        if (window.__bpInitialPixelId !== pixelId && !window.__bpExtraPixelInit) {
            window.__bpExtraPixelInit = true;
            window.fbq('init', pixelId);
        }
    }

    // Core Dual Dispatcher: Browser Pixel + Server CAPI
    async function dispatchMetaEvent(eventName, customData = {}, userData = {}, onceKey = null, preAssignedEventId = null, skipBrowser = false) {
        if (!trackingConfig || !trackingConfig.enabled || !trackingConfig.pixelId) {
            return null;
        }

        if (onceKey) {
            if (firedKeys.has(onceKey)) return null;
            firedKeys.add(onceKey);
        }

        const eventId = preAssignedEventId || generateEventId('bp');
        const cleanData = getCleanCustomData(eventName, customData);

        // 1. Browser Meta Pixel firing (if not already fired in <head>)
        if (!skipBrowser && window.fbq) {
            const standardEvents = [
                'PageView', 'Lead', 'Schedule', 'Contact', 'CompleteRegistration',
                'Purchase', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Search'
            ];
            const isStandard = standardEvents.includes(eventName);

            if (isStandard) {
                // Standard events accept (eventName, customData, { eventID })
                window.fbq('track', eventName, Object.keys(cleanData).length > 0 ? cleanData : {}, { eventID: eventId });
            } else {
                window.fbq('trackCustom', eventName, cleanData, { eventID: eventId });
            }
        }

        // 2. Server CAPI collect payload
        const payload = {
            event_id: eventId,
            event_name: eventName,
            event_source_url: window.location.href,
            custom_data: cleanData,
            user_data: {
                fbp: getOrSetFbp(),
                fbc: getOrSetFbc(),
                phone: userData.phone || userData.ph,
                email: userData.email || userData.em,
                name: userData.name || userData.fn
            }
        };

        try {
            await fetch('/api/meta-tracking/collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (err) {}

        return eventId;
    }

    // Fetch config
    async function loadConfig() {
        if (configPromise) return configPromise;
        configPromise = fetch('/api/meta-tracking/config', { cache: 'no-store' })
            .then(res => res.json())
            .then(cfg => {
                trackingConfig = cfg;
                return cfg;
            })
            .catch(() => null);
        return configPromise;
    }

    async function init() {
        const config = await loadConfig();
        if (!config || !config.enabled || !config.pixelId) return;

        ensureMetaPixel(config.pixelId);
        getOrSetFbp();
        getOrSetFbc();

        const names = config.eventNames || {};

        // 1. PageView Event (Pair with <head> pixel or fire new)
        if (config.pageViewEnabled) {
            const pageViewName = names.pageView || 'PageView';
            if (window.__bpPageViewId) {
                // Browser pixel PageView was already fired in <head> with window.__bpPageViewId!
                // Pair it directly with Server CAPI for 100% Deduplication!
                dispatchMetaEvent(pageViewName, {}, {}, 'page_view:' + window.location.pathname, window.__bpPageViewId, true);
            } else {
                dispatchMetaEvent(pageViewName, {}, {}, 'page_view:' + window.location.pathname);
            }
        }

        // 2. Scroll Depth Event (Configurable threshold %)
        if (config.scrollEnabled) {
            const threshold = Number(config.scrollPercent || 50);
            const scrollName = names.scroll || '50%_Scroll';
            let scrollTriggered = false;

            const handleScroll = () => {
                if (scrollTriggered) return;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
                const percent = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 100;

                if (percent >= threshold) {
                    scrollTriggered = true;
                    window.removeEventListener('scroll', handleScroll);
                    dispatchMetaEvent(scrollName, {
                        scroll_depth_percent: percent,
                        threshold_percent: threshold
                    }, {}, 'scroll:' + window.location.pathname);
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll();
        }

        // 3. Time On Page Event (Configurable seconds)
        if (config.timeEnabled) {
            const seconds = Number(config.timeSeconds || 25);
            const timeName = names.timeOnPage || '25S_TimeOnPage';

            setTimeout(() => {
                dispatchMetaEvent(timeName, {
                    time_seconds: seconds
                }, {}, 'time_on_page:' + window.location.pathname);
            }, seconds * 1000);
        }

        // 4. WhatsApp Click Event (Global click listener)
        if (config.whatsappEnabled) {
            const waName = names.whatsapp || 'Wp_Contact';
            document.addEventListener('click', (e) => {
                const link = e.target && e.target.closest && e.target.closest('a[href*="wa.me"], a[href*="whatsapp.com"]');
                if (!link) return;

                const buttonText = (link.innerText || link.textContent || link.title || 'WhatsApp Button').trim().slice(0, 100);
                dispatchMetaEvent(waName, {
                    content_name: 'WhatsApp Click - ' + buttonText,
                    destination_url: link.href,
                    value: 0,
                    currency: 'BDT'
                }, {}, null);
            }, true);
        }
    }

    // Public Global Interface for Meeting / Custom Tracking
    window.BPMetaTrack = function (eventType, customData = {}, userData = {}) {
        const execute = () => {
            if (!trackingConfig || !trackingConfig.enabled) return null;
            const names = trackingConfig.eventNames || {};

            if (eventType === 'meeting') {
                if (!trackingConfig.meetingEnabled) return null;
                const eventName = names.meeting || 'Schedule';
                return dispatchMetaEvent(eventName, {
                    content_name: '1-to-1 Strategy Meeting',
                    currency: 'BDT',
                    value: 3499,
                    ...(customData || {})
                }, userData || {}, null);
            } else if (eventType === 'whatsapp') {
                if (!trackingConfig.whatsappEnabled) return null;
                const eventName = names.whatsapp || 'Wp_Contact';
                return dispatchMetaEvent(eventName, {
                    content_name: 'WhatsApp Inquiry',
                    currency: 'BDT',
                    value: 0,
                    ...(customData || {})
                }, userData || {}, null);
            } else {
                return dispatchMetaEvent(eventType, customData, userData, null);
            }
        };

        if (trackingConfig) {
            return execute();
        } else {
            loadConfig().then(() => execute());
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
