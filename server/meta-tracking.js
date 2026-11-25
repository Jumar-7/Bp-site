<<<<<<< HEAD
import crypto from 'crypto';

function sha256(value) {
    if (!value) return undefined;
    return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
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
        timeSeconds: Number(config.timeSeconds || 30),
        whatsappEnabled: config.whatsappEnabled !== false,
        meetingEnabled: config.meetingEnabled !== false,
        eventNames: {
            pageView: 'PageView',
            scroll: 'CustomScroll',
            timeOnPage: 'TimeOnPage',
            whatsapp: 'Contact',
            meeting: 'Schedule',
            ...(config.eventNames || {})
        }
    };
}

export function registerMetaTracking(app, { readDB, writeDB, requireAdmin }) {
    app.get('/api/meta-tracking/config', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(cleanConfig(readDB()));
    });

    app.post('/api/meta-tracking/collect', async (req, res) => {
        const db = readDB();
        const config = db.metaTracking || {};
        if (!config.enabled) {
            return res.json({ success: true, delivered: false, reason: 'disabled' });
        }
        if (!config.pixelId || !config.accessToken) {
            return res.status(400).json({ success: false, error: 'Meta Pixel or access token is not configured.' });
        }

        const body = req.body || {};
        const eventId = String(body.event_id || '').slice(0, 128);
        if (!eventId) {
            return res.status(400).json({ success: false, error: 'event_id is required.' });
        }

        db.metaTrackingEventLog = db.metaTrackingEventLog || [];
        const existing = db.metaTrackingEventLog.some((item) => item.eventId === eventId);
        if (existing) {
            return res.json({ success: true, delivered: false, duplicate: true, event_id: eventId });
        }
        db.metaTrackingEventLog.unshift({
            eventId,
            eventName: String(body.event_name || 'PageView').slice(0, 128),
            timestamp: new Date().toISOString(),
            status: 'pending'
        });
        db.metaTrackingEventLog = db.metaTrackingEventLog.slice(0, 500);
        writeDB(db);

        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const clientIp = forwarded || req.socket.remoteAddress || '';
        const customData = { ...(body.custom_data || {}) };
        customData.server_received_at = new Date().toISOString();
        customData.server_user_agent = String(req.headers['user-agent'] || '').slice(0, 500);

        const browserData = body.user_data || {};
        const userData = {
            client_ip_address: clientIp,
            client_user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
            fbc: browserData.fbc || undefined,
            fbp: browserData.fbp || undefined,
            em: sha256(browserData.em),
            ph: sha256(browserData.ph)
        };
        Object.keys(userData).forEach((key) => {
            if (userData[key] === undefined || userData[key] === '') delete userData[key];
        });

        const eventPayload = {
            data: [{
                event_name: String(body.event_name || 'PageView').slice(0, 128),
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                event_source_url: String(body.event_source_url || '').slice(0, 2048),
                action_source: 'website',
                custom_data: customData,
                user_data: userData
            }],
            test_event_code: config.testEventCode || undefined
        };

        const apiVersion = /^[a-zA-Z0-9.]+$/.test(config.apiVersion || '') ? config.apiVersion : 'v21.0';
        let metaResponse;
        try {
            metaResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(config.pixelId)}/events?access_token=${encodeURIComponent(config.accessToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventPayload)
            });
        } catch (error) {
            const pending = db.metaTrackingEventLog.find((item) => item.eventId === eventId);
            if (pending) {
                pending.status = 'network_error';
                pending.message = String(error.message || error).slice(0, 300);
                pending.timestamp = new Date().toISOString();
            }
            db.metaTrackingEventLog = db.metaTrackingEventLog.slice(0, 500);
            writeDB(db);
            return res.status(502).json({ success: false, error: 'Meta CAPI request failed.' });
        }

        const responseText = await metaResponse.text();
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch {
            responseJson = { raw: responseText.slice(0, 300) };
        }

        const pending = db.metaTrackingEventLog.find((item) => item.eventId === eventId);
        if (pending) {
            pending.status = metaResponse.ok ? 'delivered' : 'failed';
            pending.httpStatus = metaResponse.status;
            pending.response = responseJson;
            pending.timestamp = new Date().toISOString();
        }
        db.metaTrackingEventLog = db.metaTrackingEventLog.slice(0, 500);
        writeDB(db);

        if (!metaResponse.ok) {
            return res.status(502).json({ success: false, error: 'Meta CAPI rejected the event.', meta: responseJson });
        }

        res.json({ success: true, delivered: true, event_id: eventId, meta: responseJson });
    });

    app.post('/api/admin/meta-tracking', requireAdmin, (req, res) => {
        const db = readDB();
        const current = db.metaTracking || {};
        const incoming = req.body || {};
        const eventNames = {
            pageView: incoming.eventNames?.pageView || current.eventNames?.pageView || 'PageView',
            scroll: incoming.eventNames?.scroll || current.eventNames?.scroll || 'CustomScroll',
            timeOnPage: incoming.eventNames?.timeOnPage || current.eventNames?.timeOnPage || 'TimeOnPage',
            whatsapp: incoming.eventNames?.whatsapp || current.eventNames?.whatsapp || 'Contact',
            meeting: incoming.eventNames?.meeting || current.eventNames?.meeting || 'Schedule'
        };

        db.metaTracking = {
            enabled: Boolean(incoming.enabled),
            pixelId: String(incoming.pixelId || '').trim(),
            accessToken: incoming.accessToken === '__UNCHANGED__'
                ? (current.accessToken || '')
                : String(incoming.accessToken || '').trim(),
            testEventCode: String(incoming.testEventCode || '').trim(),
            apiVersion: String(incoming.apiVersion || 'v21.0').trim(),
            pageViewEnabled: incoming.pageViewEnabled !== false,
            scrollEnabled: incoming.scrollEnabled !== false,
            scrollPercent: Math.max(1, Math.min(100, Number(incoming.scrollPercent) || 50)),
            timeEnabled: incoming.timeEnabled !== false,
            timeSeconds: Math.max(1, Math.min(3600, Number(incoming.timeSeconds) || 30)),
            whatsappEnabled: incoming.whatsappEnabled !== false,
            meetingEnabled: incoming.meetingEnabled !== false,
            eventNames
        };
        writeDB(db);
        res.json({ success: true, config: cleanConfig(db) });
    });
}
=======
import crypto from 'crypto';

function sha256(value) {
    if (!value) return undefined;
    return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
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
        timeSeconds: Number(config.timeSeconds || 30),
        whatsappEnabled: config.whatsappEnabled !== false,
        eventNames: config.eventNames || {
            pageView: 'PageView',
            scroll: 'CustomScroll',
            timeOnPage: 'TimeOnPage',
            whatsapp: 'Contact'
        }
    };
}

export function registerMetaTracking(app, { readDB, writeDB, requireAdmin }) {
    app.get('/api/meta-tracking/config', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(cleanConfig(readDB()));
    });

    app.post('/api/meta-tracking/collect', async (req, res) => {
        const db = readDB();
        const config = db.metaTracking || {};
        if (!config.enabled) {
            return res.json({ success: true, delivered: false, reason: 'disabled' });
        }
        if (!config.pixelId || !config.accessToken) {
            return res.status(400).json({ success: false, error: 'Meta Pixel or access token is not configured.' });
        }

        const body = req.body || {};
        const eventId = String(body.event_id || '').slice(0, 128);
        if (!eventId) {
            return res.status(400).json({ success: false, error: 'event_id is required.' });
        }

        db.metaTrackingEventLog = db.metaTrackingEventLog || [];
        const existing = db.metaTrackingEventLog.some((item) => item.eventId === eventId);
        if (existing) {
            return res.json({ success: true, delivered: false, duplicate: true, event_id: eventId });
        }

        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const clientIp = forwarded || req.socket.remoteAddress || '';
        const customData = { ...(body.custom_data || {}) };
        customData.server_received_at = new Date().toISOString();
        customData.server_user_agent = String(req.headers['user-agent'] || '').slice(0, 500);

        const browserData = body.user_data || {};
        const userData = {
            client_ip_address: clientIp,
            client_user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
            fbc: browserData.fbc || undefined,
            fbp: browserData.fbp || undefined,
            em: sha256(browserData.em),
            ph: sha256(browserData.ph)
        };
        Object.keys(userData).forEach((key) => {
            if (userData[key] === undefined || userData[key] === '') delete userData[key];
        });

        const eventPayload = {
            data: [{
                event_name: String(body.event_name || 'PageView').slice(0, 128),
                event_time: Math.floor(Date.now() / 1000),
                event_id: eventId,
                event_source_url: String(body.event_source_url || '').slice(0, 2048),
                action_source: 'website',
                custom_data: customData,
                user_data: userData
            }],
            test_event_code: config.testEventCode || undefined
        };

        const apiVersion = /^[a-zA-Z0-9.]+$/.test(config.apiVersion || '') ? config.apiVersion : 'v21.0';
        let metaResponse;
        try {
            metaResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(config.pixelId)}/events?access_token=${encodeURIComponent(config.accessToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventPayload)
            });
        } catch (error) {
            db.metaTrackingEventLog.unshift({
                eventId,
                eventName: eventPayload.data[0].event_name,
                timestamp: new Date().toISOString(),
                status: 'network_error',
                message: String(error.message || error).slice(0, 300)
            });
            db.metaTrackingEventLog = db.metaTrackingEventLog.slice(0, 500);
            writeDB(db);
            return res.status(502).json({ success: false, error: 'Meta CAPI request failed.' });
        }

        const responseText = await metaResponse.text();
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch {
            responseJson = { raw: responseText.slice(0, 300) };
        }

        db.metaTrackingEventLog.unshift({
            eventId,
            eventName: eventPayload.data[0].event_name,
            timestamp: new Date().toISOString(),
            status: metaResponse.ok ? 'delivered' : 'failed',
            httpStatus: metaResponse.status,
            response: responseJson
        });
        db.metaTrackingEventLog = db.metaTrackingEventLog.slice(0, 500);
        writeDB(db);

        if (!metaResponse.ok) {
            return res.status(502).json({ success: false, error: 'Meta CAPI rejected the event.', meta: responseJson });
        }

        res.json({ success: true, delivered: true, event_id: eventId, meta: responseJson });
    });

    app.post('/api/admin/meta-tracking', requireAdmin, (req, res) => {
        const db = readDB();
        const current = db.metaTracking || {};
        const incoming = req.body || {};
        const eventNames = {
            pageView: incoming.eventNames?.pageView || current.eventNames?.pageView || 'PageView',
            scroll: incoming.eventNames?.scroll || current.eventNames?.scroll || 'CustomScroll',
            timeOnPage: incoming.eventNames?.timeOnPage || current.eventNames?.timeOnPage || 'TimeOnPage',
            whatsapp: incoming.eventNames?.whatsapp || current.eventNames?.whatsapp || 'Contact'
        };

        db.metaTracking = {
            enabled: Boolean(incoming.enabled),
            pixelId: String(incoming.pixelId || '').trim(),
            accessToken: incoming.accessToken === '__UNCHANGED__'
                ? (current.accessToken || '')
                : String(incoming.accessToken || '').trim(),
            testEventCode: String(incoming.testEventCode || '').trim(),
            apiVersion: String(incoming.apiVersion || 'v21.0').trim(),
            pageViewEnabled: incoming.pageViewEnabled !== false,
            scrollEnabled: incoming.scrollEnabled !== false,
            scrollPercent: Math.max(1, Math.min(100, Number(incoming.scrollPercent) || 50)),
            timeEnabled: incoming.timeEnabled !== false,
            timeSeconds: Math.max(1, Math.min(3600, Number(incoming.timeSeconds) || 30)),
            whatsappEnabled: incoming.whatsappEnabled !== false,
            eventNames
        };
        writeDB(db);
        res.json({ success: true, config: cleanConfig(db) });
    });
}
>>>>>>> 97757a7ea06f9cd35817f4c9da858d021b98fc99
