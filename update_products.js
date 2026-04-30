const fs = require('fs');
const path = require('path');

// Твоя ссылка на CSV
const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_JSON = path.join(__dirname, 'products.json');
const OUTPUT_YML = path.join(__dirname, 'vk_feed.yml');  // новый YML-файл

// ========== Парсинг CSV (как было, но с поддержкой экранирования) ==========
function parseCSVLine(line) {
    if (!line) return [];
    const delimiter = ';';
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result.map(field => field.trim().replace(/^"|"$/g, ''));
}

// ========== Генерация YML для ВКонтакте ==========
function generateVK_YML(products) {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    let yml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE yml_catalog SYSTEM "shops.dtd">
<yml_catalog date="${formattedDate}">
    <shop>
        <name>Автозапчасти и масла</name>
        <company>SOCHIAUTOPARTS</company>
        <url>https://creastudioai-beep.github.io/widget/</url>
        <currencies>
            <currency id="RUB" rate="1"/>
        </currencies>
        <categories>
            <category id="1">Автотовары</category>
        </categories>
        <offers>
`;

    for (const p of products) {
        const id = p.id || Math.floor(Math.random() * 1000000);
        const name = escapeXML(p.name || 'Товар');
        const price = p.price || '0';
        const url = p.url || '#';
        const picture = p.picture || '';
        const description = escapeXML((p.description || p.name || '').substring(0, 500));

        yml += `            <offer id="${id}" available="true">
                <name>${name}</name>
                <price>${price}</price>
                <currencyId>RUB</currencyId>
                <categoryId>1</categoryId>
                <picture>${escapeXML(picture)}</picture>
                <url>${escapeXML(url)}</url>
                <description>${description}</description>
            </offer>
`;
    }

    yml += `        </offers>
    </shop>
</yml_catalog>`;
    return yml;
}

function escapeXML(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/["']/g, function(m) {
        if (m === '"') return '&quot;';
        if (m === "'") return '&apos;';
        return m;
    });
}

// ========== Основная функция ==========
async function main() {
    console.log('Загружаю CSV...');
    try {
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        const lines = text.split(/\r?\n/);
        if (lines.length < 2) throw new Error('Пустой CSV');

        const headers = parseCSVLine(lines[0]);
        const products = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = parseCSVLine(line);
            if (values.length !== headers.length) continue;
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = values[idx]; });
            products.push(obj);
        }

        // Сохраняем JSON (упрощённый, как раньше)
        const simplified = products.map(p => ({
            name: p.name,
            price: p.price,
            url: p.url,
            picture: p.picture
        })).filter(p => p.name && p.price);
        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(simplified, null, 2), 'utf8');
        console.log(`✅ Сохранено JSON: ${simplified.length} товаров`);

        // Генерируем YML для ВКонтакте
        const ymlContent = generateVK_YML(products);
        fs.writeFileSync(OUTPUT_YML, ymlContent, 'utf8');
        console.log(`✅ Сохранён YML: vk_feed.yml (${products.length} товаров)`);

    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        process.exit(1);
    }
}

main();
