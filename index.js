const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json());
app.use(cors());

// --- FRONTEND UI SOURCE ---
const html = `
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pro Hybrid Scraper</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
        .loader { border-top-color: #3b82f6; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen p-4 md:p-10 font-sans">
    <div class="max-w-5xl mx-auto">
        <header class="text-center mb-10">
            <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">HYBRID SCRAPER PRO</h1>
            <p class="text-slate-500 mt-2 text-sm">Extract products from Meesho, Amazon, or any site instantly.</p>
        </header>

        <div class="glass p-6 rounded-3xl mb-8">
            <div class="flex flex-col md:flex-row gap-4">
                <input type="text" id="url" placeholder="Paste product listing URL..." 
                       class="flex-1 bg-slate-900 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-cyan-500 transition-all">
                <select id="mode" class="bg-slate-900 p-4 rounded-2xl border-none outline-none">
                    <option value="fast">Fast (Static)</option>
                    <option value="deep">Deep (Dynamic/Secure)</option>
                </select>
                <button onclick="run()" class="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-4 px-8 rounded-2xl transition-all active:scale-95">Extract Data</button>
            </div>
        </div>

        <div id="loading" class="hidden flex flex-col items-center py-10">
            <div class="loader w-12 h-12 border-4 border-slate-700 rounded-full mb-4"></div>
            <p class="text-cyan-400 animate-pulse">Bypassing Security & Reading Data...</p>
        </div>

        <div id="results-wrap" class="hidden">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">Extracted Products (<span id="count" class="text-cyan-400">0</span>)</h2>
                <button onclick="exportCSV()" class="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 px-4 rounded-full transition-all">Download CSV</button>
            </div>
            <div id="grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
        </div>
    </div>

    <script>
        let items = [];
        async function run() {
            const url = document.getElementById('url').value;
            const mode = document.getElementById('mode').value;
            if(!url) return alert("URL zaroori hai bhai!");

            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('results-wrap').classList.add('hidden');

            try {
                const res = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ url, mode })
                });
                const data = await res.json();
                if(data.success) {
                    items = data.products;
                    document.getElementById('count').innerText = items.length;
                    document.getElementById('grid').innerHTML = items.map(p => \`
                        <div class="glass p-4 rounded-2xl hover:border-cyan-500/50 transition-all group">
                            <img src="\${p.image}" class="w-full h-40 object-contain rounded-xl mb-4 bg-white/5 p-2 group-hover:scale-105 transition-transform">
                            <h3 class="text-sm font-semibold line-clamp-2 h-10 mb-2">\${p.name}</h3>
                            <div class="text-lg font-black text-cyan-400">\${p.price}</div>
                        </div>
                    \`).join('');
                    document.getElementById('results-wrap').classList.remove('hidden');
                } else { alert("Failed: " + data.message); }
            } catch (e) { alert("Error connecting to API"); }
            finally { document.getElementById('loading').classList.add('hidden'); }
        }

        function exportCSV() {
            let csv = "Product,Price,Image\\n";
            items.forEach(i => csv += \`"\${i.name.replace(/"/g,'')}", "\${i.price}", "\${i.image}"\\n\`);
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'extracted_data.csv';
            link.click();
        }
    </script>
</body>
</html>
`;

// --- BACKEND API ---
app.get('/', (req, res) => res.send(html));

app.post('/api/scrape', async (req, res) => {
    const { url, mode } = req.body;
    let products = [];
    let browser = null;

    try {
        if (mode === 'deep') {
            browser = await puppeteer.launch({
                args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
                ignoreHTTPSErrors: true,
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
            
            // Timeout optimized for Vercel
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 9000 });
            const content = await page.content();
            const $ = cheerio.load(content);
            
            $('.product-card, [class*="ProductList"], [class*="Card"], [class*="grid"] > div').each((i, el) => {
                if(i > 15) return;
                const name = $(el).find('h1, h2, h3, h4, p, [class*="title"]').first().text().trim();
                const price = $(el).find('[class*="price"], span:contains("₹"), span:contains("$")').first().text().trim();
                const image = $(el).find('img').attr('src');
                if(name && price) products.push({ name, price, image: image || 'https://via.placeholder.com/150' });
            });
        } else {
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
            const $ = cheerio.load(data);
            $('.item, .product, .card, li').each((i, el) => {
                const name = $(el).find('h2, .name, .title').first().text().trim();
                const price = $(el).find('.price, .amount, span:contains("₹")').first().text().trim();
                const image = $(el).find('img').attr('src');
                if(name) products.push({ name, price: price || "N/A", image });
            });
        }
        res.json({ success: true, products });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    } finally {
        if(browser) await browser.close();
    }
});

module.exports = app;

