import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';

const PAGES: Record<string, { title: string; phase: number | null; summary: string; items: string[] }> = {
  sql: {
    title: 'SQL 練習室', phase: 4,
    summary: '在瀏覽器裡執行真正的 PostgreSQL（PGlite），用模擬企業資料庫練習，提交後比對查詢結果批改。',
    items: ['資料庫結構與關聯圖', '執行、提交批改、格式化、重設', '三段式引導：錯在哪 → 解題提示 → 完整解答', '模擬企業資料庫：電商、零售、金融', '自由練習與查詢筆記'],
  },
  python: {
    title: 'Python 練習室', phase: 4,
    summary: '在瀏覽器裡執行 Python（Pyodide），內建 pandas、numpy、matplotlib，類似 Jupyter 的儲存格介面。',
    items: ['多儲存格執行與圖表輸出', '隱藏檢查程式自動批改', '錯誤訊息中文解讀', '逾時保護與中止執行'],
  },
  powerbi: {
    title: 'Power BI 實戰中心', phase: 5,
    summary: '使用免費的 Power BI Desktop（Windows）完成實戰。平台提供資料集、逐步任務、DAX 數值驗證與儀表板評分表。',
    items: ['下載資料集與逐步任務', 'DAX 題：回填數值，平台比對正確值', '儀表板截圖交付與主管評分表', '誠實說明：平台無法自動開啟或批改 .pbix 檔'],
  },
  projects: {
    title: '產業模擬專案', phase: 5,
    summary: '你是剛進公司的數據分析師，完成主管交辦的任務。只有圖表、沒有洞察與建議，不算合格。',
    items: ['電商、金融、零售、行銷、製造、物流六大產業', '任務簡報與「追問主管」', '分步檢查點：SQL、Python、Power BI', '依技術正確性、分析邏輯、商業洞察、建議可行性評分'],
  },
  portfolio: {
    title: '個人作品集', phase: 6,
    summary: '只收通過主管評分門檻的專案，可匯出成 HTML 與 Markdown 放到 GitHub。',
    items: ['專案背景、商業問題、資料、清理、方法、結果、洞察、建議', '主管評分與評語', '匯出 HTML / Markdown'],
  },
  interview: {
    title: '求職面試中心', phase: 6,
    summary: '履歷、SQL／Python 面試題、企業筆試模擬與主管面試模擬。',
    items: ['用作品集產生 STAR 格式的專案經驗', 'SQL / Python 限時面試題', '90 分鐘企業筆試模擬', '主管面試情境題與「3 分鐘說明你的專案」'],
  },
  notfound: { title: '找不到這個頁面', phase: null, summary: '這個網址不存在。', items: [] },
};

export function ComingSoon({ id }: { id: keyof typeof PAGES | string }) {
  const p = PAGES[id] ?? PAGES.notfound;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={p.title} subtitle={p.phase ? `將於第 ${p.phase} 階段開放` : undefined} />
      <div className="card">
        <p className="text-sm leading-relaxed">{p.summary}</p>
        {p.items.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            {p.items.map((i) => <li key={i}>• {i}</li>)}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/" className="btn btn-ghost">回到首頁</Link>
          {p.phase && <Link to="/lessons" className="btn btn-ghost">先到課程中心用 AI 學習</Link>}
        </div>
      </div>
    </div>
  );
}
