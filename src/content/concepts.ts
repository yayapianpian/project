import type { Concept } from '../types/content';

// 概念標籤：熟練度與弱點偵測的最小單位。第 3 階段會擴充至約 120 個。
export const CONCEPTS: Concept[] = [
  // 資料處理
  { id: 'data.sheet.functions', domain: 'data', name: '試算表基本函數', importance: 2 },
  { id: 'data.sheet.conditional', domain: 'data', name: '條件彙總（SUMIFS / COUNTIFS）', importance: 3 },
  { id: 'data.sheet.lookup', domain: 'data', name: '查找函數（VLOOKUP / XLOOKUP）', importance: 3 },
  { id: 'data.pivot', domain: 'data', name: '樞紐分析表', importance: 3 },
  { id: 'data.clean.profiling', domain: 'data', name: '資料品質檢查', importance: 3 },
  { id: 'data.clean.standardize', domain: 'data', name: '格式與命名標準化', importance: 2 },
  { id: 'data.clean.duplicates', domain: 'data', name: '重複資料處理', importance: 2 },
  { id: 'data.clean.business_rules', domain: 'data', name: '依商業口徑清理資料', importance: 3 },

  // SQL
  { id: 'sql.select.where', domain: 'sql', name: 'SELECT 與 WHERE', importance: 3 },
  { id: 'sql.select.order', domain: 'sql', name: 'ORDER BY 與 LIMIT', importance: 2 },
  { id: 'sql.null', domain: 'sql', name: 'NULL 的處理', importance: 2 },
  { id: 'sql.agg.groupby', domain: 'sql', name: 'GROUP BY 與聚合函數', importance: 3 },
  { id: 'sql.agg.having', domain: 'sql', name: 'HAVING', importance: 2 },
  { id: 'sql.join.left', domain: 'sql', name: 'INNER / LEFT JOIN', importance: 3 },
  { id: 'sql.join.fanout', domain: 'sql', name: 'JOIN 造成的列數膨脹', importance: 3 },
  { id: 'sql.subquery', domain: 'sql', name: '子查詢', importance: 2 },
  { id: 'sql.cte', domain: 'sql', name: 'CTE（WITH）', importance: 2 },
  { id: 'sql.case', domain: 'sql', name: 'CASE WHEN', importance: 2 },
  { id: 'sql.window.rank', domain: 'sql', name: 'ROW_NUMBER / RANK', importance: 3 },
  { id: 'sql.window.lag', domain: 'sql', name: 'LAG / LEAD 與移動計算', importance: 2 },
  { id: 'sql.datetime', domain: 'sql', name: '日期與字串處理', importance: 2 },

  // Python
  { id: 'py.basics.types', domain: 'python', name: '資料型別與變數', importance: 1 },
  { id: 'py.basics.list', domain: 'python', name: 'List 與切片', importance: 2 },
  { id: 'py.basics.dict', domain: 'python', name: 'Dictionary', importance: 2 },
  { id: 'py.basics.function', domain: 'python', name: 'Function 與迴圈', importance: 2 },
  { id: 'py.numpy', domain: 'python', name: 'NumPy 基礎', importance: 1 },
  { id: 'py.pandas.basics', domain: 'python', name: 'Pandas 讀取與檢視資料', importance: 3 },
  { id: 'py.pandas.filter', domain: 'python', name: 'Pandas 篩選', importance: 3 },
  { id: 'py.pandas.groupby', domain: 'python', name: 'Pandas groupby', importance: 3 },
  { id: 'py.pandas.missing', domain: 'python', name: '缺失值處理', importance: 3 },
  { id: 'py.pandas.outliers', domain: 'python', name: '異常值處理', importance: 2 },
  { id: 'py.pandas.merge', domain: 'python', name: 'Pandas merge', importance: 3 },
  { id: 'py.viz', domain: 'python', name: 'Matplotlib 視覺化', importance: 2 },
  { id: 'py.eda', domain: 'python', name: '探索性資料分析（EDA）', importance: 3 },

  // Power BI
  { id: 'pbi.powerquery', domain: 'powerbi', name: 'Power Query', importance: 3 },
  { id: 'pbi.model.star', domain: 'powerbi', name: '星型架構', importance: 3 },
  { id: 'pbi.model.relationship', domain: 'powerbi', name: '關聯與基數', importance: 2 },
  { id: 'pbi.dax.measure', domain: 'powerbi', name: '量值與計算欄', importance: 3 },
  { id: 'pbi.dax.basic', domain: 'powerbi', name: 'DAX 基礎函數', importance: 2 },
  { id: 'pbi.dax.calculate', domain: 'powerbi', name: 'CALCULATE 與篩選內容', importance: 3 },
  { id: 'pbi.dax.timeintel', domain: 'powerbi', name: '時間智慧函數', importance: 2 },
  { id: 'pbi.dax.iterator', domain: 'powerbi', name: '迭代函數（SUMX 等）', importance: 2 },
  { id: 'pbi.viz.kpi', domain: 'powerbi', name: 'KPI 與儀表板設計', importance: 3 },

  // 商業分析
  { id: 'biz.metric.aov', domain: 'business', name: '客單價', importance: 2 },
  { id: 'biz.metric.conversion', domain: 'business', name: '轉換率', importance: 3 },
  { id: 'biz.metric.retention', domain: 'business', name: '回購率與留存', importance: 3 },
  { id: 'biz.metric.cac', domain: 'business', name: 'CAC 與 ROI', importance: 2 },
  { id: 'biz.stats.central', domain: 'business', name: '平均數與中位數', importance: 2 },
  { id: 'biz.stats.correlation', domain: 'business', name: '相關與因果', importance: 2 },
  { id: 'biz.analysis.framing', domain: 'business', name: '釐清問題與分析口徑', importance: 3 },
  { id: 'biz.analysis.decompose', domain: 'business', name: '指標拆解', importance: 3 },
  { id: 'biz.analysis.mix', domain: 'business', name: '組成效應（辛普森悖論）', importance: 2 },
  { id: 'biz.rfm', domain: 'business', name: 'RFM 分群', importance: 2 },

  // 專案表達（由專案與面試評分產生證據，診斷測驗不涵蓋）
  { id: 'comm.report.structure', domain: 'communication', name: '分析報告結構', importance: 3 },
  { id: 'comm.storytelling', domain: 'communication', name: '說明分析邏輯與洞察', importance: 3 },
];

export const CONCEPT_BY_ID: Record<string, Concept> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
