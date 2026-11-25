(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function showToast(message, type = 'success') {
        const existing = document.getElementById('bp-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'bp-toast';
        toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold text-white transition-all transform duration-300 translate-y-0 ${
            type === 'success' ? 'bg-emerald-600 border border-emerald-400/40 shadow-emerald-900/40' : 'bg-rose-600 border border-rose-400/40 shadow-rose-900/40'
        }`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : '⚠️'}</span>
            <span>${escapeHtml(message)}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function injectCard() {
        const main = document.querySelector('main');
        if (!main || document.getElementById('meta-tracking-card')) return;

        const card = document.createElement('section');
        card.id = 'meta-tracking-card';
        card.className = 'bg-slate-800/90 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md transition-all';
        card.innerHTML = `
            <!-- Header & Master Toggle -->
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 mb-6 border-b border-slate-700/80">
                <div>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-600/30">
                            📡
                        </div>
                        <div>
                            <h3 class="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                                Meta Pixel + Server CAPI Engine
                                <span id="mt-badge-status" class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-700 text-slate-300 border border-slate-600">
                                    Checking...
                                </span>
                            </h3>
                            <p class="text-xs sm:text-sm text-slate-400 mt-0.5">
                                Browser ও Cloud Server CAPI এর যৌথ ট্র্যাকিং ও অটোমেটিক Event Deduplication
                            </p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-4">
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                        <input id="mt-enabled" type="checkbox" class="sr-only peer">
                        <div class="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-600 peer-checked:to-purple-600 shadow-inner"></div>
                        <span class="ml-3 text-sm font-bold text-slate-200" id="mt-toggle-label">ট্র্যাকিং সক্রিয়</span>
                    </label>
                </div>
            </div>

            <form id="mt-form" class="space-y-8">
                
                <!-- 1. Credentials Grid -->
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-xs font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                            <span>🔑 ১. Meta API Credentials & Tokens</span>
                        </h4>
                        <span class="text-xs text-slate-400">Graph API v21.0</span>
                    </div>

                    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-300 flex items-center justify-between">
                                <span>Meta Pixel ID</span>
                                <span class="text-[10px] text-indigo-400 font-normal">Dataset ID</span>
                            </label>
                            <input id="mt-pixel" type="text" inputmode="numeric" placeholder="1364021745113504" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-white text-sm font-mono placeholder-slate-600">
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-300 flex items-center justify-between">
                                <span>Conversions API Access Token</span>
                                <span id="mt-token-status" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">চেক করা হচ্ছে</span>
                            </label>
                            <div class="relative">
                                <input id="mt-token" type="password" autocomplete="off" placeholder="নতুন token দিন অথবা অপরিবর্তিত রাখুন" class="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-white text-sm font-mono placeholder-slate-600">
                                <button type="button" id="mt-toggle-token-btn" class="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs">👁️</button>
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-300 flex items-center justify-between">
                                <span>Test Event Code</span>
                                <button type="button" id="mt-clear-test-code" class="text-[10px] text-rose-400 hover:underline">ক্লিয়ার করুন</button>
                            </label>
                            <input id="mt-test-code" type="text" placeholder="TEST70704" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-white text-sm font-mono placeholder-slate-600 uppercase">
                            <p class="text-[10px] text-slate-400">লাইভ ট্র্যাকিংয়ের সময় এটি খালি রাখুন।</p>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-300">API Version</label>
                            <input id="mt-api-version" type="text" value="v21.0" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-white text-sm font-mono">
                        </div>
                    </div>
                </div>

                <!-- 2. Event Rules & Action Mappings -->
                <div>
                    <h4 class="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                        <span>🎯 ২. Event Tracking Rules & Custom Mappings</span>
                    </h4>

                    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        
                        <!-- PageView -->
                        <div class="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">📄</span>
                                    <span class="font-bold text-sm text-white">Page View</span>
                                </div>
                                <input id="mt-page-enabled" type="checkbox" class="w-4 h-4 accent-indigo-500 cursor-pointer">
                            </div>
                            <div class="mt-2">
                                <label class="text-[11px] text-slate-400 block mb-1">Meta Event Name</label>
                                <input id="mt-name-page" type="text" value="PageView" class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-indigo-300 focus:border-indigo-500 focus:outline-none">
                            </div>
                        </div>

                        <!-- Scroll Depth -->
                        <div class="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">📜</span>
                                    <span class="font-bold text-sm text-white">Scroll Depth</span>
                                </div>
                                <input id="mt-scroll-enabled" type="checkbox" class="w-4 h-4 accent-indigo-500 cursor-pointer">
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label class="text-[11px] text-slate-400 block mb-1">Threshold (%)</label>
                                    <input id="mt-scroll-percent" type="number" min="1" max="100" value="50" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none">
                                </div>
                                <div>
                                    <label class="text-[11px] text-slate-400 block mb-1">Event Name</label>
                                    <input id="mt-name-scroll" type="text" value="50%_Scroll" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-indigo-300 focus:border-indigo-500 focus:outline-none">
                                </div>
                            </div>
                        </div>

                        <!-- Time On Page -->
                        <div class="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">⏱️</span>
                                    <span class="font-bold text-sm text-white">Time On Page</span>
                                </div>
                                <input id="mt-time-enabled" type="checkbox" class="w-4 h-4 accent-indigo-500 cursor-pointer">
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label class="text-[11px] text-slate-400 block mb-1">Seconds</label>
                                    <input id="mt-time-seconds" type="number" min="1" max="3600" value="25" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none">
                                </div>
                                <div>
                                    <label class="text-[11px] text-slate-400 block mb-1">Event Name</label>
                                    <input id="mt-name-time" type="text" value="25S_TimeOnPage" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-indigo-300 focus:border-indigo-500 focus:outline-none">
                                </div>
                            </div>
                        </div>

                        <!-- WhatsApp Contact -->
                        <div class="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">💬</span>
                                    <span class="font-bold text-sm text-emerald-400">WhatsApp Lead/Click</span>
                                </div>
                                <input id="mt-wa-enabled" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer">
                            </div>
                            <div class="mt-2">
                                <label class="text-[11px] text-slate-400 block mb-1">Meta Event Name</label>
                                <input id="mt-name-wa" type="text" value="Wp_Contact" class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none">
                            </div>
                        </div>

                        <!-- Meeting Schedule -->
                        <div class="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-lg">📅</span>
                                    <span class="font-bold text-sm text-purple-400">Meeting Booking (Schedule)</span>
                                </div>
                                <input id="mt-meeting-enabled" type="checkbox" class="w-4 h-4 accent-purple-500 cursor-pointer">
                            </div>
                            <div class="mt-2">
                                <label class="text-[11px] text-slate-400 block mb-1">Meta Event Name</label>
                                <input id="mt-name-meeting" type="text" value="Schedule" class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-purple-300 focus:border-purple-500 focus:outline-none">
                            </div>
                        </div>

                        <!-- Action Toolbar -->
                        <div class="bg-slate-900/30 border border-dashed border-slate-700 rounded-2xl p-4 flex flex-col justify-center gap-2">
                            <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-900/50 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2">
                                <span>💾 সেভ করুন</span>
                            </button>
                            <button type="button" id="mt-btn-send-test" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-bold text-xs transition flex items-center justify-center gap-2">
                                <span>🚀 টেস্ট CAPI ইভেন্ট পাঠান</span>
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <!-- 3. Diagnostic Live Logs Feed -->
            <div class="mt-8 pt-6 border-t border-slate-700/80">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <h4 class="text-xs font-extrabold uppercase tracking-widest text-slate-300">
                            Server Conversions API (CAPI) Live Stream
                        </h4>
                    </div>
                    <div class="flex items-center gap-3">
                        <span id="mt-log-count" class="text-xs font-mono text-slate-400">0 logs</span>
                        <button type="button" id="mt-clear-logs-btn" class="text-xs text-rose-400 hover:text-rose-300 font-bold transition">
                            লগ ক্লিয়ার করুন
                        </button>
                    </div>
                </div>

                <div id="mt-event-log" class="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
                    <div class="text-slate-500 text-center py-4">এখনো কোনো CAPI ইভেন্ট রেকর্ড হয়নি।</div>
                </div>
            </div>
        `;

        // Insert right after KPI Overview
        if (main.children.length > 1) {
            main.insertBefore(card, main.children[1]);
        } else {
            main.appendChild(card);
        }

        // Attach Event Listeners
        document.getElementById('mt-form').addEventListener('submit', saveSettings);
        document.getElementById('mt-btn-send-test').addEventListener('click', sendTestEvent);
        document.getElementById('mt-clear-logs-btn').addEventListener('click', clearLogs);

        const clearTestCodeBtn = document.getElementById('mt-clear-test-code');
        if (clearTestCodeBtn) {
            clearTestCodeBtn.addEventListener('click', () => {
                document.getElementById('mt-test-code').value = '';
                showToast('Test Event Code ক্লিয়ার করা হয়েছে। Settings সেভ করুন।');
            });
        }

        const tokenToggleBtn = document.getElementById('mt-toggle-token-btn');
        if (tokenToggleBtn) {
            tokenToggleBtn.addEventListener('click', () => {
                const input = document.getElementById('mt-token');
                if (input.type === 'password') {
                    input.type = 'text';
                    tokenToggleBtn.innerText = '🔒';
                } else {
                    input.type = 'password';
                    tokenToggleBtn.innerText = '👁️';
                }
            });
        }
    }

    async function sendTestEvent() {
        const token = localStorage.getItem('bp_admin_token') || '';
        const btn = document.getElementById('mt-btn-send-test');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳ Meta API তে পাঠানো হচ্ছে...</span>';

        try {
            const res = await fetch('/api/admin/meta-tracking/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('🎉 টেস্ট ইভেন্ট সফলভাবে পাঠানো হয়েছে! Meta Events Manager এ চেক করুন।', 'success');
                if (window.fetchDashboard) window.fetchDashboard();
            } else {
                showToast('❌ টেস্ট ইভেন্ট ব্যর্থ: ' + (data.error || JSON.stringify(data.meta || data)), 'error');
            }
        } catch (err) {
            showToast('নেটওয়ার্ক ত্রুটি: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>🚀 টেস্ট CAPI ইভেন্ট পাঠান</span>';
        }
    }

    async function clearLogs() {
        const token = localStorage.getItem('bp_admin_token') || '';
        if (!confirm('আপনি কি সব CAPI ইভেন্ট লগ মুছে ফেলতে চান?')) return;
        try {
            await fetch('/api/admin/meta-tracking/clear-logs', {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            showToast('সব CAPI লগ সফলভাবে মুছে ফেলা হয়েছে।');
            if (window.fetchDashboard) window.fetchDashboard();
        } catch (e) {
            showToast('লগ ক্লিয়ার করতে সমস্যা হয়েছে', 'error');
        }
    }

    async function saveSettings(event) {
        event.preventDefault();
        const token = localStorage.getItem('bp_admin_token') || '';
        const tokenVal = document.getElementById('mt-token').value.trim();

        const payload = {
            enabled: document.getElementById('mt-enabled').checked,
            pixelId: document.getElementById('mt-pixel').value.trim(),
            accessToken: tokenVal ? tokenVal : '__UNCHANGED__',
            testEventCode: document.getElementById('mt-test-code').value.trim(),
            apiVersion: document.getElementById('mt-api-version').value.trim() || 'v21.0',
            pageViewEnabled: document.getElementById('mt-page-enabled').checked,
            scrollEnabled: document.getElementById('mt-scroll-enabled').checked,
            scrollPercent: document.getElementById('mt-scroll-percent').value,
            timeEnabled: document.getElementById('mt-time-enabled').checked,
            timeSeconds: document.getElementById('mt-time-seconds').value,
            whatsappEnabled: document.getElementById('mt-wa-enabled').checked,
            meetingEnabled: document.getElementById('mt-meeting-enabled').checked,
            eventNames: {
                pageView: document.getElementById('mt-name-page').value.trim(),
                scroll: document.getElementById('mt-name-scroll').value.trim(),
                timeOnPage: document.getElementById('mt-name-time').value.trim(),
                whatsapp: document.getElementById('mt-name-wa').value.trim(),
                meeting: document.getElementById('mt-name-meeting').value.trim()
            }
        };

        try {
            const response = await fetch('/api/admin/meta-tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': token },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) {
                showToast(data.error || 'সেটিংস সেভ করতে সমস্যা হয়েছে।', 'error');
                return;
            }
            document.getElementById('mt-token').value = '';
            showToast('✅ Meta Tracking সেটিংস সফলভাবে আপডেট ও সেভ হয়েছে!');
            if (window.fetchDashboard) window.fetchDashboard();
        } catch (e) {
            showToast('নেটওয়ার্ক সমস্যা: ' + e.message, 'error');
        }
    }

    function render(db) {
        injectCard();
        const config = db.metaTracking || {};
        const names = config.eventNames || {};

        const isEnabled = Boolean(config.enabled);
        const hasPixel = Boolean(config.pixelId);
        const hasToken = Boolean(config.accessTokenConfigured || config.accessToken);
        const testCode = config.testEventCode || '';

        // Status badge
        const badge = document.getElementById('mt-badge-status');
        if (badge) {
            if (!isEnabled) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-700 text-slate-400 border border-slate-600';
                badge.innerText = 'ইনঅ্যাক্টিভ';
            } else if (testCode) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40';
                badge.innerText = `টেস্ট মোড সক্রিয় (${testCode})`;
            } else if (hasPixel && hasToken) {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                badge.innerText = '🟢 লাইভ ট্র্যাকিং সক্রিয়';
            } else {
                badge.className = 'text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
                badge.innerText = 'অসম্পূর্ণ কনফিগারেশন';
            }
        }

        // Token status indicator
        const tokenStatus = document.getElementById('mt-token-status');
        if (tokenStatus) {
            if (hasToken) {
                tokenStatus.className = 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                tokenStatus.innerText = '✓ টোকেন সেভ করা আছে';
            } else {
                tokenStatus.className = 'text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30';
                tokenStatus.innerText = 'টোকেন দেওয়া হয়নি';
            }
        }

        document.getElementById('mt-enabled').checked = isEnabled;
        document.getElementById('mt-pixel').value = config.pixelId || '';
        document.getElementById('mt-test-code').value = testCode;
        document.getElementById('mt-api-version').value = config.apiVersion || 'v21.0';
        document.getElementById('mt-scroll-percent').value = config.scrollPercent || 50;
        document.getElementById('mt-time-seconds').value = config.timeSeconds || 25;

        document.getElementById('mt-page-enabled').checked = config.pageViewEnabled !== false;
        document.getElementById('mt-scroll-enabled').checked = config.scrollEnabled !== false;
        document.getElementById('mt-time-enabled').checked = config.timeEnabled !== false;
        document.getElementById('mt-wa-enabled').checked = config.whatsappEnabled !== false;
        document.getElementById('mt-meeting-enabled').checked = config.meetingEnabled !== false;

        document.getElementById('mt-name-page').value = names.pageView || 'PageView';
        document.getElementById('mt-name-scroll').value = names.scroll || '50%_Scroll';
        document.getElementById('mt-name-time').value = names.timeOnPage || '25S_TimeOnPage';
        document.getElementById('mt-name-wa').value = names.whatsapp || 'Wp_Contact';
        document.getElementById('mt-name-meeting').value = names.meeting || 'Schedule';

        // Render CAPI Logs
        const logContainer = document.getElementById('mt-event-log');
        const countBadge = document.getElementById('mt-log-count');
        const rows = db.metaTrackingEventLog || [];

        if (countBadge) countBadge.innerText = `${rows.length} ইভেন্ট`;

        if (logContainer) {
            if (rows.length === 0) {
                logContainer.innerHTML = '<div class="text-slate-500 text-center py-4">এখনো কোনো CAPI ইভেন্ট রেকর্ড হয়নি।</div>';
            } else {
                logContainer.innerHTML = rows.map((item, idx) => {
                    const isOk = item.status === 'delivered';
                    const isNetwork = item.status === 'network_error';
                    const statusClass = isOk ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : (isNetwork ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30');
                    const statusText = isOk ? 'Delivered (200 OK)' : (item.status || 'Failed');
                    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }) : '';

                    return `
                        <div class="bg-slate-900/80 border border-slate-700/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-600 transition">
                            <div class="flex items-center gap-3">
                                <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${statusClass}">
                                    ${escapeHtml(item.eventName || 'Event')}
                                </span>
                                <span class="text-xs font-mono text-slate-300" title="Event ID">
                                    ID: ${escapeHtml(item.eventId || 'N/A')}
                                </span>
                                ${item.hasPhone ? '<span class="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded" title="Phone Hash Included">Phone ✓</span>' : ''}
                                ${item.hasFbp ? '<span class="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded" title="fbp cookie present">fbp</span>' : ''}
                                ${item.hasFbc ? '<span class="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded" title="fbc click ID present">fbc</span>' : ''}
                            </div>
                            <div class="flex items-center gap-3 text-right">
                                <span class="text-[11px] font-bold ${isOk ? 'text-emerald-400' : 'text-rose-400'}">
                                    ${escapeHtml(statusText)}
                                </span>
                                <span class="text-[11px] text-slate-500 whitespace-nowrap">
                                    ${escapeHtml(timeStr)}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
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
