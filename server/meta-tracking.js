import crypto from 'crypto';

function sha256(value) {
    if (!value) return undefined;
    const str = String(value).trim().toLowerCase();
    if (!str) return undefined;
    // If already a 64-char hex string (sha256), return as is
    if (/^[a-f0-9]{64}$/.test(str)) return str;
    return crypto.createHash('sha256').update(str).digest('hex');
}

function normalizePhone(phone) {
    if (!phone) return undefined;
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return undefined;
    if (digits.startsWith('01') && digits.length === 11) {
        digits = '880' + digits.slice(1);
    } else if (digits.startsWith('+880')) {
        digits = digits.replace('+', '');
    }
    return digits;
}

function isPublicIp(ip) {
    if (!ip) return false;
    const clean = String(ip).trim();
    if (clean === '::1' || clean === '127.0.0.1' || clean.startsWith('fe80:') || clean.startsWith('10.') || clean.startsWith('192.168.')) {
        return false;
    }
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return false;
    return true;
}

function cleanConfig(db) {
    const config = db.metaTracking || {};
    return {
        enabled: Boolean(config.enabled),
        pixelId: config.pixelId || '',
        testEventCode: config.testEventCode || '',
        apiVersion: config.apiVersion || 'v21.0',
        pageViewEnabled: config.pageViewEnabled !== false,
        scrollEnabled: config.scrollEnabled !== false,
        scrollPercent: Number(config.scrollPercent || 50),
        timeEnabled: config.timeEnabled !== false,
        timeSeconds: Number(config.timeSeconds || 25),
        whatsappEnabled: config.whatsappEnabled !== false,
        meetingEnabled: config.meetingEnabled !== false,
        eventNames: {
            pageView: 'PageView',
            scroll: '50%_Scroll',
            timeOnPage: '25S_TimeOnPage',
            whatsapp: 'Wp_Contact',
            meeting: 'Schedule',
            ...(config.eventNames || {})
        }
    };
}

export function registerMetaTracking(app, { readDB, writeDB, requireAdmin }) {

    // 1. Get Public Config for Frontend meta-tracking.js
    app.get('/api/meta-tracking/config', (req, res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const db = readDB();
        res.json(cleanConfig(db));
    });

    // 2. Receive and Forward Event to Meta Conversions API (CAPI)
    app.post('/api/meta-tracking/collect', async (req, res) => {
        const db = readDB();
        const config = db.metaTracking || {};

        if (!config.enabled) {
            return res.json({ success: true, delivered: false, reason: 'disabled' });
        }
        if (!config.pixelId || !config.accessToken) {
            return res.status(400).json({ success: false, error: 'Meta Pixel ID or Access Token is missing in Admin settings.' });
        }

        const body = req.body || {};
        const eventId = String(body.event_id || '').slice(0, 128);
        if (!eventId) {
            return res.status(400).json({ success: false, error: 'event_id is required for deduplication.' });
        }

        db.metaTrackingEventLog = db.metaTrackingEventLog || [];
        const existing = db.metaTrackingEventLog.some((item) => item.eventId === eventId);
        if (existing) {
            return res.json({ success: true, delivered: false, duplicate: true, event_id: eventId });
        }

        const rawEventName = String(body.event_name || 'PageView').slice(0, 128);

        // Client IP & User Agent detection
        const forwarded = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
        const rawIp = forwarded || req.socket.remoteAddress || '';
        const clientIp = isPublicIp(rawIp) ? rawIp : undefined;
        const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

        // Normalize User Data (matching parameters)
        const browserData = body.user_data || {};
        const normalizedPhone = normalizePhone(browserData.ph || browserData.phone);
        const normalizedEmail = browserData.em || browserData.email;
        const firstName = browserData.fn || browserData.name || browserData.first_name;
        const externalId = browserData.external_id;

        const userData = {
            client_ip_address: clientIp,
            client_user_agent: userAgent || undefined,
            fbc: browserData.fbc || undefined,
            fbp: browserData.fbp || undefined,
            em: sha256(normalizedEmail),
            ph: sha256(normalizedPhone),
            fn: sha256(firstName),
            external_id: sha256(externalId),
            country: sha256('bd')
        };
        Object.keys(userData).forEach((key) => {
            if (userData[key] === undefined || userData[key] === '') delete userData[key];
        });

        // Custom Data
        const customData = { ...(body.custom_data || {}) };
        if (customData.value !== undefined) {
            const num = Number(customData.value);
            if (!isNaN(num)) customData.value = num;
            if (!customData.currency) customData.currency = 'BDT';
        }

        const eventPayload = {
            data: [{
                event_name: rawEventName,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                event_source_url: String(body.event_source_url || '').slice(0, 2048),
                action_source: 'website',
                custom_data: Object.keys(customData).length > 0 ? customData : undefined,
                user_data: userData
            }]
        };

        const testEventCode = String(config.testEventCode || '').trim();
        if (testEventCode) {
            eventPayload.test_event_code = testEventCode;
        }

        // Add pending log entry with parameter metrics
        db.metaTrackingEventLog.unshift({
            eventId,
            eventName: rawEventName,
            timestamp: new Date().toISOString(),
            status: 'pending',
            eventSourceUrl: body.event_source_url || '',
            hasFbp: Boolean(userData.fbp),
            hasFbc: Boolean(userData.fbc),
            hasIp: Boolean(userData.client_ip_address),
            hasUserAgent: Boolean(userData.client_user_agent),
            hasPhone: Boolean(userData.ph),
            hasEmail: Boolean(userData.em),
            hasExternalId: Boolean(userData.external_id)
        });
        if (db.metaTrackingEventLog.length > 200) {
            db.metaTrackingEventLog = db.metaTrackingEventLog.slice(0, 200);
        }
        writeDB(db);

        const apiVersion = /^[a-zA-Z0-9.]+$/.test(config.apiVersion || '') ? config.apiVersion : 'v21.0';
        const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(config.pixelId)}/events?access_token=${encodeURIComponent(config.accessToken)}`;

        let metaResponse;
        let responseJson;

        try {
            metaResponse = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventPayload)
            });
            const responseText = await metaResponse.text();
            try {
                responseJson = JSON.parse(responseText);
            } catch {
                responseJson = { raw: responseText.slice(0, 300) };
            }
        } catch (error) {
            const logEntry = db.metaTrackingEventLog.find((item) => item.eventId === eventId);
            if (logEntry) {
                logEntry.status = 'network_error';
                logEntry.message = String(error.message || error).slice(0, 300);
                logEntry.timestamp = new Date().toISOString();
            }
            writeDB(db);
            return res.status(502).json({ success: false, error: 'Meta CAPI network error: ' + error.message });
        }

        const logEntry = db.metaTrackingEventLog.find((item) => item.eventId === eventId);
        if (logEntry) {
            logEntry.status = metaResponse.ok ? 'delivered' : 'failed';
            logEntry.httpStatus = metaResponse.status;
            logEntry.response = responseJson;
            logEntry.timestamp = new Date().toISOString();
        }
        writeDB(db);

        if (!metaResponse.ok) {
            return res.status(502).json({
                success: false,
                error: responseJson?.error?.message || 'Meta CAPI rejected event',
                meta: responseJson
            });
        }

        return res.json({
            success: true,
            delivered: true,
            event_id: eventId,
            event_name: rawEventName,
            meta: responseJson
        });
    });

    // 3. Save Tracking Settings from Admin Panel
    app.post('/api/admin/meta-tracking', requireAdmin, (req, res) => {
        const db = readDB();
        const current = db.metaTracking || {};
        const incoming = req.body || {};

        const eventNames = {
            pageView: String(incoming.eventNames?.pageView || current.eventNames?.pageView || 'PageView').trim(),
            scroll: String(incoming.eventNames?.scroll || current.eventNames?.scroll || '50%_Scroll').trim(),
            timeOnPage: String(incoming.eventNames?.timeOnPage || current.eventNames?.timeOnPage || '25S_TimeOnPage').trim(),
            whatsapp: String(incoming.eventNames?.whatsapp || current.eventNames?.whatsapp || 'Wp_Contact').trim(),
            meeting: String(incoming.eventNames?.meeting || current.eventNames?.meeting || 'Schedule').trim()
        };

        const resolvedToken = (!incoming.accessToken || incoming.accessToken === '__UNCHANGED__')
            ? (current.accessToken || '')
            : String(incoming.accessToken).trim();

        db.metaTracking = {
            enabled: Boolean(incoming.enabled),
            pixelId: String(incoming.pixelId || '').trim(),
            accessToken: resolvedToken,
            testEventCode: String(incoming.testEventCode || '').trim(),
            apiVersion: String(incoming.apiVersion || 'v21.0').trim(),
            pageViewEnabled: incoming.pageViewEnabled !== false,
            scrollEnabled: incoming.scrollEnabled !== false,
            scrollPercent: Math.max(1, Math.min(100, Number(incoming.scrollPercent) || 50)),
            timeEnabled: incoming.timeEnabled !== false,
            timeSeconds: Math.max(1, Math.min(3600, Number(incoming.timeSeconds) || 25)),
            whatsappEnabled: incoming.whatsappEnabled !== false,
            meetingEnabled: incoming.meetingEnabled !== false,
            eventNames
        };

        writeDB(db);
        res.json({ success: true, config: cleanConfig(db) });
    });

    // 4. Test Event Sender for Admin Diagnostics
    app.post('/api/admin/meta-tracking/test', requireAdmin, async (req, res) => {
        const db = readDB();
        const config = db.metaTracking || {};

        if (!config.pixelId || !config.accessToken) {
            return res.status(400).json({ success: false, error: 'Pixel ID এবং Access Token কনফিগার করা নেই।' });
        }

        const testId = 'test_' + Date.now();
        const testPayload = {
            data: [{
                event_name: 'TestEvent_Diagnosis',
                event_time: Math.floor(Date.now() / 1000),
                event_id: testId,
                event_source_url: req.headers.referer || 'http://localhost:3000/admin',
                action_source: 'website',
                custom_data: {
                    content_name: 'Admin Panel Meta Diagnostic Test',
                    currency: 'BDT',
                    value: 100
                },
                user_data: {
                    client_user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
                    country: sha256('bd')
                }
            }]
        };

        if (config.testEventCode) {
            testPayload.test_event_code = config.testEventCode;
        }

        const apiVersion = config.apiVersion || 'v21.0';
        const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(config.pixelId)}/events?access_token=${encodeURIComponent(config.accessToken)}`;

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testPayload)
            });
            const data = await resp.json();

            db.metaTrackingEventLog = db.metaTrackingEventLog || [];
            db.metaTrackingEventLog.unshift({
                eventId: testId,
                eventName: 'TestEvent_Diagnosis',
                timestamp: new Date().toISOString(),
                status: resp.ok ? 'delivered' : 'failed',
                httpStatus: resp.status,
                response: data,
                hasIp: true,
                hasUserAgent: true
            });
            writeDB(db);

            return res.json({ success: resp.ok, status: resp.status, meta: data });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // 5. Clear Event Logs
    app.post('/api/admin/meta-tracking/clear-logs', requireAdmin, (req, res) => {
        const db = readDB();
        db.metaTrackingEventLog = [];
        writeDB(db);
        res.json({ success: true });
    });
}
