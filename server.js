<<<<<<< HEAD
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
// 📁 LOCAL JSON DATABASE SETUP (data/db.json)
// ==========================================
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
        enabled: false,
        pixelId: '',
        accessToken: '',
        testEventCode: '',
        apiVersion: 'v21.0',
        pageViewEnabled: true,
        scrollEnabled: true,
        scrollPercent: 50,
        timeEnabled: true,
        timeSeconds: 30,
        whatsappEnabled: true,
        meetingEnabled: true,
        eventNames: {
            pageView: 'PageView',
            scroll: 'CustomScroll',
            timeOnPage: 'TimeOnPage',
            whatsapp: 'Contact',
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
            fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
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

// ইমেইল নোটিফিকেশন ফাংশন (Nodemailer ইনস্টল থাকলে সরাসরি মেইল পাঠাবে)
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
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #4f46e5;">নতুন ১-টু-১ ডেমো মিটিং বুক করা হয়েছে!</h2>
                    <p><strong>কাস্টমারের নাম:</strong> ${meeting.name}</p>
                    <p><strong>হোয়াটসঅ্যাপ/ফোন:</strong> ${meeting.phone}</p>
                    <p><strong>ওয়েবসাইট:</strong> ${meeting.website || 'N/A'}</p>
                    <p><strong>মিটিংয়ের তারিখ:</strong> ${meeting.date}</p>
                    <p><strong>মিটিংয়ের সময়:</strong> ${meeting.time}</p>
                    <p><strong>নোট:</strong> ${meeting.note || 'কোনো নোট নেই'}</p>
                    <hr/>
                    <p>অ্যাডমিন প্যানেলে লগইন করে বিস্তারিত দেখুন।</p>
                </div>
            `
        });
        console.log('📧 ইমেইল নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!');
    } catch (e) {
        console.log('⚠️ ইমেইল পাঠাতে হলে টার্মিনালে "pnpm add nodemailer" রান করুন এবং SMTP_PASS সেট করুন।');
    }
}

// ==========================================
// 🌐 PUBLIC API ENDPOINTS
// ==========================================

// ১. পেজ ভিউ ও পাবলিক রিভিউ লোড করা
app.get('/api/public-data', (req, res) => {
    const db = readDB();
    db.stats.pageViews = (db.stats.pageViews || 0) + 1;
    writeDB(db);
    res.json({ reviews: db.reviews });
});

// ২. হোয়াটসঅ্যাপ বাটন ক্লিক অটো-ট্র্যাকিং
app.post('/api/track-whatsapp', (req, res) => {
    const db = readDB();
    db.stats.whatsappClicks = (db.stats.whatsappClicks || 0) + 1;
    db.whatsappLogs.unshift({
        id: 'wa-' + Date.now(),
        source: req.body.source || 'WhatsApp Button',
        timestamp: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    // সর্বোচ্চ ১০০টি লগ রাখবে যেন ফাইল হালকা থাকে
    if (db.whatsappLogs.length > 100) db.whatsappLogs.pop();
    writeDB(db);
    res.json({ success: true });
});

// ৩. ফ্রন্টএন্ড থেকে মিটিং বুকিং সাবমিশন
app.post('/api/book-meeting', async (req, res) => {
    const { name, phone, website, date, time, note } = req.body;
    if (!name || !phone || !date || !time) {
        return res.status(400).json({ error: 'অনুগ্রহ করে নাম, ফোন নাম্বার, তারিখ ও সময় পূরণ করুন।' });
    }

    const db = readDB();
    const newMeeting = {
        id: 'mtg-' + Date.now(),
        name,
        phone,
        website: website || '',
        date,
        time,
        note: note || '',
        status: 'Pending', // Pending | Joined | Sold | Cancelled
        createdAt: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })
    };

    db.meetings.unshift(newMeeting);
    writeDB(db);

    // ব্যাকগ্রাউন্ডে ইমেইল নোটিফিকেশন ট্রিগার
    sendMeetingEmail(newMeeting);

    res.json({ success: true, message: 'আপনার মিটিং সফলভাবে বুক হয়েছে!' });
});

// ==========================================
// 🔒 ADMIN AUTHENTICATION & PROTECTED APIs
// ==========================================

function requireAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (token && activeTokens.has(token)) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized! দয়া করে আবার লগইন করুন।' });
}

registerMetaTracking(app, { readDB, writeDB, requireAdmin });

// অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        const token = crypto.randomBytes(24).toString('hex');
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

        // যদি মিটিং থেকে সরাসরি "Sold" মার্ক করা হয় তবে অটো সেলস ও রেভিনিউ বাড়বে
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

// ম্যানুয়ালি কাউন্টার আপডেট করা (WhatsApp, Sales, Revenue)
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

app.listen(PORT, () => {
    console.log(`🚀 ল্যান্ডিং পেজ চলছে: http://localhost:${PORT}`);
    console.log(`🔐 অ্যাডমিন প্যানেল লিংক: http://localhost:${PORT}/admin`);
    console.log(`🔑 ডিফল্ট ইউজার: ${ADMIN_CONFIG.username} | পাসওয়ার্ড: ${ADMIN_CONFIG.password}`);
=======
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
// 📁 LOCAL JSON DATABASE SETUP (data/db.json)
// ==========================================
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
        enabled: false,
        pixelId: '',
        accessToken: '',
        testEventCode: '',
        apiVersion: 'v21.0',
        pageViewEnabled: true,
        scrollEnabled: true,
        scrollPercent: 50,
        timeEnabled: true,
        timeSeconds: 30,
        whatsappEnabled: true,
        eventNames: {
            pageView: 'PageView',
            scroll: 'CustomScroll',
            timeOnPage: 'TimeOnPage',
            whatsapp: 'Contact'
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
            fs.writeFileSync(dbFile, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
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

// ইমেইল নোটিফিকেশন ফাংশন (Nodemailer ইনস্টল থাকলে সরাসরি মেইল পাঠাবে)
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
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #4f46e5;">নতুন ১-টু-১ ডেমো মিটিং বুক করা হয়েছে!</h2>
                    <p><strong>কাস্টমারের নাম:</strong> ${meeting.name}</p>
                    <p><strong>হোয়াটসঅ্যাপ/ফোন:</strong> ${meeting.phone}</p>
                    <p><strong>ওয়েবসাইট:</strong> ${meeting.website || 'N/A'}</p>
                    <p><strong>মিটিংয়ের তারিখ:</strong> ${meeting.date}</p>
                    <p><strong>মিটিংয়ের সময়:</strong> ${meeting.time}</p>
                    <p><strong>নোট:</strong> ${meeting.note || 'কোনো নোট নেই'}</p>
                    <hr/>
                    <p>অ্যাডমিন প্যানেলে লগইন করে বিস্তারিত দেখুন।</p>
                </div>
            `
        });
        console.log('📧 ইমেইল নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!');
    } catch (e) {
        console.log('⚠️ ইমেইল পাঠাতে হলে টার্মিনালে "pnpm add nodemailer" রান করুন এবং SMTP_PASS সেট করুন।');
    }
}

// ==========================================
// 🌐 PUBLIC API ENDPOINTS
// ==========================================

// ১. পেজ ভিউ ও পাবলিক রিভিউ লোড করা
app.get('/api/public-data', (req, res) => {
    const db = readDB();
    db.stats.pageViews = (db.stats.pageViews || 0) + 1;
    writeDB(db);
    res.json({ reviews: db.reviews });
});

// ২. হোয়াটসঅ্যাপ বাটন ক্লিক অটো-ট্র্যাকিং
app.post('/api/track-whatsapp', (req, res) => {
    const db = readDB();
    db.stats.whatsappClicks = (db.stats.whatsappClicks || 0) + 1;
    db.whatsappLogs.unshift({
        id: 'wa-' + Date.now(),
        source: req.body.source || 'WhatsApp Button',
        timestamp: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    // সর্বোচ্চ ১০০টি লগ রাখবে যেন ফাইল হালকা থাকে
    if (db.whatsappLogs.length > 100) db.whatsappLogs.pop();
    writeDB(db);
    res.json({ success: true });
});

// ৩. ফ্রন্টএন্ড থেকে মিটিং বুকিং সাবমিশন
app.post('/api/book-meeting', async (req, res) => {
    const { name, phone, website, date, time, note } = req.body;
    if (!name || !phone || !date || !time) {
        return res.status(400).json({ error: 'অনুগ্রহ করে নাম, ফোন নাম্বার, তারিখ ও সময় পূরণ করুন।' });
    }

    const db = readDB();
    const newMeeting = {
        id: 'mtg-' + Date.now(),
        name,
        phone,
        website: website || '',
        date,
        time,
        note: note || '',
        status: 'Pending', // Pending | Joined | Sold | Cancelled
        createdAt: new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })
    };

    db.meetings.unshift(newMeeting);
    writeDB(db);

    // ব্যাকগ্রাউন্ডে ইমেইল নোটিফিকেশন ট্রিগার
    sendMeetingEmail(newMeeting);

    res.json({ success: true, message: 'আপনার মিটিং সফলভাবে বুক হয়েছে!' });
});

// ==========================================
// 🔒 ADMIN AUTHENTICATION & PROTECTED APIs
// ==========================================

function requireAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (token && activeTokens.has(token)) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized! দয়া করে আবার লগইন করুন।' });
}

registerMetaTracking(app, { readDB, writeDB, requireAdmin });

// অ্যাডমিন লগইন
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        const token = crypto.randomBytes(24).toString('hex');
        activeTokens.add(token);
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: 'ভুল ইউজার আইডি অথবা পাসওয়ার্ড!' });
});

// অ্যাডমিন ড্যাশবোর্ডের সব ডেটা পাওয়া
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    const db = readDB();
    res.json(db);
});

// মিটিং স্ট্যাটাস আপডেট করা (যেমন: Joined, Sold, Cancelled)
app.post('/api/admin/meeting-status', requireAdmin, (req, res) => {
    const { id, status } = req.body;
    const db = readDB();
    const meeting = db.meetings.find(m => m.id === id);
    if (meeting) {
        const prevStatus = meeting.status;
        meeting.status = status;

        // যদি মিটিং থেকে সরাসরি "Sold" মার্ক করা হয় তবে অটো সেলস ও রেভিনিউ বাড়বে
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

// ম্যানুয়ালি কাউন্টার আপডেট করা (WhatsApp, Sales, Revenue)
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

app.listen(PORT, () => {
    console.log(`🚀 ল্যান্ডিং পেজ চলছে: http://localhost:${PORT}`);
    console.log(`🔐 অ্যাডমিন প্যানেল লিংক: http://localhost:${PORT}/admin`);
    console.log(`🔑 ডিফল্ট ইউজার: ${ADMIN_CONFIG.username} | পাসওয়ার্ড: ${ADMIN_CONFIG.password}`);
>>>>>>> 97757a7ea06f9cd35817f4c9da858d021b98fc99
});