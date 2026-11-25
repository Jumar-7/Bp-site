(function () {
    'use strict';

    const firedKeys = new Set();
    let trackingConfig = null;
    let configPromise = null;

    // Helper: Generate standard event ID for deduplication
    function generateEventId(prefix) {
        const rnd = Math.random().toString(36).substring(2, 10);
        return (prefix || 'evt') + '_' + Date.now() + '_' + rnd;
    }

    // Helper: Read cookie cleanly
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return decodeURIComponent(parts.pop().split(';').shift().trim());
        }
        return undefined;
    }

    // Helper: Set cookie with SameSite and Max-Age
    function setCookie(name, value, days = 90) {
        const maxAge = days * 24 * 60 * 60;
        document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }

    // Helper: Ensure _fbp cookie (Facebook Browser ID)
    function getOrSetFbp() {
        let fbp = getCookie('_fbp');
        if (!fbp) {
            fbp = `fb.1.${Date.now()}.${Math.floor(1000000000 + Math.random() * 9000000000)}`;
            setCookie('_fbp', fbp);
        }
        return fbp;
    }

    // Helper: Ensure _fbc cookie (Facebook Click ID)
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

    // Collect base context parameters
    function getBaseCustomData(extra = {}) {
        const params = new URLSearchParams(window.location.search);
        const screenRes = window.screen ? `${window.screen.width}x${window.screen.height}` : '';
        const viewport = `${window.innerWidth}x${window.innerHeight}`;
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

        return {
            content_name: document.title || 'Backend Pixel Pro',
            content_category: 'E-learning / IT Services',
            page_title: document.title,
            page_location: window.location.href,
            referrer: document.referrer || '(direct)',
            device_type: isMobile ? 'mobile' : 'desktop',
            screen_resolution: screenRes,
            viewport: viewport,
            language: navigator.language || 'bn',
            utm_source: params.get('utm_source') || '',
            utm_medium: params.get('utm_medium') || '',
            utm_campaign: params.get('utm_campaign') || '',
            utm_term: params.get('utm_term') || '',
            utm_content: params.get('utm_content') || '',
            fbclid: params.get('fbclid') || '',
            ...(extra || {})
        };
    }

    // Standard Meta Pixel snippet initialization
    function initMetaPixel(pixelId) {
        if (!pixelId || window.__bpPixelInitialized) return;
        window.__bpPixelInitialized = true;

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

    // Core Dual Dispatcher: fires Browser Pixel & Server CAPI with IDENTICAL event_id
    async function dispatchMetaEvent(eventName, customData = {}, userData = {}, onceKey = null) {
        if (!trackingConfig || !trackingConfig.enabled || !trackingConfig.pixelId) {
            return null;
        }

        if (onceKey) {
            if (firedKeys.has(onceKey)) return null;
            firedKeys.add(onceKey);
        }

        const eventId = generateEventId('bp');
        const mergedCustomData = getBaseCustomData(customData);

        // 1. Browser Meta Pixel firing
        if (window.fbq) {
            const standardEvents = [
                'PageView', 'Lead', 'Schedule', 'Contact', 'CompleteRegistration',
                'Purchase', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Search'
            ];
            const isStandard = standardEvents.includes(eventName);

            // Pass identical eventID in 4th argument options for deduplication
            if (isStandard) {
                window.fbq('track', eventName, mergedCustomData, { eventID: eventId });
            } else {
                window.fbq('trackCustom', eventName, mergedCustomData, { eventID: eventId });
            }
        }

        // 2. Server CAPI collect payload
        const payload = {
            event_id: eventId,
            event_name: eventName,
            event_source_url: window.location.href,
            custom_data: mergedCustomData,
            user_data: {
                fbp: getOrSetFbp(),
                fbc: getOrSetFbc(),
                phone: userData.phone || userData.ph,
                email: userData.email || userData.em,
                name: userData.name || userData.fn
            }
        };

        // Send to server endpoint
        try {
            await fetch('/api/meta-tracking/collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (err) {
            // Keepalive or silent fail
        }

        return eventId;
    }

    // Fetch config and initialize
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

        initMetaPixel(config.pixelId);
        getOrSetFbp();
        getOrSetFbc();

        const names = config.eventNames || {};

        // 1. PageView Event
        if (config.pageViewEnabled) {
            const pageViewName = names.pageView || 'PageView';
            dispatchMetaEvent(pageViewName, { event_type: 'page_view' }, {}, 'page_view:' + window.location.pathname);
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
                        event_type: 'scroll_depth',
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
                    event_type: 'time_on_page',
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
                    event_type: 'whatsapp_click',
                    button_name: buttonText,
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
                    event_type: 'meeting_booked',
                    content_name: '1-to-1 Strategy Meeting',
                    currency: 'BDT',
                    value: 3499,
                    ...(customData || {})
                }, userData || {}, null);
            } else if (eventType === 'whatsapp') {
                if (!trackingConfig.whatsappEnabled) return null;
                const eventName = names.whatsapp || 'Wp_Contact';
                return dispatchMetaEvent(eventName, {
                    event_type: 'whatsapp_click',
                    currency: 'BDT',
                    ...(customData || {})
                }, userData || {}, null);
            } else {
                // Generic custom event
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
