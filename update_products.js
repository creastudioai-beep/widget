const fs = require('fs');
const path = require('path');

// ↓↓↓ ЗАМЕНИТЕ НА ВАШУ ССЫЛКУ (пример, но вставьте свою) ↓↓↓
const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_FILE = path.join(__dirname, 'products.json');

function parseCSVLine(line) {
    if (!line) return [];
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result.map(field => field.trim());
}

async function main() {
    console.log('Downloading CSV...');
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const lines = text.split(/\r?\n/);
    if (lines.length < 2) throw new Error('Empty CSV');

    const headers = parseCSVLine(lines[0]);
    const products = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = values[idx]; });
        products.push(obj);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`✅ Saved ${products.length} products to products.json`);
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
