(function () {
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function injectCard() {
        const main = document.querySelector('main');
        if (!main || document.getElementById('meta-tracking-card')) return;
        const card = document.createElement('section');
        card.id = 'meta-tracking-card';
        card.className = 'bg-slate-800 border border-slate-700 rounded-3xl p-6';
        card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                    <h3 class="text-xl font-bold text-white">📡 Meta Pixel + Server CAPI</h3>
                    <p class="text-xs text-slate-400 mt-1">Browser ও server event browser Pixel-এর event_id দিয়ে deduplicate হবে।</p>
                </div>
                <label class="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <input id="mt-enabled" type="checkbox" class="w-4 h-4 accent-indigo-500">
                    CAPI সক্রিয়
                </label>
            </div>
            <form id="mt-form" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Meta Pixel ID</label>
                    <input id="mt-pixel" type="text" placeholder="123456789012345" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Access Token</label>
                    <input id="mt-token" type="password" placeholder="সংরক্ষিত থাকলে এখানে পরিবর্তন করবেন না" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Test Event Code</label>
                    <input id="mt-test-code" type="text" placeholder="TEST12345" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">API Version</label>
                    <input id="mt-api-version" type="text" value="v21.0" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Scroll Threshold (%)</label>
                    <input id="mt-scroll-percent" type="number" min="1" max="100" value="50" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Time On Page (seconds)</label>
                    <input id="mt-time-seconds" type="number" min="1" max="3600" value="30" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <label class="flex items-center gap-2 text-slate-300"><input id="mt-page-enabled" type="checkbox" class="accent-indigo-500"> Page View</label>
                <label class="flex items-center gap-2 text-slate-300"><input id="mt-scroll-enabled" type="checkbox" class="accent-indigo-500"> Scroll Event</label>
                <label class="flex items-center gap-2 text-slate-300"><input id="mt-time-enabled" type="checkbox" class="accent-indigo-500"> Time Event</label>
                <label class="flex items-center gap-2 text-slate-300"><input id="mt-wa-enabled" type="checkbox" class="accent-indigo-500"> WhatsApp Event</label>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Page View Event Name</label>
                    <input id="mt-name-page" type="text" value="PageView" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Scroll Event Name</label>
                    <input id="mt-name-scroll" type="text" value="CustomScroll" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">Time Event Name</label>
                    <input id="mt-name-time" type="text" value="TimeOnPage" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <div>
                    <label class="text-xs text-slate-400 block mb-1">WhatsApp Event Name</label>
                    <input id="mt-name-wa" type="text" value="Contact" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white">
                </div>
                <button type="submit" class="lg:col-span-3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">💾 Tracking Settings সেভ করুন</button>
            </form>
            <div class="mt-5 pt-4 border-t border-slate-700">
                <h4 class="text-xs font-bold uppercase text-slate-400 mb-2">সাম্প্রতিক CAPI Event Status</h4>
                <div id="mt-event-log" class="space-y-1.5 max-h-48 overflow-y-auto text-xs"></div>
            </div>
        `;
        main.appendChild(card);
        document.getElementById('mt-form').addEventListener('submit', saveSettings);
    }

    async function saveSettings(event) {
        event.preventEvent?.();
        event.preventDefault();
        const token = localStorage.getItem('bp_admin_token') || '';
        const payload = {
            enabled: document.getElementById('mt-enabled').checked,
            pixelId: document.getElementById('mt-pixel').value,
            accessToken: document.getElementById('mt-token').value || '__UNCHANGED__',
            testEventCode: document.getElementById('mt-test-code').value,
            apiVersion: document.getElementById('mt-api-version').value,
            pageViewEnabled: document.getElementById('mt-page-enabled').checked,
            scrollEnabled: document.getElementById('mt-scroll-enabled').checked,
            scrollPercent: document.getElementById('mt-scroll-percent').value,
            timeEnabled: document.getElementById('mt-time-enabled').checked,
            timeSeconds: document.getElementById('mt-time-seconds').value,
            whatsappEnabled: document.getElementById('mt-wa-enabled').checked,
            eventNames: {
                pageView: document.getElementById('mt-name-page').value,
                scroll: document.getElementById('mt-name-scroll').value,
                timeOnPage: document.getElementById('mt-name-time').value,
                whatsapp: document.getElementById('mt-name-wa').value
            }
        };
        const response = await fetch('/api/admin/meta-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Settings save failed');
            return;
        }
        document.getElementById('mt-token').value = '';
        alert('Meta tracking settings saved.');
    }

    function render(db) {
        injectCard();
        const config = db.metaTracking || {};
        const names = config.eventNames || {};
        document.getElementById('mt-enabled').checked = Boolean(config.enabled);
        document.getElementById('mt-pixel').value = config.pixelId || '';
        document.getElementById('mt-test-code').value = config.testEventCode || '';
        document.getElementById('mt-api-version').value = config.apiVersion || 'v21.0';
        document.getElementById('mt-scroll-percent').value = config.scrollPercent || 50;
        document.getElementById('mt-time-seconds').value = config.timeSeconds || 30;
        document.getElementById('mt-page-enabled').checked = config.pageViewEnabled !== false;
        document.getElementById('mt-scroll-enabled').checked = config.scrollEnabled !== false;
        document.getElementById('mt-time-enabled').checked = config.timeEnabled !== false;
        document.getElementById('mt-wa-enabled').checked = config.whatsappEnabled !== false;
        document.getElementById('mt-name-page').value = names.pageView || 'PageView';
        document.getElementById('mt-name-scroll').value = names.scroll || 'CustomScroll';
        document.getElementById('mt-name-time').value = names.timeOnPage || 'TimeOnPage';
        document.getElementById('mt-name-wa').value = names.whatsapp || 'Contact';

        const log = document.getElementById('mt-event-log');
        const rows = db.metaTrackingEventLog || [];
        log.innerHTML = rows.map(item => `
            <div class="flex justify-between gap-3 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                <span class="${item.status === 'delivered' ? 'text-emerald-400' : 'text-rose-400'}">${escapeHtml(item.eventName)} — ${escapeHtml(item.status)}</span>
                <span class="text-slate-500">${escapeHtml(item.timestamp)}</span>
            </div>
        `).join('') || '<div class="text-slate-500">এখনো কোনো CAPI event পাওয়া যায়নি।</div>';
    }

    window.renderMetaTrackingAdmin = render;
    const hookRenderDashboard = () => {
        if (typeof window.renderDashboard !== 'function' || window.__metaAdminPatched) return;
        window.__metaAdminPatched = true;
        const originalRenderDashboard = window.renderDashboard;
        window.renderDashboard = function (db) {
            originalRenderDashboard(db);
            render(db);
        };
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            hookRenderDashboard();
            injectCard();
        });
    } else {
        hookRenderDashboard();
        injectCard();
    }
})();
