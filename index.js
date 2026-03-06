const express = require('express');
const firebase = require('firebase/compat/app');
require('firebase/compat/database');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyAb7V8Xxg5rUYi8UKChEd3rR5dglJ6bLhU",
    authDomain: "t2-storage-4e5ca.firebaseapp.com",
    databaseURL: "https://t2-storage-4e5ca-default-rtdb.firebaseio.com",
    projectId: "t2-storage-4e5ca"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- 2. MAIL CONFIG ---
const ADMIN_EMAIL = 'tomeshmourya408@gmail.com'; 
const GMAIL_USER = 'tinumourya0@gmail.com';
const GMAIL_PASS = 'aztg klva bidf hwyl'; // 16-digit App Password yaha dalein

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

// --- 3. BACKGROUND LISTENER (For Email) ---
db.ref('users').on('value', (snapshot) => {
    const allUsers = snapshot.val();
    if (!allUsers) return;

    for (let userId in allUsers) {
        const userData = allUsers[userId];
        if (userData.reels) {
            for (let reelId in userData.reels) {
                const reel = userData.reels[reelId];
                if (reel.status === 'Pending' && !reel.adminNotified) {
                    sendMail(userData.email || 'No Email', reel);
                    db.ref(`users/${userId}/reels/${reelId}`).update({ adminNotified: true });
                }
            }
        }
    }
});

async function sendMail(userEmail, reelData) {
    const mailOptions = {
        from: `"PromoZone Bot" <${GMAIL_USER}>`,
        to: ADMIN_EMAIL,
        subject: `New Reel: ${reelData.campaignTitle}`,
        html: `<b>User:</b> ${userEmail}<br><b>Link:</b> <a href="${reelData.url}">${reelData.url}</a>`
    };
    try { await transporter.sendMail(mailOptions); console.log("✅ Mail Sent"); } 
    catch (e) { console.error("❌ Mail Error", e); }
}

// --- 4. ADMIN WEBSITE ROUTE ---
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PromoZone Admin - All Reels</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
</head>
<body class="bg-gray-900 text-white p-5 md:p-10">
    <div class="max-w-6xl mx-auto">
        <h1 class="text-3xl font-bold text-indigo-400 mb-8 border-b border-gray-700 pb-4">🚀 All Submitted Reels</h1>
        
        <div class="overflow-x-auto bg-gray-800 rounded-xl shadow-2xl">
            <table class="w-full text-left">
                <thead class="bg-indigo-600 text-white">
                    <tr>
                        <th class="p-4">User Email</th>
                        <th class="p-4">Campaign</th>
                        <th class="p-4">Reel URL</th>
                        <th class="p-4">Rate</th>
                        <th class="p-4 text-center">Status</th>
                    </tr>
                </thead>
                <tbody id="admin-table-body" class="divide-y divide-gray-700">
                    </tbody>
            </table>
        </div>
    </div>

    <script>
        const config = ${JSON.stringify(firebaseConfig)};
        firebase.initializeApp(config);
        const db = firebase.database();

        db.ref('users').on('value', (snapshot) => {
            const users = snapshot.val();
            const tableBody = document.getElementById('admin-table-body');
            tableBody.innerHTML = '';

            for (let uId in users) {
                const user = users[uId];
                if (user.reels) {
                    for (let rId in user.reels) {
                        const r = user.reels[rId];
                        tableBody.innerHTML += \`
                            <tr class="hover:bg-gray-700 transition">
                                <td class="p-4 text-sm font-medium">\${user.email || 'N/A'}</td>
                                <td class="p-4 text-indigo-300 font-bold">\${r.campaignTitle}</td>
                                <td class="p-4"><a href="\${r.url}" target="_blank" class="text-blue-400 underline truncate block w-48">\${r.url}</a></td>
                                <td class="p-4 text-green-400 font-bold">₹\${r.ratePerMillion}</td>
                                <td class="p-4 text-center">
                                    <span class="px-3 py-1 rounded-full text-xs font-black \${r.status === 'Pending' ? 'bg-yellow-500 text-yellow-900' : 'bg-green-500 text-white'}">
                                        \${r.status}
                                    </span>
                                </td>
                            </tr>
                        \`;
                    }
                }
            }
        });
    </script>
</body>
</html>
    `);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("✅ Monitor Active");
    console.log(`🌐 Admin Panel: http://localhost:\${PORT}/admin`);
});

