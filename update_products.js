const fs = require('fs');
const path = require('path');

// Твоя ссылка на CSV (формат csv)
const CSV_URL = 'http://export.admitad.com/by/webmaster/websites/2929853/products/export_adv_products/?user=pavel_kar8fbbb&code=f0vy5ps4uo&feed_id=26554&format=csv';

const OUTPUT_JSON = path.join(__dirname, 'products.json');
const OUTPUT_VK_FEED = path.join(__dirname, 'vk_feed.yml');

// Настройки VK-фида
const VK_FEED_SETTINGS = {
    shopName: 'Автозапчасти и масла',
    company: 'SOCHIAUTOPARTS',
    shopUrl: 'https://creastudioai-beep.github.io/widget/',
    currency: 'RUB',
    categories: {
        1: 'Автотовары',
        2: 'Моторные масла',
        3: 'Трансмиссионные масла',
        4: 'Автокосметика',
        5: 'Специальные масла'
    }
};

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
            if (currentRecord[i] === quote && (i === 0 || currentRecord[i - 1] !== '\\')) {
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

/**
 * Определяет категорию товара по его названию и описанию
 */
function detectCategory(product) {
    const name = (product.name || '').toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const text = name + ' ' + desc;

    if (text.includes('трансмиссионн') || text.includes('atf') || text.includes('cvtf')) {
        return 3; // Трансмиссионные масла
    }
    if (text.includes('автокосметик') || text.includes('полирол') || text.includes('очистител') || text.includes('смазк')) {
        return 4; // Автокосметика
    }
    if (text.includes('цеп') || text.includes('пил') || text.includes('chain') || text.includes('специальн')) {
        return 5; // Специальные масла
    }
    if (text.includes('моторн') || text.includes('genesi') || text.includes('luxe') || text.includes('avantgarde')) {
        return 2; // Моторные масла
    }

    return 1; // Автотовары (по умолчанию)
}

/**
 * Экранирует специальные XML-символы
 */
function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Генерирует VK-фид (YML) из списка товаров
 */
function generateVkFeed(products) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace('T', ' ');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!DOCTYPE yml_catalog SYSTEM "shops.dtd">\n';
    xml += `<yml_catalog date="${dateStr}">\n`;
    xml += '    <shop>\n';
    xml += `        <name>${escapeXml(VK_FEED_SETTINGS.shopName)}</name>\n`;
    xml += `        <company>${escapeXml(VK_FEED_SETTINGS.company)}</company>\n`;
    xml += `        <url>${escapeXml(VK_FEED_SETTINGS.shopUrl)}</url>\n`;
    xml += '        <currencies>\n';
    xml += `            <currency id="${VK_FEED_SETTINGS.currency}" rate="1"/>\n`;
    xml += '        </currencies>\n';
    xml += '        <categories>\n';

    for (const [id, name] of Object.entries(VK_FEED_SETTINGS.categories)) {
        xml += `            <category id="${id}">${escapeXml(name)}</category>\n`;
    }

    xml += '        </categories>\n';
    xml += '        <offers>\n';

    products.forEach((product, index) => {
        const id = index + 1;
        const categoryId = detectCategory(product);
        const price = parseFloat(product.price) || 0;
        const picture = product.picture || '';
        const url = product.url || '';
        const name = product.name || 'Без названия';
        const description = product.description || name;

        // Пропускаем товары без цены или URL
        if (price <= 0 || !url) return;

        xml += `            <offer id="${id}" available="true">\n`;
        xml += `                <url>${escapeXml(url)}</url>\n`;
        xml += `                <price>${price.toFixed(2)}</price>\n`;
        xml += `                <currencyId>${VK_FEED_SETTINGS.currency}</currencyId>\n`;
        xml += `                <categoryId>${categoryId}</categoryId>\n`;
        xml += `                <name>${escapeXml(name)}</name>\n`;
        xml += `                <description>${escapeXml(description)}</description>\n`;

        if (picture) {
            xml += `                <picture>${escapeXml(picture)}</picture>\n`;
        }

        xml += '            </offer>\n';
    });

    xml += '        </offers>\n';
    xml += '    </shop>\n';
    xml += '</yml_catalog>\n';

    return xml;
}

async function main() {
    console.log('Загружаю CSV...');
    try {
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csvText = await res.text();

        const productsRaw = parseCSV(csvText);
        console.log(`Распарсено строк: ${productsRaw.length}`);

        // Оставляем только нужные поля для виджета (с дополнительными полями для YML)
        const simplified = productsRaw
            .filter(p => p.name && p.price)
            .map(p => ({
                name: p.name,
                price: p.price,
                url: p.url,
                picture: p.picture,
                description: p.description || p.name || '',
                categoryId: detectCategory(p)
            }));

        // 1. Сохраняем products.json
        const jsonProducts = simplified.map(({ name, price, url, picture }) => ({
            name, price, url, picture
        }));

        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonProducts, null, 2), 'utf8');
        console.log(`Сохранено товаров в products.json: ${jsonProducts.length}`);

        // 2. Генерируем и сохраняем vk_feed.yml
        const vkFeedXml = generateVkFeed(simplified);
        fs.writeFileSync(OUTPUT_VK_FEED, vkFeedXml, 'utf8');
        console.log(`Сохранено товаров в vk_feed.yml: ${simplified.length}`);

        console.log('Готово!');
    } catch (err) {
        console.error('Ошибка:', err.message);
        process.exit(1);
    }
}

main();
