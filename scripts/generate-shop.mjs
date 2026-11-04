// 「好日子線上商城」模擬電商資料庫（SQL 課程用），固定亂數種子。
// 執行：node scripts/generate-shop.mjs → public/datasets/shop.sql
import { writeFileSync } from 'node:fs';

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(180);
const pick = (a) => a[Math.floor(rand() * a.length)];
const weighted = (pairs) => {
  let r = rand() * pairs.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};
const pad = (n) => String(n).padStart(2, '0');
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const SURN = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪'];
const GIVEN = ['怡君', '志明', '雅婷', '家豪', '淑芬', '俊傑', '佳穎', '冠宇', '宜蓁', '承翰', '詩涵', '柏翰', '欣怡', '彥廷', '心怡', '宗翰'];
const CITIES = [['台北市', 5], ['新北市', 5], ['桃園市', 3], ['台中市', 4], ['台南市', 2], ['高雄市', 3], ['新竹市', 1]];
const CHANNELS = [['自然搜尋', 4], ['Facebook 廣告', 3], ['Google 廣告', 3], ['朋友推薦', 2]];

const products = [
  ['無線藍牙耳機', '3C 配件', 1290, 780], ['行動電源 10000mAh', '3C 配件', 690, 390], ['手機防摔殼', '3C 配件', 390, 120], ['Type-C 快充線', '3C 配件', 290, 80],
  ['保溫隨行杯', '居家生活', 590, 260], ['香氛蠟燭', '居家生活', 450, 150], ['記憶枕', '居家生活', 1590, 820], ['收納箱三入', '居家生活', 499, 210],
  ['精品咖啡豆 500g', '食品', 520, 300], ['綜合堅果禮盒', '食品', 880, 470], ['手工果醬', '食品', 260, 110], ['有機燕麥片', '食品', 320, 160],
  ['保濕面霜', '美妝保養', 980, 380], ['防曬乳 SPF50', '美妝保養', 650, 240], ['卸妝油', '美妝保養', 550, 200], ['面膜 10 入', '美妝保養', 399, 140],
  ['瑜珈墊', '運動戶外', 790, 350], ['運動水壺', '運動戶外', 420, 150], ['彈力帶組', '運動戶外', 360, 110], ['登山背包 30L', '運動戶外', 2180, 1200],
];

// 顧客：2025-01-01 ～ 2026-03-31 註冊
const customers = [];
for (let i = 1; i <= 400; i++) {
  const signup = addDays('2025-01-01', Math.floor(rand() * 455));
  const name = pick(SURN) + pick(GIVEN);
  customers.push({
    customer_id: i,
    name: rand() < 0.04 ? name + ' ' : name, // 少數姓名尾端有空白（字串處理練習）
    gender: weighted([['F', 55], ['M', 40], [null, 5]]),
    birth_year: rand() < 0.12 ? null : 1965 + Math.floor(rand() * 38),
    city: weighted(CITIES),
    signup_date: signup,
    channel: weighted(CHANNELS),
    email: rand() < 0.08 ? null : `${rand() < 0.2 ? 'User' : 'user'}${i}@${pick(['gmail.com', 'yahoo.com.tw', 'Gmail.com', 'hotmail.com'])}`,
  });
}

// 訂單：2025-07-01 ～ 2026-03-31
const orders = [];
const items = [];
let oid = 10001;
let iid = 1;
const START = '2025-07-01';
for (const c of customers) {
  if (rand() < 0.12) continue; // 約 12% 顧客從未下單（anti-join 練習）
  const loyal = rand() < 0.4;
  let n = loyal ? 5 + Math.floor(rand() * 12) : 1 + Math.floor(rand() * 4);
  let d = c.signup_date > START ? c.signup_date : addDays(START, Math.floor(rand() * 60));
  for (let k = 0; k < n; k++) {
    d = addDays(d, k === 0 ? Math.floor(rand() * 20) : 3 + Math.floor(rand() * (loyal ? 22 : 60)));
    if (d > '2026-03-31') break;
    const month = Number(d.slice(5, 7));
    const status = weighted([['completed', 88], ['cancelled', 7], ['refunded', 5]]);
    const order = {
      order_id: oid++, customer_id: c.customer_id, order_date: d, status,
      payment: weighted([['信用卡', 6], ['LINE Pay', 3], ['貨到付款', 1]]),
      shipping_fee: 0, coupon_code: null,
    };
    // 雙 11 與年終有優惠碼
    if ((month === 11 || month === 12) && rand() < 0.45) order.coupon_code = month === 11 ? 'DOUBLE11' : 'YEAREND';
    const nItems = weighted([[1, 5], [2, 3], [3, 2]]);
    let subtotal = 0;
    const used = new Set();
    for (let j = 0; j < nItems; j++) {
      let pIdx = Math.floor(rand() * products.length);
      // 2026 年 2 月起「美妝保養」新客轉換變差的故事：美妝訂單減少
      if (d >= '2026-02-01' && products[pIdx][1] === '美妝保養' && rand() < 0.5) pIdx = Math.floor(rand() * 12);
      if (used.has(pIdx)) continue;
      used.add(pIdx);
      const p = products[pIdx];
      const quantity = weighted([[1, 7], [2, 2], [3, 1]]);
      const discount = order.coupon_code ? 0.15 : weighted([[0, 8], [0.1, 2]]);
      items.push({ order_item_id: iid++, order_id: order.order_id, product_id: pIdx + 1, quantity, unit_price: p[2], discount });
      subtotal += p[2] * quantity * (1 - discount);
    }
    order.shipping_fee = subtotal >= 1000 ? 0 : 80;
    orders.push(order);
  }
}
orders.sort((a, b) => a.order_date.localeCompare(b.order_date) || a.order_id - b.order_id);

const lines = [];
lines.push('-- 好日子線上商城（教學用模擬資料，PostgreSQL）');
lines.push(`CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT,
  birth_year INTEGER,
  city TEXT NOT NULL,
  signup_date DATE NOT NULL,
  channel TEXT NOT NULL,
  email TEXT
);`);
lines.push(`CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,0) NOT NULL,
  cost NUMERIC(10,0) NOT NULL
);`);
lines.push(`CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  order_date DATE NOT NULL,
  status TEXT NOT NULL,
  payment TEXT NOT NULL,
  shipping_fee INTEGER NOT NULL,
  coupon_code TEXT
);`);
lines.push(`CREATE TABLE order_items (
  order_item_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,0) NOT NULL,
  discount NUMERIC(3,2) NOT NULL
);`);
const insert = (table, cols, rows) => {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200).map((r) => `(${cols.map((c) => q(r[c])).join(',')})`).join(',\n');
    lines.push(`INSERT INTO ${table} (${cols.join(',')}) VALUES\n${chunk};`);
  }
};
insert('customers', ['customer_id', 'name', 'gender', 'birth_year', 'city', 'signup_date', 'channel', 'email'], customers);
insert('products', ['product_id', 'product_name', 'category', 'price', 'cost'], products.map((p, i) => ({ product_id: i + 1, product_name: p[0], category: p[1], price: p[2], cost: p[3] })));
insert('orders', ['order_id', 'customer_id', 'order_date', 'status', 'payment', 'shipping_fee', 'coupon_code'], orders);
insert('order_items', ['order_item_id', 'order_id', 'product_id', 'quantity', 'unit_price', 'discount'], items);
writeFileSync('public/datasets/shop.sql', lines.join('\n\n') + '\n');
console.log({ customers: customers.length, orders: orders.length, items: items.length, neverOrdered: customers.length - new Set(orders.map((o) => o.customer_id)).size });
