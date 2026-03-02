const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const app = express();

app.use(express.json());

// --- FRONTEND UI (HTML/CSS/JS) ---
const UI = `
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hybrid Data Extractor Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .glass-card { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .gradient-bg { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); }
        .loader { border-top-color: #3b82f6; animation: spinner 1.5s linear infinite; }
        @keyframes spinner { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body class="gradient-bg min-h-screen text-slate-100 p-4 md:p-10">
    <div class="max-w-6xl mx-auto">
        <header class="mb-10 text-center">
            <h1 class="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Hybrid Intelligence Scraper
            </h1>
            <p class="text-slate-400">Extract data from Static, Dynamic, & Secure E-commerce Platforms</p>
        </header>

        <div class="glass-card p-6 rounded-2xl shadow-2xl mb-8">
            <div class="flex flex-col md:flex-row gap-4">
                <input type="text" id="targetUrl" placeholder="Paste URL (Meesho, Amazon, or any site)..." 
                       class="flex-1 p-4 rounded-xl bg-slate-800 border-none text-white focus:ring-2 focus:ring-blue-500 outline-none">
                
                <select id="mode" class="bg-slate-800 p-4 rounded-xl border-none text-white outline-none">
                    <option value="fast">Fast Mode (Static Sites)</option>
                    <option value="deep">Deep Scan (Secure/Dynamic Sites)</option>
                </select>

                <button onclick="startExtraction()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-blue-500/50">
                    Extract Now
                </button>
            </div>
        </div>

        <div id="loader" class="hidden flex flex-col items-center my-10">
            <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
            <p class="text-blue-400 animate-pulse font-medium">Bypassing Security & Extracting Products...</p>
        </div>

        <div id="results" class="hidden">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Extracted Products (<span id="count">0</span>)</h2>
                <button onclick="downloadCSV()" class="bg-emerald-600 hover:bg-emerald-700 text-sm py-2 px-4 rounded-lg font-bold">Download CSV</button>
            </div>
            <div id="productGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
        </div>
    </div>

    <script>
        let currentProducts = [];

        async function startExtraction() {
            const url = document.getElementById('targetUrl').value;
            const mode = document.getElementById('mode').value;
            if(!url) return alert("Bhai, URL toh daalo!");

            document.getElementById('loader').classList.remove('hidden');
            document.getElementById('results').classList.add('hidden');

            try {
                const res = await fetch('/api/hybrid-scrape', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ url, mode })
                });
                const data = await res.json();
                
                if(data.success) {
                    currentProducts = data.products;
                    displayProducts(data.products);
                } else {
                    alert("Error: " + data.message);
                }
            } catch (err) {
                alert("Server se connection nahi ho paya!");
            } finally {
                document.getElementById('loader').classList.add('hidden');
            }
        }

        function displayProducts(products) {
            const grid = document.getElementById('productGrid');
            const count = document.getElementById('count');
            grid.innerHTML = '';
            count.innerText = products.length;

            products.forEach(p => {
                grid.innerHTML += \`
                    <div class="glass-card p-4 rounded-xl text-slate-800 hover:scale-[1.02] transition-transform">
                        <img src="\${p.image}" class="w-full h-48 object-contain rounded-lg mb-4 bg-gray-50">
                        <h3 class="font-bold text-sm line-clamp-2 h-10">\${p.name}</h3>
                        <div class="flex justify-between items-center mt-4">
                            <span class="text-xl font-black text-blue-600">\${p.price}</span>
                            <span class="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">VERIFIED</span>
                        </div>
                    </div>
                \`;
            });
            document.getElementById('results').classList.remove('hidden');
        }

        function downloadCSV() {
            let csv = 'Product Name,Price,Image URL\\n';
            currentProducts.forEach(p => {
                csv += \`"\${p.name.replace(/"/g, '""')}","\${p.price}","\${p.image}"\\n\`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', 'competitor_products.csv');
            a.click();
        }
    </script>
</body>
</html>
`;

// --- BACKEND LOGIC ---

app.post('/api/hybrid-scrape', async (req, res) => {
    const { url, mode } = req.body;
    let products = [];

    try {
        if (mode === 'deep') {
            // DEEP SCAN: Puppeteer for Secure/Dynamic Sites (Meesho, Amazon, etc.)
            const browser = await puppeteer.launch({ 
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Auto-scroll logic
            await page.evaluate(async () => {
                await new Promise(resolve => {
                    let totalHeight = 0;
                    let distance = 300;
                    let timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= 3000) { clearInterval(timer); resolve(); }
                    }, 100);
                });
            });

            const content = await page.content();
            const $ = cheerio.load(content);
            
            // Generic Smart Selector
            $('.product, .item, [class*="ProductList"], [class*="GridRow"], [class*="card"]').each((i, el) => {
                const name = $(el).find('h1, h2, h3, h4, p, [class*="title"], [class*="name"]').first().text().trim();
                const price = $(el).find('[class*="price"], [class*="Heading"], span:contains("₹"), span:contains("$")').first().text().trim();
                const image = $(el).find('img').attr('src');
                if (name && price && products.length < 30) products.push({ name, price, image: image || 'https://via.placeholder.com/150' });
            });

            await browser.close();
        } else {
            // FAST MODE: Axios + Cheerio for Static Sites
            const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(data);
            $('.product, .item, .card, tr').each((i, el) => {
                const name = $(el).find('h2, .title, .name').first().text().trim();
                const price = $(el).find('.price, .amount').first().text().trim();
                const image = $(el).find('img').attr('src');
                if (name && products.length < 50) products.push({ name, price, image });
            });
        }

        res.json({ success: true, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/', (req, res) => res.send(UI));

app.listen(3000, () => console.log('🔥 Hybrid Scraper Active at http://localhost:3000'));

