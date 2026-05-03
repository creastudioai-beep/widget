const fs = require('fs');
const path = require('path');

// =============================================================================
// КОНФИГУРАЦИЯ
// =============================================================================

const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_JSON  = path.join(__dirname, 'products.json');
const OUTPUT_YML   = path.join(__dirname, 'vk_feed.yml');
const OUTPUT_HTML  = path.join(__dirname, 'admitad-widget.html');

const SHOP_SETTINGS = {
    name: 'Автозапчасти и масла',
    company: 'SOCHIAUTOPARTS',
    url: 'https://creastudioai-beep.github.io/widget/',
    currency: 'RUB',
    categories: {
        1: 'Автотовары',
        2: 'Моторные масла',
        3: 'Трансмиссионные масла',
        4: 'Автокосметика',
        5: 'Специальные масла'
    }
};

// =============================================================================
// CSV ПАРСЕР
// =============================================================================

function parseCSV(csvText) {
    const delimiter = ';';
    const quote = '"';
    const lines = csvText.split(/\r?\n/);
    const records = [];
    let currentRecord = '';
    let insideQuote = false;

    for (const line of lines) {
        if (insideQuote) {
            currentRecord += '\n' + line;
        } else {
            currentRecord = line;
        }
        let quoteCount = 0;
        for (let i = 0; i < currentRecord.length; i++) {
            if (currentRecord[i] === quote && (i === 0 || currentRecord[i - 1] !== '\\')) {
                quoteCount++;
            }
        }
        if (quoteCount % 2 === 0) {
            records.push(currentRecord);
            insideQuote = false;
        } else {
            insideQuote = true;
        }
    }

    const parsedRows = [];
    for (const record of records) {
        const row = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < record.length; i++) {
            const ch = record[i];
            if (ch === quote) {
                if (inQuotes && record[i + 1] === quote) {
                    field += quote;
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === delimiter && !inQuotes) {
                row.push(field);
                field = '';
            } else {
                field += ch;
            }
        }
        row.push(field);
        parsedRows.push(row);
    }

    if (parsedRows.length === 0) return [];
    const headers = parsedRows[0];
    const data = [];
    for (let i = 1; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        if (row.length < headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = row[idx] || '';
        });
        data.push(obj);
    }
    return data;
}

// =============================================================================
// УТИЛИТЫ
// =============================================================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function detectCategory(product) {
    const name = (product.name || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const text = name + ' ' + desc;

    if (text.includes('трансмиссионн') || text.includes('atf') || text.includes('cvtf')) return 3;
    if (text.includes('автокосметик') || text.includes('полирол') || text.includes('очистител') || text.includes('смазк')) return 4;
    if (text.includes('цеп') || text.includes('пил') || text.includes('chain') || text.includes('специальн')) return 5;
    if (text.includes('моторн') || text.includes('genesi') || text.includes('luxe') || text.includes('avantgarde')) return 2;

    return 1;
}

function formatPrice(price) {
    const num = parseFloat(price);
    if (isNaN(num) || num <= 0) return '0';
    return num.toLocaleString('ru-RU');
}

function extractVolume(name) {
    if (!name) return '';
    const match = name.match(/(\d+)\s*[\+]\s*\d*\s*л/i);
    if (match) return match[0].replace(/\s+/g, '');
    const match2 = name.match(/(\d+)\s*л/i);
    return match2 ? match2[0].replace(/\s+/g, '') : '';
}

// =============================================================================
// ГЕНЕРАТОР products.json
// =============================================================================

function generateJson(products) {
    const jsonProducts = products.map(({ name, price, url, picture }) => ({
        name, price, url, picture
    }));
    return JSON.stringify(jsonProducts, null, 2);
}

// =============================================================================
// ГЕНЕРАТОР vk_feed.yml
// =============================================================================

function generateVkFeed(products) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace('T', ' ');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!DOCTYPE yml_catalog SYSTEM "shops.dtd">\n';
    xml += `<yml_catalog date="${dateStr}">\n`;
    xml += '    <shop>\n';
    xml += `        <name>${escapeXml(SHOP_SETTINGS.name)}</name>\n`;
    xml += `        <company>${escapeXml(SHOP_SETTINGS.company)}</company>\n`;
    xml += `        <url>${escapeXml(SHOP_SETTINGS.url)}</url>\n`;
    xml += '        <currencies>\n';
    xml += `            <currency id="${SHOP_SETTINGS.currency}" rate="1"/>\n`;
    xml += '        </currencies>\n';
    xml += '        <categories>\n';

    for (const [id, name] of Object.entries(SHOP_SETTINGS.categories)) {
        xml += `            <category id="${id}">${escapeXml(name)}</category>\n`;
    }

    xml += '        </categories>\n';
    xml += '        <offers>\n';

    let offerId = 0;
    for (const product of products) {
        const price = parseFloat(product.price) || 0;
        const url = product.url || '';
        if (price <= 0 || !url) continue;
        offerId++;

        const name = product.name || 'Без названия';
        const description = product.description || name;
        const picture = product.picture || '';
        const categoryId = detectCategory(product);

        xml += `            <offer id="${offerId}" available="true">\n`;
        xml += `                <url>${escapeXml(url)}</url>\n`;
        xml += `                <price>${price.toFixed(2)}</price>\n`;
        xml += `                <currencyId>${SHOP_SETTINGS.currency}</currencyId>\n`;
        xml += `                <categoryId>${categoryId}</categoryId>\n`;
        xml += `                <name>${escapeXml(name)}</name>\n`;
        xml += `                <description>${escapeXml(description)}</description>\n`;
        if (picture) {
            xml += `                <picture>${escapeXml(picture)}</picture>\n`;
        }
        xml += '            </offer>\n';
    }

    xml += '        </offers>\n';
    xml += '    </shop>\n';
    xml += '</yml_catalog>\n';

    return { xml, offerCount: offerId };
}

// =============================================================================
// ГЕНЕРАТОР admitad-widget.html
// =============================================================================

function generateHtml(products) {
    // Подготавливаем данные для встраивания в HTML
    const embeddedProducts = products.map(p => ({
        n: p.name,
        p: p.price,
        u: p.url,
        i: p.picture
    }));

    const productsJson = JSON.stringify(embeddedProducts);
    const updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Магазин масел и автотоваров — LUKOIL</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f2f5;color:#1a1a2e;line-height:1.6}

        /* === HEADER === */
        .header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;padding:0;position:sticky;top:0;z-index:100;box-shadow:0 2px 20px rgba(0,0,0,0.3)}
        .header-inner{max-width:1280px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;flex-wrap:wrap;gap:16px}
        .logo{font-size:1.5rem;font-weight:800;letter-spacing:-0.5px;white-space:nowrap}
        .logo span{color:#e94560}
        .search-wrapper{flex:1;min-width:250px;max-width:600px;position:relative}
        .search-input{width:100%;padding:12px 44px 12px 16px;border:2px solid rgba(255,255,255,0.15);border-radius:50px;background:rgba(255,255,255,0.1);color:#fff;font-size:1rem;outline:none;transition:all .3s}
        .search-input::placeholder{color:rgba(255,255,255,0.5)}
        .search-input:focus{border-color:#e94560;background:rgba(255,255,255,0.15)}
        .search-btn{position:absolute;right:4px;top:50%;transform:translateY(-50%);background:#e94560;border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;transition:background .2s}
        .search-btn:hover{background:#c0392b}
        .search-clear{position:absolute;right:46px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:1.2rem;display:none;padding:4px}
        .search-clear.visible{display:block}
        .search-clear:hover{color:#fff}

        /* === INFO BAR === */
        .info-bar{background:linear-gradient(90deg,#0f3460,#1a1a2e);padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.08)}
        .info-bar-inner{max-width:1280px;margin:0 auto;padding:0 20px;display:flex;flex-wrap:wrap;gap:20px;justify-content:center}
        .info-item{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,0.85);font-size:0.85rem;white-space:nowrap}
        .info-icon{width:28px;height:28px;border-radius:50%;background:rgba(233,69,96,0.2);display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0}

        /* === FILTERS === */
        .filters-section{max-width:1280px;margin:20px auto 0;padding:0 20px}
        .filters-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
        .filter-label{font-size:0.85rem;color:#666;font-weight:600;margin-right:4px}
        .filter-btn{padding:7px 16px;border:2px solid #e0e0e0;border-radius:25px;background:#fff;color:#444;font-size:0.85rem;cursor:pointer;transition:all .2s;font-weight:500}
        .filter-btn:hover{border-color:#0f3460;color:#0f3460}
        .filter-btn.active{background:#0f3460;border-color:#0f3460;color:#fff}
        .sort-select{padding:7px 12px;border:2px solid #e0e0e0;border-radius:25px;background:#fff;font-size:0.85rem;color:#444;cursor:pointer;outline:none}
        .sort-select:focus{border-color:#0f3460}

        /* === RESULTS INFO === */
        .results-info{max-width:1280px;margin:14px auto 0;padding:0 20px;font-size:0.85rem;color:#888}
        .results-info strong{color:#0f3460}

        /* === PRODUCTS GRID === */
        .main-content{max-width:1280px;margin:16px auto 0;padding:0 20px 40px}
        .products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:20px}
        .product-card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);transition:transform .25s,box-shadow .25s;display:flex;flex-direction:column;position:relative}
        .product-card:hover{transform:translateY(-4px);box-shadow:0 8px 30px rgba(0,0,0,0.12)}
        .product-badge{position:absolute;top:12px;left:12px;background:#e94560;color:#fff;font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:20px;z-index:2;text-transform:uppercase;letter-spacing:0.3px}
        .product-image-wrap{width:100%;height:200px;background:#fafafa;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .product-image{max-width:100%;max-height:100%;object-fit:contain;transition:transform .3s}
        .product-card:hover .product-image{transform:scale(1.05)}
        .product-no-image{color:#bbb;font-size:0.9rem}
        .product-info{padding:16px;flex:1;display:flex;flex-direction:column}
        .product-category{font-size:0.7rem;color:#0f3460;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
        .product-title{font-size:0.95rem;font-weight:700;margin:0 0 10px;line-height:1.35;height:2.7em;overflow:hidden;color:#1a1a2e;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        .product-price{color:#e94560;font-size:1.35rem;font-weight:800;margin:0 0 4px}
        .product-price .currency{font-size:0.85rem;font-weight:600}
        .product-link{background:linear-gradient(135deg,#e94560,#c0392b);color:#fff;text-align:center;padding:12px;border-radius:10px;text-decoration:none;margin-top:auto;font-weight:700;font-size:0.9rem;transition:all .2s;display:block}
        .product-link:hover{background:linear-gradient(135deg,#c0392b,#a93226);transform:translateY(-1px);box-shadow:0 4px 15px rgba(233,69,96,0.35)}

        /* === EMPTY STATE === */
        .empty-state{text-align:center;padding:60px 20px;background:#fff;border-radius:14px;grid-column:1/-1}
        .empty-state .icon{font-size:3rem;margin-bottom:16px}
        .empty-state .title{font-size:1.2rem;font-weight:700;color:#1a1a2e;margin-bottom:8px}
        .empty-state .desc{font-size:0.9rem;color:#888}

        /* === FEATURES BLOCK === */
        .features-section{background:#fff;border-top:1px solid #e0e0e0}
        .features-inner{max-width:1280px;margin:0 auto;padding:50px 20px}
        .features-title{text-align:center;font-size:1.5rem;font-weight:800;color:#1a1a2e;margin-bottom:10px}
        .features-subtitle{text-align:center;font-size:0.9rem;color:#888;margin-bottom:40px}
        .features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px}
        .feature-card{background:#f8f9fb;border-radius:14px;padding:30px 24px;text-align:center;transition:all .3s;border:2px solid transparent}
        .feature-card:hover{border-color:#0f3460;transform:translateY(-2px)}
        .feature-icon{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0f3460,#1a1a2e);color:#fff;font-size:1.4rem;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
        .feature-name{font-size:1rem;font-weight:700;color:#1a1a2e;margin-bottom:8px}
        .feature-desc{font-size:0.85rem;color:#666;line-height:1.5}

        /* === FOOTER === */
        .footer{background:#1a1a2e;color:rgba(255,255,255,0.5);text-align:center;padding:24px 20px;font-size:0.8rem}

        /* === LOADING / ERROR === */
        .loading{text-align:center;padding:40px;background:#fff;border-radius:14px;grid-column:1/-1}
        .spinner{width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#0f3460;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* === HIGHLIGHT === */
        mark{background:#fce38a;padding:0 2px;border-radius:2px}

        /* === RESPONSIVE === */
        @media(max-width:768px){
            .header-inner{padding:12px 16px;gap:12px}
            .logo{font-size:1.2rem;width:100%;text-align:center}
            .search-wrapper{min-width:100%}
            .info-bar-inner{gap:12px;padding:0 16px}
            .info-item{font-size:0.75rem}
            .products-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
            .product-image-wrap{height:150px}
            .product-info{padding:12px}
            .product-title{font-size:0.85rem;height:auto}
            .product-price{font-size:1.1rem}
            .product-link{padding:10px;font-size:0.8rem}
            .features-grid{grid-template-columns:1fr 1fr}
        }
        @media(max-width:480px){
            .products-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
            .features-grid{grid-template-columns:1fr}
        }
    </style>
</head>
<body>

<!-- HEADER -->
<header class="header">
    <div class="header-inner">
        <div class="logo">LUKOIL <span>CLUB</span></div>
        <div class="search-wrapper">
            <input type="text" class="search-input" id="searchInput" placeholder="Поиск по маслам и товарам..." autocomplete="off">
            <button class="search-clear" id="searchClear" title="Очистить">&times;</button>
            <button class="search-btn" id="searchBtn" title="Найти">&#128269;</button>
        </div>
    </div>
</header>

<!-- INFO BAR -->
<div class="info-bar">
    <div class="info-bar-inner">
        <div class="info-item">
            <div class="info-icon">&#128222;</div>
            <span>Операторы оперативно ответят</span>
        </div>
        <div class="info-item">
            <div class="info-icon">&#9989;</div>
            <span>100% оригинальные товары</span>
        </div>
        <div class="info-item">
            <div class="info-icon">&#128666;</div>
            <span>Доставка по всей России</span>
        </div>
        <div class="info-item">
            <div class="info-icon">&#127873;</div>
            <span>Бесплатная доставка от 5 литров</span>
        </div>
        <div class="info-item">
            <div class="info-icon">&#128336;</div>
            <span>Прием онлайн заказов 24/7</span>
        </div>
    </div>
</div>

<!-- FILTERS -->
<div class="filters-section">
    <div class="filters-row">
        <span class="filter-label">Категория:</span>
        <button class="filter-btn active" data-category="all">Все товары</button>
        <button class="filter-btn" data-category="motor">Моторные масла</button>
        <button class="filter-btn" data-category="transmission">Трансмиссионные масла</button>
        <button class="filter-btn" data-category="cosmetics">Автокосметика</button>
        <button class="filter-btn" data-category="special">Специальные масла</button>
        <span class="filter-label" style="margin-left:auto">Сортировка:</span>
        <select class="sort-select" id="sortSelect">
            <option value="default">По умолчанию</option>
            <option value="price-asc">Цена: по возрастанию</option>
            <option value="price-desc">Цена: по убыванию</option>
            <option value="name-asc">Название: А-Я</option>
            <option value="name-desc">Название: Я-А</option>
        </select>
    </div>
</div>

<!-- RESULTS INFO -->
<div class="results-info" id="resultsInfo"></div>

<!-- PRODUCTS -->
<div class="main-content">
    <div class="products-grid" id="productsGrid">
        <div class="loading">
            <div class="spinner"></div>
            Загрузка товаров...
        </div>
    </div>
</div>

<!-- FEATURES SECTION -->
<section class="features-section">
    <div class="features-inner">
        <h2 class="features-title">Почему выбирают нас?</h2>
        <p class="features-subtitle">Работаем для вас с гарантией качества и сервиса</p>
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon">&#128222;</div>
                <div class="feature-name">Линия поддержки</div>
                <div class="feature-desc">Операторы линии поддержки оперативно ответят на любые вопросы о товарах, доставке и оформлении заказа</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">&#9989;</div>
                <div class="feature-name">Оригинальные товары</div>
                <div class="feature-desc">100% оригинальные товары от производителя LUKOIL. Работаем только с сертифицированной продукцией</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">&#128666;</div>
                <div class="feature-name">Доставка по России</div>
                <div class="feature-desc">Доставка по всей России надежными транспортными компаниями. Отправка в день оплаты заказа</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">&#127873;</div>
                <div class="feature-name">Бесплатная доставка</div>
                <div class="feature-desc">Бесплатная доставка при заказе от 5 литров. Выгодные условия для оптовых и регулярных покупателей</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">&#128336;</div>
                <div class="feature-name">Заказы 24/7</div>
                <div class="feature-desc">Прием онлайн заказов круглосуточно, 7 дней в неделю. Оформляйте заказ в удобное для вас время</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">&#128179;</div>
                <div class="feature-name">Безопасная оплата</div>
                <div class="feature-desc">Удобные способы оплаты: банковские карты, электронные кошельки. Полная безопасность транзакций</div>
            </div>
        </div>
    </div>
</section>

<!-- FOOTER -->
<footer class="footer">
    SOCHIAUTOPARTS &mdash; Магазин масел и автотоваров LUKOIL. Обновлено: ${updatedAt}.
</footer>

<script>
(function() {
    'use strict';

    // Данные товаров встроены скриптом update_products.js
    var PRODUCTS = ${productsJson};

    var searchInput  = document.getElementById('searchInput');
    var searchClear  = document.getElementById('searchClear');
    var searchBtn    = document.getElementById('searchBtn');
    var productsGrid = document.getElementById('productsGrid');
    var resultsInfo  = document.getElementById('resultsInfo');
    var sortSelect   = document.getElementById('sortSelect');
    var filterBtns   = document.querySelectorAll('.filter-btn');

    var currentCategory = 'all';
    var currentSearch   = '';
    var currentSort     = 'default';
    var debounceTimer   = null;

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function highlightText(text, query) {
        if (!query) return escapeHtml(text);
        var escaped = query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
        var regex = new RegExp('(' + escaped + ')', 'gi');
        return escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }

    function getCategory(p) {
        var n = (p.n || '').toLowerCase();
        if (n.includes('трансмиссионн') || n.includes('atf') || n.includes('cvtf')) return {key:'transmission',label:'Трансмиссионные масла'};
        if (n.includes('полирол') || n.includes('очистител') || n.includes('смазк')) return {key:'cosmetics',label:'Автокосметика'};
        if (n.includes('цеп') || n.includes('пил') || n.includes('chain')) return {key:'special',label:'Специальные масла'};
        return {key:'motor',label:'Моторные масла'};
    }

    function getVolume(p) {
        var n = p.n || '';
        var m = n.match(/(\\d+)\\s*[\\+]\\s*\\d*\\s*л/i);
        if (m) return m[0].replace(/\\s+/g,'');
        var m2 = n.match(/(\\d+)\\s*л/i);
        return m2 ? m2[0].replace(/\\s+/g,'') : '';
    }

    function filterProducts() {
        var filtered = PRODUCTS.slice();

        if (currentCategory !== 'all') {
            filtered = filtered.filter(function(p) { return getCategory(p).key === currentCategory; });
        }
        if (currentSearch.trim()) {
            var q = currentSearch.trim().toLowerCase();
            filtered = filtered.filter(function(p) { return (p.n || '').toLowerCase().includes(q); });
        }

        switch (currentSort) {
            case 'price-asc':  filtered.sort(function(a,b){return parseFloat(a.p)-parseFloat(b.p)}); break;
            case 'price-desc': filtered.sort(function(a,b){return parseFloat(b.p)-parseFloat(a.p)}); break;
            case 'name-asc':   filtered.sort(function(a,b){return (a.n||'').localeCompare(b.n||'','ru')}); break;
            case 'name-desc':  filtered.sort(function(a,b){return (b.n||'').localeCompare(a.n||'','ru')}); break;
        }
        return filtered;
    }

    function renderProducts(products) {
        if (!products.length) {
            var q = currentSearch.trim();
            productsGrid.innerHTML = '<div class="empty-state"><div class="icon">&#128269;</div><div class="title">' +
                (q ? 'Ничего не найдено' : 'Нет товаров') + '</div><div class="desc">' +
                (q ? 'Попробуйте изменить запрос или выбрать другую категорию' : 'Список товаров пуст') + '</div></div>';
            resultsInfo.innerHTML = '';
            return;
        }

        resultsInfo.innerHTML = 'Найдено товаров: <strong>' + products.length + '</strong> из <strong>' + PRODUCTS.length + '</strong>';

        var html = '';
        var query = currentSearch.trim();
        for (var i = 0; i < products.length; i++) {
            var p = products[i];
            var title = p.n || 'Без названия';
            var price = p.p ? parseFloat(p.p).toLocaleString('ru-RU') : '0';
            var link = p.u || '';
            var image = p.i || '';
            var cat = getCategory(p);
            var vol = getVolume(p);

            html += '<div class="product-card">';
            if (vol) html += '<div class="product-badge">' + escapeHtml(vol) + '</div>';
            html += '<div class="product-image-wrap">';
            if (image) {
                html += '<img class="product-image" src="' + escapeHtml(image) + '" alt="' + escapeHtml(title) + '" loading="lazy" onerror="this.parentElement.innerHTML=\\'<div class=product-no-image>Нет фото</div>\\'">';
            } else {
                html += '<div class="product-no-image">Нет фото</div>';
            }
            html += '</div>';
            html += '<div class="product-info">';
            html += '<div class="product-category">' + escapeHtml(cat.label) + '</div>';
            html += '<div class="product-title">' + highlightText(title, query) + '</div>';
            html += '<div class="product-price">' + price + ' <span class="currency">&#8381;</span></div>';
            if (link) html += '<a href="' + escapeHtml(link) + '" class="product-link" target="_blank" rel="nofollow sponsored">Купить</a>';
            html += '</div></div>';
        }
        productsGrid.innerHTML = html;
    }

    function updateView() {
        renderProducts(filterProducts());
        searchClear.classList.toggle('visible', currentSearch.length > 0);
    }

    function onSearchInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            currentSearch = searchInput.value;
            updateView();
        }, 300);
    }

    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { clearTimeout(debounceTimer); currentSearch = searchInput.value; updateView(); }
    });
    searchBtn.addEventListener('click', function() { clearTimeout(debounceTimer); currentSearch = searchInput.value; updateView(); });
    searchClear.addEventListener('click', function() { searchInput.value = ''; currentSearch = ''; searchInput.focus(); updateView(); });

    filterBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            filterBtns.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentCategory = this.dataset.category;
            updateView();
        });
    });

    sortSelect.addEventListener('change', function() { currentSort = this.value; updateView(); });

    // Первая отрисовка
    updateView();
})();
</script>
</body>
</html>`;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    console.log('='.repeat(50));
    console.log('  LUKOIL Widget — генерация всех файлов');
    console.log('='.repeat(50));

    console.log('\n[1/4] Загрузка CSV с Admitad...');
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} от Admitad`);
    const csvText = await res.text();
    console.log('  Загружено: ' + (csvText.length / 1024).toFixed(0) + ' KB');

    console.log('\n[2/4] Парсинг CSV...');
    const productsRaw = parseCSV(csvText);
    console.log('  Распарсено строк: ' + productsRaw.length);

    const simplified = productsRaw
        .filter(p => p.name && p.price)
        .map(p => ({
            name: p.name,
            price: p.price,
            url: p.url,
            picture: p.picture,
            description: p.description || p.name || ''
        }));

    console.log('  Товаров с ценой и названием: ' + simplified.length);

    // --- products.json ---
    console.log('\n[3/4] Генерация products.json...');
    const jsonContent = generateJson(simplified);
    fs.writeFileSync(OUTPUT_JSON, jsonContent, 'utf8');
    console.log('  Сохранено: ' + OUTPUT_JSON + ' (' + simplified.length + ' товаров)');

    // --- vk_feed.yml ---
    console.log('\n[3/4] Генерация vk_feed.yml...');
    const { xml: ymlContent, offerCount } = generateVkFeed(simplified);
    fs.writeFileSync(OUTPUT_YML, ymlContent, 'utf8');
    console.log('  Сохранено: ' + OUTPUT_YML + ' (' + offerCount + ' offers)');

    // --- admitad-widget.html ---
    console.log('\n[3/4] Генерация admitad-widget.html...');
    const htmlContent = generateHtml(simplified);
    fs.writeFileSync(OUTPUT_HTML, htmlContent, 'utf8');
    console.log('  Сохранено: ' + OUTPUT_HTML + ' (' + (htmlContent.length / 1024).toFixed(0) + ' KB)');

    console.log('\n[4/4] Итого:');
    console.log('  products.json      — ' + simplified.length + ' товаров');
    console.log('  vk_feed.yml        — ' + offerCount + ' offers');
    console.log('  admitad-widget.html — ' + simplified.length + ' товаров, поиск, фильтры');
    console.log('\nГотово!');
}

main().catch(err => {
    console.error('\nОШИБКА:', err.message);
    process.exit(1);
});
