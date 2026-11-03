// 以固定亂數種子產生教學用資料集，並算出題目的標準答案。
// 執行：node scripts/generate-datasets.mjs
// 產出：public/datasets/retail_sales.csv、src/content/generated/retailAnswers.json
import { writeFileSync, mkdirSync } from 'node:fs';

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261104);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};

// ── 零售連鎖「好日子超市」2026 年第一季銷售資料 ──
const STORES = [
  { store: '台北信義店', region: '北區', weight: 1.3 },
  { store: '台北內湖店', region: '北區', weight: 1.0 },
  { store: '新北板橋店', region: '北區', weight: 1.1 },
  { store: '台中逢甲店', region: '中區', weight: 1.0 },
  { store: '高雄夢時代店', region: '南區', weight: 1.2 },
];
const PRODUCTS = [
  { category: '飲料', product: '鮮奶 936ml', price: 95 },
  { category: '飲料', product: '無糖綠茶', price: 25 },
  { category: '飲料', product: '咖啡豆 500g', price: 420 },
  { category: '零食', product: '洋芋片', price: 45 },
  { category: '零食', product: '綜合堅果', price: 299 },
  { category: '日用品', product: '衛生紙 12 入', price: 189 },
  { category: '日用品', product: '洗衣精 2L', price: 259 },
  { category: '生鮮', product: '有機蔬菜箱', price: 350 },
  { category: '生鮮', product: '鮭魚切片', price: 280 },
  { category: '生鮮', product: '雞胸肉 1kg', price: 210 },
];
const PAYMENTS = [['信用卡', 5], ['現金', 3], ['行動支付', 4]];

const pad = (n) => String(n).padStart(2, '0');
const rows = [];
let id = 100001;
for (let m = 1; m <= 3; m++) {
  const days = [31, 28, 31][m - 1];
  for (let d = 1; d <= days; d++) {
    for (const s of STORES) {
      // 故事：高雄夢時代店 3 月生鮮因冷藏設備故障停售兩週，生鮮訂單大減
      const n = Math.round((6 + rand() * 4) * s.weight);
      for (let i = 0; i < n; i++) {
        let p = pick(PRODUCTS);
        if (s.store === '高雄夢時代店' && m === 3 && d >= 8 && d <= 21 && p.category === '生鮮') {
          if (rand() < 0.85) p = pick(PRODUCTS.filter((x) => x.category !== '生鮮'));
        }
        const quantity = weighted([[1, 6], [2, 3], [3, 1]]);
        const discount = weighted([[0, 7], [0.1, 2], [0.2, 1]]);
        const amount = Math.round(p.price * quantity * (1 - discount));
        rows.push({
          order_id: `R${id++}`,
          order_date: `2026-${pad(m)}-${pad(d)}`,
          store: s.store,
          region: s.region,
          category: p.category,
          product: p.product,
          unit_price: p.price,
          quantity,
          discount,
          amount,
          payment: weighted(PAYMENTS),
          member_id: rand() < 0.65 ? `M${String(1 + Math.floor(rand() * 900)).padStart(4, '0')}` : '',
        });
      }
    }
  }
}
const clean = rows.map((r) => ({ ...r }));

// ── 刻意加入的髒資料（教學用）──
const dirty = rows.map((r) => ({ ...r }));
// 1) 門市名稱不一致：部分「台北信義店」寫成「臺北信義店」或後面多一個空白
let variants = 0;
for (const r of dirty) {
  if (r.store === '台北信義店' && rand() < 0.08) {
    r.store = rand() < 0.5 ? '臺北信義店' : '台北信義店 ';
    variants++;
  }
}
// 2) 重複列：40 筆訂單被系統重複寫入一次
const dupSource = [];
while (dupSource.length < 40) {
  const r = dirty[Math.floor(rand() * dirty.length)];
  if (!dupSource.includes(r)) dupSource.push(r);
}
// 3) 測試訂單 3 筆
const tests = [1, 2, 3].map((k) => ({
  order_id: `TEST${k}`, order_date: `2026-02-0${k}`, store: '台北內湖店', region: '北區', category: '飲料', product: '無糖綠茶',
  unit_price: 25, quantity: 1, discount: 0, amount: 25, payment: '現金', member_id: 'TEST',
}));
const out = [...dirty, ...dupSource.map((r) => ({ ...r })), ...tests];
// 依日期排序（重複列會出現在原始列附近）
out.sort((a, b) => a.order_date.localeCompare(b.order_date) || a.order_id.localeCompare(b.order_id));

const COLS = ['order_id', 'order_date', 'store', 'region', 'category', 'product', 'unit_price', 'quantity', 'discount', 'amount', 'payment', 'member_id'];
const csv = [COLS.join(','), ...out.map((r) => COLS.map((c) => String(r[c])).join(','))].join('\n') + '\n';
mkdirSync('public/datasets', { recursive: true });
writeFileSync('public/datasets/retail_sales.csv', '﻿' + csv); // BOM：讓 Excel / LibreOffice 正確辨識中文

// ── 門市主檔（查找函數練習用）──
const STORE_INFO = [
  { store_id: 'S01', store: '台北信義店', region: '北區', manager: '林雅婷', area_ping: 180, opened: 2015 },
  { store_id: 'S02', store: '台北內湖店', region: '北區', manager: '陳志明', area_ping: 150, opened: 2018 },
  { store_id: 'S03', store: '新北板橋店', region: '北區', manager: '王怡君', area_ping: 160, opened: 2017 },
  { store_id: 'S04', store: '台中逢甲店', region: '中區', manager: '張家豪', area_ping: 140, opened: 2019 },
  { store_id: 'S05', store: '高雄夢時代店', region: '南區', manager: '黃淑芬', area_ping: 200, opened: 2016 },
];
const SCOLS = ['store_id', 'store', 'region', 'manager', 'area_ping', 'opened'];
writeFileSync('public/datasets/stores.csv', '\ufeff' + [SCOLS.join(','), ...STORE_INFO.map((r) => SCOLS.map((c) => r[c]).join(','))].join('\n') + '\n');

// ── 標準答案（依清理後資料 clean 計算）──
const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const by = (arr, key) => arr.reduce((m, r) => ((m[r[key]] ??= []).push(r), m), {});
const month = (r) => Number(r.order_date.slice(5, 7));
const revenue = (arr) => sum(arr.map((r) => r.amount));
const byStore = by(clean, 'store');
const storeStats = Object.fromEntries(
  Object.entries(byStore).map(([s, list]) => [s, { revenue: revenue(list), orders: list.length, aov: Math.round(revenue(list) / list.length) }]),
);
const storeMonth = {};
for (const s of Object.keys(byStore)) storeMonth[s] = [1, 2, 3].map((m) => revenue(byStore[s].filter((r) => month(r) === m)));
const catMonth = {};
for (const [c, list] of Object.entries(by(clean, 'category'))) catMonth[c] = [1, 2, 3].map((m) => revenue(list.filter((r) => month(r) === m)));
const ksFresh = [1, 2, 3].map((m) => revenue(byStore['高雄夢時代店'].filter((r) => month(r) === m && r.category === '生鮮')));
const amounts = clean.map((r) => r.amount).sort((a, b) => a - b);
const median = (a) => (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
const members = clean.filter((r) => r.member_id);

const answers = {
  rawRows: out.length,
  duplicateRows: dupSource.length,
  testRows: tests.length,
  storeNameVariants: variants,
  cleanRows: clean.length,
  totalRevenue: revenue(clean),
  northMarchRevenue: revenue(clean.filter((r) => r.region === '北區' && month(r) === 3)),
  janRevenue: revenue(clean.filter((r) => month(r) === 1)),
  febRevenue: revenue(clean.filter((r) => month(r) === 2)),
  marRevenue: revenue(clean.filter((r) => month(r) === 3)),
  avgAmount: Math.round((revenue(clean) / clean.length) * 100) / 100,
  medianAmount: median(amounts),
  memberRate: Math.round((members.length / clean.length) * 1000) / 10,
  missingMember: clean.length - members.length,
  rawMissingMember: out.filter((r) => !r.member_id).length,
  rawStoreVariants: out.filter((r) => r.store === '臺北信義店' || r.store === '台北信義店 ').length,
  rawStoreSpellings: new Set(out.map((r) => r.store)).size,
  rawXinyiRows: out.filter((r) => r.store.trim().replace('臺', '台') === '台北信義店').length,
  storeStats,
  storeMonth,
  catMonth,
  kaohsiungFreshByMonth: ksFresh,
  salesPerPing: Object.fromEntries(STORE_INFO.map((s) => [s.store, Math.round(revenue(byStore[s.store]) / s.area_ping)])),
  stdevAmount: (() => { const m = revenue(clean) / clean.length; return Math.round(Math.sqrt(sum(clean.map((r) => (r.amount - m) ** 2)) / (clean.length - 1)) * 100) / 100; })(),
  p90Amount: amounts[Math.ceil(0.9 * amounts.length) - 1],
  maxAmount: amounts[amounts.length - 1],
  memberAov: Math.round(revenue(members) / members.length),
  nonMemberAov: Math.round(revenue(clean.filter((r) => !r.member_id)) / clean.filter((r) => !r.member_id).length),
  freshShare: Math.round((revenue(clean.filter((r) => r.category === '生鮮')) / revenue(clean)) * 1000) / 10,
  ksMarchChangePct: Math.round(((storeMonth['高雄夢時代店'][2] - storeMonth['高雄夢時代店'][1]) / storeMonth['高雄夢時代店'][1]) * 1000) / 10,
  othersMarchChangePct: Math.round((([...Object.keys(byStore)].filter((k) => k !== '高雄夢時代店').reduce((t, k) => t + storeMonth[k][2], 0) / [...Object.keys(byStore)].filter((k) => k !== '高雄夢時代店').reduce((t, k) => t + storeMonth[k][1], 0)) - 1) * 1000) / 10,
  ksFreshDrop: ksFresh[1] - ksFresh[2],
  ksTotalDrop: storeMonth['高雄夢時代店'][1] - storeMonth['高雄夢時代店'][2],
  qtyOver3: clean.filter((r) => r.quantity >= 3).length,
  bigOrders: clean.filter((r) => r.amount >= 500).length,
  xinyiCoffeeQty: sum(byStore['台北信義店'].filter((r) => r.product === '咖啡豆 500g').map((r) => r.quantity)),
};
mkdirSync('src/content/generated', { recursive: true });
writeFileSync('src/content/generated/retailAnswers.json', JSON.stringify(answers, null, 2) + '\n');
console.log(JSON.stringify({ rawRows: answers.rawRows, cleanRows: answers.cleanRows, variants, total: answers.totalRevenue, ksFresh, storeMonthKs: storeMonth['高雄夢時代店'] }));
