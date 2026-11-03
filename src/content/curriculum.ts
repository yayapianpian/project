import type { CurriculumModule, Phase } from '../types/content';

// 180 天課程大綱。第 3 階段會為每個主題補上完整單元（教學、範例、練習、解答、常見錯誤）。

export const PHASES: Phase[] = [
  { id: 1, title: '資料分析基礎', practice: '分析一份零售銷售資料' },
  { id: 2, title: 'SQL 專業訓練', practice: '使用模擬企業資料庫回答商業問題' },
  { id: 3, title: 'Python 資料分析', practice: '使用 Python 分析電商銷售資料' },
  { id: 4, title: 'Power BI 商業智慧分析', practice: '製作企業級銷售分析儀表板' },
  { id: 5, title: '跨產業企業專案', practice: '電商、金融、零售、行銷、製造、物流六大產業任務' },
  { id: 6, title: '求職與職場模擬', practice: '作品集、履歷、筆試與主管面試' },
];

export const MODULES: CurriculumModule[] = [
  // 第一個月：資料分析基礎（30 天）
  {
    id: 'm1-mindset', phase: 1, domain: 'business', kind: 'learn', baseDays: 3,
    title: '資料分析思維與問題拆解',
    topics: ['數據分析師在企業裡做什麼', '把模糊需求變成可分析的問題', '假設驅動分析與 MECE 拆解'],
    concepts: ['biz.analysis.framing', 'biz.analysis.decompose'],
  },
  {
    id: 'm1-sheet', phase: 1, domain: 'data', kind: 'learn', baseDays: 5,
    title: '試算表基礎（Google 試算表／LibreOffice Calc）',
    topics: ['介面、儲存格參照與絕對參照', '常用函數：SUM、AVERAGE、COUNT、IF', '文字函數：TRIM、LEFT、SPLIT、TEXT', '日期函數：DATE、EOMONTH、WEEKDAY', 'Excel 與 Google 試算表的差異'],
    concepts: ['data.sheet.functions'],
  },
  {
    id: 'm1-clean', phase: 1, domain: 'data', kind: 'learn', baseDays: 5,
    title: '資料清理',
    topics: ['資料品質檢查（重複、缺失、型別、極端值）', '格式與命名標準化', '重複資料處理', '缺失值的判斷與處理', '依商業口徑清理資料'],
    concepts: ['data.clean.profiling', 'data.clean.standardize', 'data.clean.duplicates', 'data.clean.business_rules'],
  },
  {
    id: 'm1-lookup', phase: 1, domain: 'data', kind: 'learn', baseDays: 4,
    title: '查找與條件彙總',
    topics: ['VLOOKUP 與常見錯誤', 'XLOOKUP / INDEX + MATCH', 'SUMIFS、COUNTIFS、AVERAGEIFS', '綜合練習：建立月報表'],
    concepts: ['data.sheet.lookup', 'data.sheet.conditional'],
  },
  {
    id: 'm1-pivot', phase: 1, domain: 'data', kind: 'learn', baseDays: 3,
    title: '樞紐分析表',
    topics: ['樞紐分析表的列、欄、值與篩選', '分組、計算欄位與百分比顯示', '用樞紐分析表找出問題'],
    concepts: ['data.pivot'],
  },
  {
    id: 'm1-stats', phase: 1, domain: 'business', kind: 'learn', baseDays: 4,
    title: '基礎統計學',
    topics: ['平均數、中位數、眾數與分布', '變異數、標準差與百分位數', '相關與因果', '抽樣與 A/B 測試觀念'],
    concepts: ['biz.stats.central', 'biz.stats.correlation'],
  },
  {
    id: 'm1-metrics', phase: 1, domain: 'business', kind: 'learn', baseDays: 3,
    title: '基礎商業指標',
    topics: ['營收、毛利、客單價', '轉換率、回購率、留存率', 'CAC、ROI 與 LTV'],
    concepts: ['biz.metric.aov', 'biz.metric.conversion', 'biz.metric.retention', 'biz.metric.cac'],
  },
  {
    id: 'm1-project', phase: 1, domain: 'business', kind: 'project', baseDays: 3,
    title: '實戰：零售銷售資料分析',
    topics: ['清理零售銷售資料', '用樞紐分析表找出門市與商品問題', '撰寫一頁式分析摘要'],
    concepts: ['data.clean.profiling', 'data.pivot', 'biz.analysis.decompose', 'comm.report.structure'],
  },

  // 第二個月：SQL 專業訓練（30 天）
  {
    id: 'm2-select', phase: 2, domain: 'sql', kind: 'learn', baseDays: 4,
    title: 'SELECT、WHERE、ORDER BY',
    topics: ['資料庫、資料表與欄位型別', 'SELECT 與 WHERE 條件', 'ORDER BY、LIMIT、DISTINCT', 'NULL 的處理'],
    concepts: ['sql.select.where', 'sql.select.order', 'sql.null'],
  },
  {
    id: 'm2-groupby', phase: 2, domain: 'sql', kind: 'learn', baseDays: 4,
    title: 'GROUP BY 與 HAVING',
    topics: ['聚合函數：COUNT、SUM、AVG', 'GROUP BY 多欄分組', 'HAVING 與 SQL 執行順序', '綜合練習：營運指標查詢'],
    concepts: ['sql.agg.groupby', 'sql.agg.having'],
  },
  {
    id: 'm2-join', phase: 2, domain: 'sql', kind: 'learn', baseDays: 5,
    title: 'JOIN',
    topics: ['INNER JOIN 與 LEFT JOIN', '多表 JOIN 與資料模型', 'JOIN 造成的列數膨脹', 'Anti-join：找出沒有下單的客戶', '綜合練習：客戶與訂單分析'],
    concepts: ['sql.join.left', 'sql.join.fanout'],
  },
  {
    id: 'm2-subcte', phase: 2, domain: 'sql', kind: 'learn', baseDays: 4,
    title: '子查詢與 CTE',
    topics: ['WHERE 與 FROM 中的子查詢', 'CTE（WITH）分步解題', '多層 CTE 的可讀性', '綜合練習：首購與回購'],
    concepts: ['sql.subquery', 'sql.cte'],
  },
  {
    id: 'm2-case', phase: 2, domain: 'sql', kind: 'learn', baseDays: 2,
    title: 'CASE WHEN',
    topics: ['CASE WHEN 分類與分群', '條件聚合（樞紐式查詢）'],
    concepts: ['sql.case'],
  },
  {
    id: 'm2-window', phase: 2, domain: 'sql', kind: 'learn', baseDays: 5,
    title: 'Window Functions',
    topics: ['ROW_NUMBER、RANK、DENSE_RANK', 'PARTITION BY 與排名應用', 'LAG / LEAD 與月增率', '累計與移動平均', '綜合練習：留存與回購間隔'],
    concepts: ['sql.window.rank', 'sql.window.lag'],
  },
  {
    id: 'm2-datetime', phase: 2, domain: 'sql', kind: 'learn', baseDays: 3,
    title: '日期與字串處理',
    topics: ['DATE_TRUNC、EXTRACT 與 INTERVAL', '字串處理與清理', 'PostgreSQL、MySQL、SQL Server 語法差異'],
    concepts: ['sql.datetime'],
  },
  {
    id: 'm2-project', phase: 2, domain: 'sql', kind: 'project', baseDays: 3,
    title: '實戰：用 SQL 回答商業問題',
    topics: ['理解模擬企業資料庫', '回答主管的 5 個商業問題', '整理查詢結果與結論'],
    concepts: ['sql.join.left', 'sql.cte', 'sql.window.rank', 'biz.analysis.framing'],
  },

  // 第三個月：Python 資料分析（30 天）
  {
    id: 'm3-basics', phase: 3, domain: 'python', kind: 'learn', baseDays: 4,
    title: 'Python 基礎語法',
    topics: ['安裝環境：Anaconda / Jupyter / VS Code（Windows）', '變數、型別與運算', '條件判斷與迴圈', '字串處理'],
    concepts: ['py.basics.types', 'py.basics.function'],
  },
  {
    id: 'm3-collections', phase: 3, domain: 'python', kind: 'learn', baseDays: 4,
    title: 'List、Dictionary、Function',
    topics: ['List 與切片', 'Dictionary 與資料對照', 'Function 與參數', '綜合練習：用純 Python 彙總訂單'],
    concepts: ['py.basics.list', 'py.basics.dict', 'py.basics.function'],
  },
  {
    id: 'm3-numpy', phase: 3, domain: 'python', kind: 'learn', baseDays: 2,
    title: 'NumPy',
    topics: ['陣列與向量化運算', '統計函數與布林篩選'],
    concepts: ['py.numpy'],
  },
  {
    id: 'm3-pandas', phase: 3, domain: 'python', kind: 'learn', baseDays: 6,
    title: 'Pandas',
    topics: ['讀取與檢視資料', '選取與篩選', '新增欄位與型別轉換', 'groupby 與 agg', 'merge 與資料合併', 'pivot_table 與重塑'],
    concepts: ['py.pandas.basics', 'py.pandas.filter', 'py.pandas.groupby', 'py.pandas.merge'],
  },
  {
    id: 'm3-clean', phase: 3, domain: 'python', kind: 'learn', baseDays: 4,
    title: '資料清理與轉換',
    topics: ['缺失值處理', '異常值偵測（IQR、Z-score）', '日期與字串清理', '建立可重複執行的清理流程'],
    concepts: ['py.pandas.missing', 'py.pandas.outliers'],
  },
  {
    id: 'm3-viz', phase: 3, domain: 'python', kind: 'learn', baseDays: 3,
    title: 'Matplotlib 視覺化',
    topics: ['折線圖、長條圖、直方圖', '圖表選擇與可讀性', '輸出報告用圖表'],
    concepts: ['py.viz'],
  },
  {
    id: 'm3-eda', phase: 3, domain: 'python', kind: 'learn', baseDays: 4,
    title: '探索性資料分析（EDA）',
    topics: ['EDA 流程與檢查清單', '單變量與雙變量分析', '分群比較與趨勢', '從 EDA 到商業假設'],
    concepts: ['py.eda'],
  },
  {
    id: 'm3-project', phase: 3, domain: 'python', kind: 'project', baseDays: 3,
    title: '實戰：Python 分析電商銷售資料',
    topics: ['清理電商訂單資料', 'RFM 分群（升級你過去的分析）', '撰寫 Notebook 分析報告'],
    concepts: ['py.pandas.groupby', 'py.pandas.missing', 'biz.rfm', 'comm.report.structure'],
  },

  // 第四個月：Power BI（30 天）
  {
    id: 'm4-pq', phase: 4, domain: 'powerbi', kind: 'learn', baseDays: 4,
    title: 'Power Query',
    topics: ['匯入資料與套用步驟', '清理、分欄、取代與型別', '合併查詢與附加查詢', '參數化與可維護的查詢'],
    concepts: ['pbi.powerquery'],
  },
  {
    id: 'm4-model', phase: 4, domain: 'powerbi', kind: 'learn', baseDays: 4,
    title: '資料模型與星型架構',
    topics: ['事實表與維度表', '建立日期表', '關聯、基數與篩選方向', '常見模型錯誤'],
    concepts: ['pbi.model.star', 'pbi.model.relationship'],
  },
  {
    id: 'm4-dax', phase: 4, domain: 'powerbi', kind: 'learn', baseDays: 7,
    title: 'DAX',
    topics: ['量值與計算欄', 'SUM、DIVIDE、COUNTROWS', 'CALCULATE 與篩選內容', 'FILTER、ALL、REMOVEFILTERS', '迭代函數 SUMX', '時間智慧：YTD、YoY、MoM', '綜合練習：銷售 KPI 量值'],
    concepts: ['pbi.dax.measure', 'pbi.dax.basic', 'pbi.dax.calculate', 'pbi.dax.iterator', 'pbi.dax.timeintel'],
  },
  {
    id: 'm4-kpi', phase: 4, domain: 'powerbi', kind: 'learn', baseDays: 3,
    title: 'KPI 設計',
    topics: ['如何選 KPI：目標、比較基準與責任', 'KPI 卡片與目標達成率', '指標定義文件'],
    concepts: ['pbi.viz.kpi', 'biz.analysis.framing'],
  },
  {
    id: 'm4-viz', phase: 4, domain: 'powerbi', kind: 'learn', baseDays: 4,
    title: '資料視覺化與互動',
    topics: ['圖表選擇原則', '版面層級與閱讀動線', '交叉篩選、交叉分析篩選器與下鑽', '工具提示與書籤'],
    concepts: ['pbi.viz.kpi'],
  },
  {
    id: 'm4-dash', phase: 4, domain: 'powerbi', kind: 'learn', baseDays: 4,
    title: '互動式儀表板與分析報告',
    topics: ['從問題設計儀表板', '主管版與操作版儀表板', '在報告中寫出洞察', '發佈與分享（免費方案限制）'],
    concepts: ['pbi.viz.kpi', 'comm.storytelling'],
  },
  {
    id: 'm4-project', phase: 4, domain: 'powerbi', kind: 'project', baseDays: 4,
    title: '實戰：企業級銷售分析儀表板',
    topics: ['需求訪談與 KPI 定義', '建立資料模型與量值', '設計儀表板', '撰寫分析報告並接受主管評分'],
    concepts: ['pbi.model.star', 'pbi.dax.calculate', 'pbi.viz.kpi', 'comm.report.structure'],
  },

  // 第五個月：跨產業企業專案（30 天）
  {
    id: 'm5-ecom', phase: 5, domain: 'business', kind: 'project', baseDays: 5,
    title: '電商：營收下降 15% 原因分析',
    topics: ['任務簡報與追問主管', 'SQL 取數與 Python 清理', '營收拆解與下鑽', 'RFM 分群與行動方案', '儀表板與三項建議'],
    concepts: ['biz.analysis.decompose', 'biz.rfm', 'biz.metric.retention', 'comm.report.structure'],
  },
  {
    id: 'm5-fin', phase: 5, domain: 'business', kind: 'project', baseDays: 5,
    title: '金融：客戶交易與異常交易分析',
    topics: ['金融業背景與風險指標', '客戶交易行為分析', '異常交易規則設計', '規則命中率與誤判率', '報告與建議'],
    concepts: ['biz.analysis.framing', 'py.pandas.outliers', 'comm.report.structure'],
  },
  {
    id: 'm5-retail', phase: 5, domain: 'business', kind: 'project', baseDays: 5,
    title: '零售：門市績效與庫存週轉',
    topics: ['零售業指標：坪效、週轉、售罄率', '門市績效排名', '低績效門市原因', '滯銷品與庫存週轉', '報告與建議'],
    concepts: ['biz.analysis.mix', 'data.pivot', 'comm.report.structure'],
  },
  {
    id: 'm5-mkt', phase: 5, domain: 'business', kind: 'project', baseDays: 5,
    title: '行銷：廣告 ROI 與 CAC',
    topics: ['行銷漏斗與指標', '各渠道 ROI、ROAS、CAC', '轉換率漏斗分析', '預算重新分配', '報告與建議'],
    concepts: ['biz.metric.cac', 'biz.metric.conversion', 'comm.report.structure'],
  },
  {
    id: 'm5-mfg', phase: 5, domain: 'business', kind: 'project', baseDays: 5,
    title: '製造：良率與設備異常',
    topics: ['製造業指標：良率、OEE、MTBF', '產線與班別良率分析', '設備感測資料異常', '根因分析', '報告與建議'],
    concepts: ['biz.analysis.decompose', 'py.eda', 'comm.report.structure'],
  },
  {
    id: 'm5-logi', phase: 5, domain: 'business', kind: 'project', baseDays: 5,
    title: '物流：配送效率與成本',
    topics: ['物流業指標：準時率、每單成本', '延遲原因分析', '路線與時段比較', '成本結構分析', '報告與建議'],
    concepts: ['biz.analysis.decompose', 'sql.window.lag', 'comm.report.structure'],
  },

  // 第六個月：求職與職場模擬（30 天）
  {
    id: 'm6-portfolio', phase: 6, domain: 'communication', kind: 'job', baseDays: 8,
    title: '完成 3～5 個作品並建立作品集',
    topics: ['挑選作品與定位', '改寫作品：背景、問題、方法、洞察、建議', '作品集頁面與 GitHub', '請主管角色評分並修改'],
    concepts: ['comm.report.structure', 'comm.storytelling'],
  },
  {
    id: 'm6-resume', phase: 6, domain: 'communication', kind: 'job', baseDays: 3,
    title: '數據分析履歷',
    topics: ['初階數據分析師職缺要求拆解', '用 STAR 寫專案經驗與量化成果', '履歷檢核與修改'],
    concepts: ['comm.storytelling'],
  },
  {
    id: 'm6-sqlint', phase: 6, domain: 'sql', kind: 'job', baseDays: 5,
    title: 'SQL 面試題',
    topics: ['常見題型：Top N、留存、連續登入', 'Window Functions 面試題', '限時練習', '講解你的解題思路', '錯題複習'],
    concepts: ['sql.window.rank', 'sql.window.lag', 'sql.cte', 'sql.join.fanout'],
  },
  {
    id: 'm6-pyint', phase: 6, domain: 'python', kind: 'job', baseDays: 4,
    title: 'Python 面試題',
    topics: ['Pandas 常見題型', '資料清理實作題', '限時練習', '錯題複習'],
    concepts: ['py.pandas.groupby', 'py.pandas.merge', 'py.pandas.missing'],
  },
  {
    id: 'm6-exam', phase: 6, domain: 'business', kind: 'job', baseDays: 4,
    title: '企業數據分析筆試模擬',
    topics: ['筆試模擬 1：SQL + 商業情境', '檢討與補強', '筆試模擬 2：綜合題', '檢討與補強'],
    concepts: ['biz.analysis.framing', 'biz.analysis.decompose', 'sql.cte'],
  },
  {
    id: 'm6-interview', phase: 6, domain: 'communication', kind: 'job', baseDays: 4,
    title: '主管面試模擬',
    topics: ['3 分鐘說明你的專案', '情境題：數字對不上、需求不清楚', '行為面試題', '總複習與最後調整'],
    concepts: ['comm.storytelling'],
  },
  {
    id: 'm6-story', phase: 6, domain: 'communication', kind: 'job', baseDays: 2,
    title: '解釋分析邏輯與商業洞察',
    topics: ['從數字到洞察到行動', '面對非技術主管的說明技巧'],
    concepts: ['comm.storytelling', 'comm.report.structure'],
  },
];

/** 每週一次的商業分析思維任務（不只在第五個月才練） */
export const WEEKLY_BUSINESS_PROMPTS: string[] = [
  '每週商業思維：外送平台訂單量下降，你會先看哪三個指標？',
  '每週商業思維：一家手搖飲想展店，你需要哪些資料判斷地點？',
  '每週商業思維：電商首頁改版後轉換率上升，如何確認是改版造成的？',
  '每週商業思維：會員數成長但營收沒有成長，可能原因是什麼？',
  '每週商業思維：如何定義「活躍用戶」？不同定義會有什麼影響？',
  '每週商業思維：滿額免運門檻從 999 調到 1,200，會影響哪些指標？',
  '每週商業思維：超商的鮮食報廢率偏高，你會怎麼分析？',
  '每週商業思維：信用卡盜刷偵測規則太嚴或太鬆，各有什麼代價？',
  '每週商業思維：廣告點擊率很高但轉換率很低，可能原因是什麼？',
  '每週商業思維：如何評估一次大型促銷活動是否成功？',
  '每週商業思維：工廠良率下降 2%，你會先問哪些問題？',
  '每週商業思維：物流延遲率上升，如何區分是天氣、人力還是系統問題？',
  '每週商業思維：主管要一個「客戶健康度」指標，你會怎麼設計？',
];

export const MODULE_BY_ID: Record<string, CurriculumModule> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
