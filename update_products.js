const fs = require('fs');
const path = require('path');

// Твоя ссылка на CSV (та же самая, под которой товары были)
const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_FILE = path.join(__dirname, 'products.json');

// Парсинг строки CSV с разделителем ";" и поддержкой кавычек
function parseCSVLine(line) {
    if (!line) return [];
    const delimiter = ';'; // твой фид использует точку с запятой
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
    // Убираем кавычки по краям и лишние пробелы
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
        console.log('Заголовки:', headers);

        const products = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = parseCSVLine(line);
            if (values.length !== headers.length) {
                console.warn(`Строка ${i+1}: несовпадение колонок (${values.length} вместо ${headers.length})`);
                continue;
            }
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = values[idx]; });
            products.push(obj);
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2), 'utf8');
        console.log(`✅ Готово! Сохранено товаров: ${products.length}`);
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        process.exit(1);
    }
}

main();
