import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const attr = (s, name) => (s.match(new RegExp(`${name}="([^"]*)"`)) ?? [])[1] ?? '';
const text = (s, cls) => (s.match(new RegExp(`<(h3|p)[^>]*class="${cls}"[^>]*>([\\s\\S]*?)</\\1>`)) ?? [])[2]?.replace(/<[^>]+>/g, '').trim() ?? '';
const plain = (s, tag) => (s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) ?? [])[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
const digits = (s) => Number(String(s).replace(/,/g, '').match(/\d+/)?.[0] ?? 0);
const slugify = (path) => path.replace(/^.*\//, '').replace(/\.html.*$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();

const products = [...readFileSync(join(root, 'products.html'), 'utf8').matchAll(/<div class="product-card"[\s\S]*?<\/div>\s*<\/div>/g)]
  .map((m, i) => m[0])
  .map((block, i) => {
    const gradeLine = text(block, 'grade');
    const priceText = text(block, 'price').replace(/\s+/g, '');
    const tags = [...block.matchAll(/<span class="tag">([^<]*)<\/span>/g)].map((t) => t[1].trim());
    const image = (block.match(/<img src="([^"]*)"/) ?? [])[1] ?? '';
    return {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      code: `P-${String(i + 1).padStart(3, '0')}`,
      name: plain(block, 'h3'),
      series: attr(block, 'data-series'),
      grade: gradeLine.split(' ')[0] ?? '',
      scale: gradeLine.split(' ')[1] ?? '',
      price_text: priceText,
      price_value: digits(priceText),
      release_date: '',
      image,
      page_path: (block.match(/href="([^"]*)" class="details-btn"/) ?? [])[1] ?? 'detail.html',
      gallery: [image],
      features: tags,
      detail: '',
    };
  });

const series = [...readFileSync(join(root, 'index.html'), 'utf8').matchAll(/<div class="model-card">[\s\S]*?<\/div>/g)]
  .map((m) => m[0])
  .map((block, i) => {
    const title = plain(block, 'h3');
    const href = (block.match(/href="([^"]*)" class="details-btn"/) ?? [])[1] ?? 'products.html';
    return {
      id: `00000000-0000-4000-8000-${String(1000 + i + 1).padStart(12, '0')}`,
      slug: slugify(href) || `series-${i + 1}`,
      era: title,
      title,
      subtitle: plain(block, 'p'),
      summary: '',
      image: (block.match(/<img src="([^"]*)"/) ?? [])[1] ?? '',
      page_path: href,
      sort_order: i + 1,
    };
  });

mkdirSync(join(root, 'content'), { recursive: true });
writeFileSync(join(root, 'content', 'seed.json'), JSON.stringify({ generated_from: 'products.html + index.html', product: products, series }, null, 2) + '\n');
console.log(`content/seed.json: ${products.length} products, ${series.length} series`);
