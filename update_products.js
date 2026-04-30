const fs = require('fs');
const path = require('path');

// Твоя ссылка на CSV (формат csv)
const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_FILE = path.join(__dirname, 'products.json');

/**
 * Парсит CSV с разделителем ';', поддерживает кавычки и многострочные поля.
 */
function parseCSV(csvText) {
    const delimiter = ';';
    const quote = '"';
    
    // Разбиваем на строки, но склеиваем строки, разорванные внутри кавычек
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
        // Считаем количество кавычек в текущем буфере (не экранированных)
        let quoteCount = 0;
        for (let i = 0; i < currentRecord.length; i++) {
            if (currentRecord[i] === quote && (i === 0 || currentRecord[i-1] !== '\\')) {
                quoteCount++;
            }
        }
        if (quoteCount % 2 === 0) {
            // Кавычки сбалансированы – запись завершена
            records.push(currentRecord);
            insideQuote = false;
        } else {
            insideQuote = true;
        }
    }
    
    // Парсим каждую запись как CSV-строку
    const parsedRows = [];
    for (const record of records) {
        const row = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < record.length; i++) {
            const ch = record[i];
            if (ch === quote) {
                if (inQuotes && record[i+1] === quote) {
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

async function main() {
    console.log('Загружаю CSV...');
    try {
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csvText = await res.text();
        
        const productsRaw = parseCSV(csvText);
        console.log(`Распарсено строк: ${productsRaw.length}`);
        
        // Оставляем только нужные поля для виджета
        const simplified = productsRaw
            .filter(p => p.name && p.price)
            .map(p => ({
                name: p.name,
                price: p.price,
                url: p.url,
                picture: p.picture
            }));
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(simplified, null, 2), 'utf8');
        console.log(`✅ Сохранено товаров: ${simplified.length}`);
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
        process.exit(1);
    }
}

main();
