// 「好日子線上商城」資料庫結構（顯示在 SQL 編輯器旁）
export const SHOP_SCHEMA: { table: string; desc: string; columns: [string, string, string][] }[] = [
  { table: 'customers', desc: '顧客（400 人）', columns: [
    ['customer_id', 'INTEGER', '顧客編號（主鍵）'], ['name', 'TEXT', '姓名（少數尾端有空白）'], ['gender', 'TEXT', 'F / M / NULL'],
    ['birth_year', 'INTEGER', '出生年（可能為 NULL）'], ['city', 'TEXT', '縣市'], ['signup_date', 'DATE', '註冊日'],
    ['channel', 'TEXT', '註冊來源：自然搜尋、Facebook 廣告、Google 廣告、朋友推薦'], ['email', 'TEXT', '電子郵件（大小寫不一、可能為 NULL）'],
  ] },
  { table: 'products', desc: '商品（20 項）', columns: [
    ['product_id', 'INTEGER', '商品編號（主鍵）'], ['product_name', 'TEXT', '商品名稱'], ['category', 'TEXT', '3C 配件、居家生活、食品、美妝保養、運動戶外'],
    ['price', 'NUMERIC', '售價'], ['cost', 'NUMERIC', '成本'],
  ] },
  { table: 'orders', desc: '訂單（2025-07 ～ 2026-03）', columns: [
    ['order_id', 'INTEGER', '訂單編號（主鍵）'], ['customer_id', 'INTEGER', '顧客編號 → customers'], ['order_date', 'DATE', '下單日'],
    ['status', 'TEXT', 'completed / cancelled / refunded'], ['payment', 'TEXT', '信用卡、LINE Pay、貨到付款'],
    ['shipping_fee', 'INTEGER', '運費（訂單層級，0 或 80）'], ['coupon_code', 'TEXT', '優惠碼 DOUBLE11 / YEAREND / NULL'],
  ] },
  { table: 'order_items', desc: '訂單明細（一張訂單可有多個品項）', columns: [
    ['order_item_id', 'INTEGER', '明細編號（主鍵）'], ['order_id', 'INTEGER', '訂單編號 → orders'], ['product_id', 'INTEGER', '商品編號 → products'],
    ['quantity', 'INTEGER', '數量'], ['unit_price', 'NUMERIC', '單價'], ['discount', 'NUMERIC', '折扣率（0、0.1、0.15）'],
  ] },
];

export const REVENUE_NOTE = '品項金額 = unit_price × quantity × (1 − discount)。除非題目另外說明，營收只計算 status = \'completed\' 的訂單，且不含運費。';
