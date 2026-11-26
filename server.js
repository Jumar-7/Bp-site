import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { registerMetaTracking } from './server/meta-tracking.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🔐 ADMIN LOGIN & EMAIL CONFIGURATION
// ==========================================
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USER || 'admin',       // আপনার অ্যাডমিন ইউজার আইডি
    password: process.env.ADMIN_PASS || 'bp2026pro',   // আপনার অ্যাডমিন পাসওয়ার্ড
    notifyEmail: process.env.NOTIFY_EMAIL || 'mdkazi72891@gmail.com', // যে মেইলে বুকিং নোটিফিকেশন যাবে
    smtpAppPassword: process.env.SMTP_PASS || 'pfbo pkml yjzw jlet'       // Gmail App Password (ইমেইল পাঠানোর জন্য ঐচ্ছিক)
};

// সেশন টোকেন স্টোর (মেমোরিতে থাকবে)
const activeTokens = new Set();

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 📁 JSON DATABASE SETUP (Local & Vercel /tmp)
// ==========================================
const isVercel = Boolean(process.env.VERCEL);
const localDataDir = path.join(__dirname, 'data');
const localDbFile = path.join(localDataDir, 'db.json');
const targetDataDir = isVercel ? '/tmp' : localDataDir;
const dbFile = isVercel ? path.join('/tmp', 'db.json') : localDbFile;

if (!fs.existsSync(targetDataDir)) {
    try {
        fs.mkdirSync(targetDataDir, { recursive: true });
    } catch (e) {
        console.warn('Could not create directory:', targetDataDir, e);
    }
}

const defaultData = {
    stats: {
        pageViews: 0,
        whatsappClicks: 0,
        manualWhatsappAdjustment: 0,
        salesClosed: 0,
        totalRevenue: 0
    },
    meetings: [],
    salesList: [],
    whatsappLogs: [],
    metaTrackingEventLog: [],
    metaTracking: {
        enabled: true,
        pixelId: '1364021745113504',
        accessToken: 'EAAKOeKxJwGUBTCwuKggWdGAgMqodke0LRqzty2Q5f37zMaLsb7y3lZAyY8JLeGMZAIrBK0SHZBss51hNtHFMZBWhLZCQBpz7wNNHqiZAKyDZCHPiZB9NAApXZBrNURMYtZBEVQfuNvotZBqmiAxlAsZCUgUeVSXwtSTstfmaXLFpohE35uVrrZBbuBFqcLNtuHJR9IwZDZD',
        testEventCode: '',
        apiVersion: 'v21.0',
        pageViewEnabled: true,
        scrollEnabled: true,
        scrollPercent: 50,
        timeEnabled: true,
        timeSeconds: 25,
        whatsappEnabled: true,
        meetingEnabled: true,
        eventNames: {
            pageView: 'PageView',
            scroll: '50%_Scroll',
            timeOnPage: '25S_TimeOnPage',
            whatsapp: 'Wp_Contact',
            meeting: 'Schedule'
        }
    },
    reviews: [
        {
            id: "rev-1",
            name: "মো: রাকিব হাসান",
            role: "ফাউন্ডার, ফ্যাশন মার্ট বিডি",
            headline: "ফেইক অর্ডার ৯৮% কমে গেছে এবং অ্যাডের CPR অর্ধেকে নেমে এসেছে!",
            comment: "আগে প্রতিদিন ২০-২৫টা ভুয়া অর্ডার আসতো। ভাইদের এই সার্ভিস নেওয়ার পর বট এবং ফেইক অর্ডার একদম বন্ধ!",
            youtubeId: "dQw4w9WgXcQ",
            rating: 5
        },
        {
            id: "rev-2",
            name: "তানভীর আহমেদ",
            role: "ওনার, গ্যাজেট হাব",
            headline: "অ্যাবানডন্ড কার্ট থেকে প্রতিদিন ১০+ এক্সট্রা অর্ডার কনফার্ম করছি!",
            comment: "কাস্টমার নাম্বার লিখে পেজ কেটে দিলেও সাথে সাথে নাম্বার পেয়ে যাই। কল দিলেই অর্ডার কনফার্ম হয়!",
            youtubeId: "dQw4w9WgXcQ",
            rating: 5
        },
        {
            id: "rev-3",
            name: "শাফিন চৌধুরী",
            role: "অর্গানিক ফুড স্টোর",
            headline: "Ordered_Customers_Visit ইভেন্ট দিয়ে রিটার্গেটিং করে বাজিমাত!",
            comment: "পুরাতন কাস্টমার সাইটে আসলেই ট্র্যাক করতে পারছি, আর Stape.io-এর মাসিক ২০ ডলারও বেঁচে গেছে।",
            youtubeId: "dQw4w9WgXcQ",
            rating: 5
        },
        {
            id: "rev-4",
            name: "মাহমুদুল হাসান",
            role: "সিইও, ডেইলি নিডস বিডি",
            headline: "অর্ডার ডেটা এক্সট্রাকশন ও UTM ট্র্যাকিং আমাদের ক্যাম্পেইন সহজ করে দিয়েছে!",
            comment: "কোন প্রোডাক্টে কত তারিখ থেকে কত তারিখে কত অর্ডার আসছে তা ১ ক্লিকেই বের করতে পারছি। অসাধারণ সাপোর্ট!",
            youtubeId: "dQw4w9WgXcQ",
            rating: 5
        }
    ]
};

function readDB() {
    try {
        if (!fs.existsSync(dbFile)) {
            let initialData = defaultData;
            if (isVercel && fs.existsSync(localDbFile)) {
                try {
                    initialData = JSON.parse(fs.readFileSync(localDbFile, 'utf8'));
                } catch (e) {
                    initialData = defaultData;
                }
            }
            fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (err) {
        console.error('Database read error:', err);
        return defaultData;
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Database write error:', err);
    }
}

// ইমেইল নোটিফিকেশন ফাংশন
async function sendMeetingEmail(meeting) {
    console.log(`\n🔔 [নতুন মিটিং বুকিং অ্যালার্ট!]`);
    console.log(`নাম: ${meeting.name} | ফোন: ${meeting.phone}`);
    console.log(`তারিখ: ${meeting.date} | সময়: ${meeting.time}`);
    console.log(`ওয়েবসাইট: ${meeting.website || 'দেওয়া হয়নি'}\n`);

    if (!ADMIN_CONFIG.smtpAppPassword) return;

    try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
            service: 'gmail',
            auth: {
                user: ADMIN_CONFIG.notifyEmail,
                pass: ADMIN_CONFIG.smtpAppPassword
            }
        });

        await transporter.sendMail({
            from: `"Backend Pixel Pro" <${ADMIN_CONFIG.notifyEmail}>`,
            to: ADMIN_CONFIG.notifyEmail,
            subject: `📅 নতুন মিটিং বুকিং: ${meeting.name} (${meeting.date} - ${meeting.time})`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                    <h2 style="color: #4f46e5; border-bottom: 2px solid #e0e7ff; padding-bottom: 8px;">🚀 নতুন ১-অন-১ মিটিং বুকিং!</h2>
                    <p>আপনার ল্যান্ডিং পেজ থেকে একজন ক্লায়েন্ট মিটিং শিডিউল করেছেন:</p>
                    <table style="width: 100%; max-width: 500px; border-collapse: collapse; margin-top: 15px;">
                        <tr style="background-color: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">নাম:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${meeting.name}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">ফোন নাম্বার:</td><td style="padding: 8px; border: 1px solid #cbd5e1;"><a href="tel:${meeting.phone}">${meeting.phone}</a> (<a href="https://wa.me/${meeting.phone.replace(/[^0-9]/g, '')}">হোয়াটসঅ্যাপ</a>)</td></tr>
                        <tr style="background-color: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">ওয়েবসাইট/পেজ:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${meeting.website || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">মিটিং এর তারিখ:</td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #4f46e5; font-weight: bold;">${meeting.date}</td></tr>
                        <tr style="background-color: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">মিটিং এর সময়:</td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #4f46e5; font-weight: bold;">${meeting.time}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">নোট/মেসেজ:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${meeting.note || 'কোনো মেসেজ নেই'}</td></tr>
                        <tr style="background-color: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">বুকিং এর সময়:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${meeting.createdAt}</td></tr>
                    </table>
                    <p style="margin-top: 20px; font-size: 13px; color: #64748b;">অ্যাডমিন প্যানেল থেকে বিস্তারিত দেখতে <a href="http://localhost:${PORT}/admin">এখানে ক্লিক করুন</a>।</p>
                </div>
            `
        });
        console.log(`✉️ ইমেইল সফলভাবে পাঠানো হয়েছে: ${ADMIN_CONFIG.notifyEmail}`);
    } catch (error) {
        console.error('❌ ইমেইল পাঠাতে সমস্যা হয়েছে:', error.message);
    }
}

// ==========================================
// 🌐 PUBLIC API ROUTES
// ==========================================

// পেজ ভিউ বৃদ্ধি ও পাবলিক ডাটা
app.get('/api/public-data', (req, res) => {
    const db = readDB();
    db.stats.pageViews = (db.stats.pageViews || 0) + 1;
    writeDB(db);

    res.json({
        reviews: db.reviews || [],
        whatsappNumber: '+8801521771966'
    });
});

// হোয়াটসঅ্যাপ ক্লিক ট্র্যাকিং
app.post('/api/track-whatsapp', (req, res) => {
    const { source } = req.body || {};
    const db = readDB();

    db.stats.whatsappClicks = (db.stats.whatsappClicks || 0) + 1;

    db.whatsappLogs = db.whatsappLogs || [];
    db.whatsappLogs.unshift({
        id: 'wa-' + Date.now(),
        source: source || 'Direct Click',
        timestamp: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    if (db.whatsappLogs.length > 50) db.whatsappLogs = db.whatsappLogs.slice(0, 50);

    writeDB(db);
    res.json({ success: true, count: db.stats.whatsappClicks });
});

// ১-অন-১ মিটিং বুকিং
app.post('/api/book-meeting', async (req, res) => {
    const { name, phone, website, date, time, note } = req.body;

    if (!name || !phone || !date || !time) {
        return res.status(400).json({ error: 'নাম, ফোন নম্বর, তারিখ এবং সময় আবশ্যক!' });
    }

    const db = readDB();
    const newMeeting = {
        id: 'meet-' + Date.now(),
        name,
        phone,
        website: website || '',
        date,
        time,
        note: note || '',
        status: 'Pending',
        createdAt: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })
    };

    db.meetings = db.meetings || [];
    db.meetings.unshift(newMeeting);
    writeDB(db);

    sendMeetingEmail(newMeeting);

    res.json({ success: true, message: 'মিটিং বুকিং সম্পন্ন হয়েছে!', meeting: newMeeting });
});

// ==========================================
// 🛡️ ADMIN AUTHENTICATION & DASHBOARD APIS
// ==========================================

function requireAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (token && activeTokens.has(token)) {
        return next();
    }
    return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস! অনুগ্রহ করে লগইন করুন।' });
}

// Meta Pixel + CAPI রেজিস্টার
registerMetaTracking(app, { readDB, writeDB, requireAdmin });

// অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        const token = 'bp_tok_' + crypto.randomBytes(24).toString('hex');
        activeTokens.add(token);
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: 'ভুল ইউজার আইডি অথবা পাসওয়ার্ড!' });
});

// অ্যাডমিন ড্যাশবোর্ডের সব ডেটা পাওয়া
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    const db = readDB();
    const safeDb = JSON.parse(JSON.stringify(db));
    if (safeDb.metaTracking) {
        safeDb.metaTracking.accessTokenConfigured = Boolean(safeDb.metaTracking.accessToken);
        delete safeDb.metaTracking.accessToken;
    }
    res.json(safeDb);
});

// মিটিং স্ট্যাটাস আপডেট করা (যেমন: Joined, Sold, Cancelled)
app.post('/api/admin/meeting-status', requireAdmin, (req, res) => {
    const { id, status } = req.body;
    const db = readDB();
    const meeting = db.meetings.find(m => m.id === id);
    if (meeting) {
        const prevStatus = meeting.status;
        meeting.status = status;

        if (status === 'Sold' && prevStatus !== 'Sold') {
            db.stats.salesClosed = (db.stats.salesClosed || 0) + 1;
            db.stats.totalRevenue = (db.stats.totalRevenue || 0) + 3499;
            db.salesList.unshift({
                id: 'sale-' + Date.now(),
                clientName: meeting.name,
                phone: meeting.phone,
                amount: 3499,
                source: 'Meeting Conversion',
                date: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })
            });
        }
        writeDB(db);
    }
    res.json({ success: true, db });
});

// মিটিং ডিলিট করা
app.delete('/api/admin/meeting/:id', requireAdmin, (req, res) => {
    const db = readDB();
    db.meetings = db.meetings.filter(m => m.id !== req.params.id);
    writeDB(db);
    res.json({ success: true, db });
});

// ম্যানুয়ালি কাউন্টার আপডেট করা
app.post('/api/admin/update-counters', requireAdmin, (req, res) => {
    const { whatsappClicks, salesClosed, totalRevenue } = req.body;
    const db = readDB();
    if (whatsappClicks !== undefined) db.stats.whatsappClicks = Number(whatsappClicks);
    if (salesClosed !== undefined) db.stats.salesClosed = Number(salesClosed);
    if (totalRevenue !== undefined) db.stats.totalRevenue = Number(totalRevenue);
    writeDB(db);
    res.json({ success: true, db });
});

// ম্যানুয়ালি নতুন সেল এন্ট্রি যোগ করা
app.post('/api/admin/add-sale', requireAdmin, (req, res) => {
    const { clientName, phone, amount, source } = req.body;
    const db = readDB();
    const saleAmount = Number(amount) || 3499;

    db.stats.salesClosed = (db.stats.salesClosed || 0) + 1;
    db.stats.totalRevenue = (db.stats.totalRevenue || 0) + saleAmount;

    db.salesList.unshift({
        id: 'sale-' + Date.now(),
        clientName: clientName || 'WhatsApp Client',
        phone: phone || 'N/A',
        amount: saleAmount,
        source: source || 'WhatsApp Direct',
        date: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })
    });

    writeDB(db);
    res.json({ success: true, db });
});

// নতুন কাস্টমার রিভিউ যোগ করা
app.post('/api/admin/reviews', requireAdmin, (req, res) => {
    const { name, role, headline, comment, youtubeId } = req.body;
    const db = readDB();
    db.reviews.unshift({
        id: 'rev-' + Date.now(),
        name,
        role,
        headline,
        comment,
        youtubeId: youtubeId || 'dQw4w9WgXcQ',
        rating: 5
    });
    writeDB(db);
    res.json({ success: true, db });
});

// কাস্টমার রিভিউ ডিলিট করা
app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const db = readDB();
    db.reviews = db.reviews.filter(r => r.id !== req.params.id);
    writeDB(db);
    res.json({ success: true, db });
});

// Static Files Serve
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h'
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 ল্যান্ডিং পেজ চলছে: http://localhost:${PORT}`);
        console.log(`🔐 অ্যাডমিন প্যানেল লিংক: http://localhost:${PORT}/admin`);
        console.log(`🔑 ডিফল্ট ইউজার: ${ADMIN_CONFIG.username} | পাসওয়ার্ড: ${ADMIN_CONFIG.password}`);
    });
}

export default app;
