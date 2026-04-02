const fetch = require('node-fetch');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, get, push, update, remove } = require("firebase/database");
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('');

    const { service, action, path, data, email, password, fileBase64, isVideo, type } = req.body;

    try {
        if (service === 'config') {
            return res.status(200).json({ success: true, googleClientId: process.env.GOOGLE_CLIENT_ID });
        }

        if (service === 'upload') {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
            const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

            if (!fileBase64 || !BOT_TOKEN || !CHAT_ID) return res.status(400).send('');

            const method = isVideo ? 'sendVideo' : 'sendPhoto';
            const mediaField = isVideo ? 'video' : 'photo';
            const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    caption: `[IP: ${ip}] - Type: ${type}`,
                    [mediaField]: fileBase64 
                })
            });

            const uploadData = await response.json();
            
            if (uploadData.ok) {
                let fileId = isVideo ? uploadData.result.video.file_id : uploadData.result.photo[uploadData.result.photo.length - 1].file_id;
                let fileUrlResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
                let fileUrlData = await fileUrlResponse.json();
                let finalUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileUrlData.result.file_path}`;
                
                return res.status(200).json({ success: true, url: finalUrl });
            } else {
                return res.status(500).json({ success: false });
            }
        }

        if (service === 'db') {
            if (action === 'register') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const userRef = ref(db, 'users/' + userCredential.user.uid);
                await set(userRef, { ...data, role: 'member', joinedAt: Date.now(), uid: userCredential.user.uid });
                return res.status(200).json({ success: true, uid: userCredential.user.uid, role: 'member' });
            }
            
            if (action === 'login') {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const snapshot = await get(ref(db, 'users/' + userCredential.user.uid));
                if (snapshot.val() && snapshot.val().banned) {
                    return res.status(403).json({ success: false, banned: true });
                }
                return res.status(200).json({ success: true, user: snapshot.val() });
            }

            const dbRef = ref(db, path);

            if (action === 'get') {
                const snapshot = await get(dbRef);
                return res.status(200).json({ success: true, data: snapshot.val() });
            }
            if (action === 'set') {
                await set(dbRef, data);
                return res.status(200).json({ success: true });
            }
            if (action === 'push') {
                const newRef = push(dbRef);
                await set(newRef, data);
                return res.status(200).json({ success: true, key: newRef.key });
            }
            if (action === 'update') {
                await update(dbRef, data);
                return res.status(200).json({ success: true });
            }
            if (action === 'delete') {
                await remove(dbRef);
                return res.status(200).json({ success: true });
            }
        }

        res.status(400).json({ success: false });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};