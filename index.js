const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json());
app.use(cors());

// --- FRONTEND DASHBOARD ---
const dashboard = `
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stealth Scraper Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0f172a; color: #f8fafc; }
        .card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid #334155; }
        .btn-gradient { background: linear-gradient(90deg, #3b82f6, #2dd4bf); color: #0f172a; transition: 0.3s; }
        .btn-gradient:hover { transform: scale(1.02); box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); }
        .loader { border: 3px solid #1e293b; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="p-4 md:p-10 min-h-screen">
    <div class="max-w-4xl mx-auto">
        <header class="text-center mb-10">
            <h1 class="text-4xl font-extrabold tracking-tight">🕵️‍♂️ Stealth <span class="text-teal-400">Scraper</span></h1>
            <p class="text-slate-400 mt-2">Bypass 403 & Extract Data with High-Quality Analytics</p>
        </header>

        <div class="card p-6 rounded-3xl shadow-2xl mb-8">
            <div class="flex flex-col md:flex-row gap-4">
                <input type="text" id="targetUrl" placeholder="Enter Meesho/Amazon URL..." 
                       class="flex-1 bg-slate-900 border-none p-4 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500">
                <button onclick="startScrape()" id="mainBtn" class="btn-gradient font-bold py-4 px-10 rounded-2xl flex items-center justify-center gap-2">
                    Extract Data
                </button>
            </div>
            <div class="mt-4 flex gap-4 text-xs font-medium text-slate-500">
                <span>⚡ Fast Mode (Static)</span>
                <span>🛡️ Deep Scan (Stealth)</span>
            </div>
        </div>

        <div id="loaderBox" class="hidden flex flex-col items-center py-12">
            <div class="loader mb-4"></div>
            <p class="text-teal-400 animate-pulse font-semibold">Breaking through security filters...</p>
        </div>

        <div id="results" class="hidden">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">Total Products: <span id="count" class="text-teal-400">0</span></h2>
                <button onclick="downloadCSV()" class="bg-slate-800 hover:bg-slate-700 py-2 px-5 rounded-full text-xs border border-slate-600 transition-all">Export CSV</button>
            </div>
            <div id="productGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"></div>
        </div>
    </div>

    <script>
        let currentData = [];

        async function startScrape() {
            const url = document.getElementById('targetUrl').value;
            if(!url) return alert("Bhai, URL toh daalo!");

            const btn = document.getElementById('mainBtn');
            const loader = document.getElementById('loaderBox');
            const results = document.getElementById('results');

            btn.disabled = true;
            loader.classList.remove('hidden');
            results.classList.add('hidden');

            try {
                const response = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ url, mode: 'deep' })
                });
                const data = await response.json();
                
                if(data.success) {
                    currentData = data.products;
                    display(data.products);
                } else { alert("Error: " + data.message); }
            } catch (err) { alert("Server Error!"); }
            finally {
                btn.disabled = false;
                loader.classList.add('hidden');
            }
        }

        function display(products) {
            const grid = document.getElementById('productGrid');
            const count = document.getElementById('count');
            grid.innerHTML = '';
            count.innerText = products.length;

            products.forEach(p => {
                grid.innerHTML += \`
                    <div class="card p-4 rounded-2xl hover:border-teal-500/50 transition-all">
                        <img src="\${p.image}" class="w-full h-40 object-contain rounded-xl mb-4 bg-white p-2">
                        <h3 class="text-sm font-semibold line-clamp-2 h-10 mb-2">\${p.name}</h3>
                        <div class="flex justify-between items-center">
                            <span class="text-lg font-bold text-teal-400">\${p.price}</span>
                            <span class="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-400">In Stock</span>
                        </div>
                    </div>
                \`;
            });
            document.getElementById('results').classList.remove('hidden');
        }

        function downloadCSV() {
            let csv = 'Product Name,Price,Image\\n';
            currentData.forEach(p => csv += \`"\${p.name}","\${p.price}","\${p.image}"\\n\`);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'meesho_data.csv';
            a.click();
        }
    </script>
</body>
</html>
`;

// --- BACKEND LOGIC ---
app.get('/', (req, res) => res.send(dashboard));

app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    let browser = null;
    let products = [];

    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                "--disable-blink-features=AutomationControlled", // Website automation detect nahi kar payegi
                "--no-sandbox",
                "--disable-web-security"
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        
        // Anti-403 Stealth Headers
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
        });

        // Script to hide automation traces
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 9500 });

        // Scroll logic specifically for Meesho
        await page.evaluate(() => { window.scrollBy(0, 800); });
        await new Promise(r => setTimeout(r, 1000));

        const content = await page.content();
        const $ = cheerio.load(content);

        // Smart Universal Selector for E-commerce
        $('div[class*="ProductList__GridRow"] > div, .product-card, [class*="Card"], [class*="grid"] > div').each((i, el) => {
            if(i > 18) return;
            const name = $(el).find('p[class*="ProductTitle"], h2, h3, .title, span[class*="Name"]').first().text().trim();
            const price = $(el).find('h5[class*="Heading"], span:contains("₹"), .price').first().text().trim();
            const image = $(el).find('img').attr('src');
            
            if(name && price) {
                products.push({ name, price, image: image || 'https://via.placeholder.com/150' });
            }
        });

        res.json({ success: true, products });
    } catch (e) {
        res.status(500).json({ success: false, message: "Security blocked the request. Try again." });
    } finally {
        if(browser) await browser.close();
    }
});

module.exports = app;

