const fs = require('fs');
const path = require('path');

// Твоя ссылка на CSV (формат csv, а не xml)
const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_FILE = path.join(__dirname, 'products.json');

function parseCSVLine(line) {
    if (!line) return [];
    const delimiter = ';'; // твой разделитель
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

        // Берём только нужные поля для виджета
        const simplified = products.map(p => ({
            name: p.name,
            price: p.price,
            url: p.url,
            picture: p.picture
        })).filter(p => p.name && p.price);

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(simplified, null, 2), 'utf8');
        console.log(`✅ Сохранено товаров: ${simplified.length}`);
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        process.exit(1);
    }
}

main();
