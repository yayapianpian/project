# 03 資料庫設計

資料分成兩部分：

1. **內容資料（Content）**：放在 Git 倉庫 `content/`，建置時打包，唯讀。
2. **使用者資料（User Data）**：存在瀏覽器 IndexedDB（Dexie.js），可匯出備份。

使用者資料只透過 ID 參照內容；內容改版時以 `contentVersion` 判斷相容性。

---

## 一、內容資料模型（TypeScript 型別）

```ts
// 概念標籤：熟練度、弱點偵測的最小單位
interface Concept {
  id: string;                 // 'sql.join.left'
  domain: Domain;             // 'sql'
  name: string;               // 'LEFT JOIN 與缺失對應'
  prerequisites: string[];    // ['sql.select.basic']
  remediationLessonId: string;
}
type Domain = 'data' | 'sql' | 'python' | 'powerbi' | 'business' | 'communication';

interface Phase { id: string; month: 1|2|3|4|5|6; title: string; weeks: Week[] }
interface Week  { index: number; goal: string; days: DayTemplate[] }
interface DayTemplate {
  dayIndex: number;           // 1..180
  tasks: TaskTemplate[];
  optional?: boolean;         // 落後時可壓縮
}
interface TaskTemplate {
  type: 'lesson' | 'practice' | 'quiz' | 'project' | 'review' | 'interview';
  refId: string;
  estMinutes: number;
  testOutConcepts?: string[]; // 診斷熟練度達標即可免修
}

interface Lesson {
  id: string; moduleId: string; title: string;
  workUseCase: string;        // 工作上用在哪裡
  bodyMd: string;             // 教學內容、操作步驟
  examples: CodeExample[];
  practiceIds: string[];      // 內嵌練習
  commonMistakes: string[];
  quizId: string;             // 單元小測
  concepts: string[];
}

type QuestionType =
  | 'single' | 'multi' | 'fill'
  | 'sql' | 'python' | 'formula' | 'dax'
  | 'analysis'                // 數值或結構化答案
  | 'case';                   // 商業情境（結構化 + 文字）

interface Question {
  id: string;
  type: QuestionType;
  difficulty: 1|2|3|4|5;
  concepts: string[];         // 1–3 個
  prompt: string;
  datasetId?: string;
  // 依題型的答案定義
  answer:
    | { kind: 'choice'; correct: string[] }
    | { kind: 'text'; accepted: string[]; caseSensitive?: boolean }
    | { kind: 'sql'; referenceSql: string; orderMatters: boolean;
        requireAliases?: boolean; mustUse?: string[]; tolerance?: number }
    | { kind: 'python'; checkCode: string; setupCode?: string }
    | { kind: 'formula'; sheetId: string; targetCell: string; expected: number|string }
    | { kind: 'dax'; expectedValue: number; tolerance: number; mustUse?: string[] }
    | { kind: 'numeric'; value: number; tolerance: number }
    | { kind: 'case'; structured: Record<string, unknown>; rubricId: string };
  hints: string[];            // 第二段提示（至少 1 則，不含程式碼）
  diagnosticRules?: DiagnosticRule[]; // 第一段「錯在哪」的題目專屬規則
  solution: string;
  explanation: string;        // 為什麼這樣寫
  commonMistakes: string[];
  variantOf?: string;         // 變形題指向母題
  timeLimitSec?: number;
}

interface Scenario {          // 產業模擬
  id: string; industry: 'ecommerce'|'finance'|'retail'|'marketing'|'manufacturing'|'logistics';
  level: 'junior' | 'advanced';
  company: { name: string; background: string; yourRole: string };
  managerBrief: string;       // 主管原話
  clarifyingQA: { question: string; answer: string; isKey: boolean }[];
  datasetIds: string[];
  steps: ScenarioStep[];      // 每步有可驗證檢查點（引用 Question）
  deliverables: string[];
  rubricId: string;
  groundTruth: Record<string, unknown>; // 埋入的真相，不顯示給使用者
}

interface Rubric {
  id: string;
  criteria: {
    id: string; name: string;       // '商業洞察'
    weight: number;                 // 權重（合計 100）
    levels: { score: number; descriptor: string }[]; // 0/1/2/3/4 等級的具體描述
    minToPass?: number;
  }[];
}

interface Dataset {
  id: string; title: string;
  tables: { name: string; csvPath: string; columns: { name: string; type: string; desc: string }[] }[];
  relationships: { from: string; to: string }[];
  seed: number;
  knownIssues: string[];      // 刻意埋入的髒資料（教學用說明，作答後才顯示）
}
```

---

## 二、使用者資料（IndexedDB / Dexie）

### 資料表總覽

| Store | 主鍵 | 索引 | 用途 |
|---|---|---|---|
| `profile` | `id`（固定 `'me'`） | — | 基本設定、起始日、目標職缺 |
| `diagnostics` | `++id` | `takenAt` | 能力診斷結果（可重測） |
| `planDays` | `dayIndex` | `date`, `status` | 個人化 180 天計畫（實例化後的每日任務） |
| `lessonProgress` | `lessonId` | `status` | 課程閱讀進度（不計分） |
| `attempts` | `++id` | `questionId`, `*concepts`, `context`, `createdAt` | **每一次作答**，熟練度的唯一證據來源 |
| `quizSessions` | `id` | `quizId`, `mode`, `endedAt` | 測驗／模擬考場次 |
| `mistakes` | `questionId` | `nextReviewAt`, `resolved` | 錯題本（Leitner 間隔複習） |
| `conceptMastery` | `conceptId` | `domain`, `status` | 概念熟練度（由 attempts 計算後快取） |
| `remediations` | `id` | `conceptId`, `status` | 弱點補強任務 |
| `projectSubmissions` | `id` | `scenarioId`, `status` | 產業專案提交（含版本） |
| `portfolioItems` | `id` | `order` | 作品集 |
| `interviewSessions` | `id` | `type`, `createdAt` | 面試模擬紀錄 |
| `tutorMessages` | `++id` | `threadId`, `createdAt` | AI 導師對話與 token 用量 |
| `skillSnapshots` | `weekIndex` | — | 每週能力分數快照（成長曲線） |
| `files` | `id` | `ownerId` | 附件（截圖、報告）Blob |
| `settings` | `key` | — | 主題、AI 設定、預算等 |
| `meta` | `key` | — | `schemaVersion`、`contentVersion`、最後備份時間 |

### Dexie schema（第 2 階段直接使用）

```ts
db.version(1).stores({
  profile:            'id',
  diagnostics:        '++id, takenAt',
  planDays:           'dayIndex, date, status',
  lessonProgress:     'lessonId, status',
  attempts:           '++id, questionId, *concepts, context, createdAt',
  quizSessions:       'id, quizId, mode, endedAt',
  mistakes:           'questionId, nextReviewAt, resolved',
  conceptMastery:     'conceptId, domain, status',
  remediations:       'id, conceptId, status',
  projectSubmissions: 'id, scenarioId, status',
  portfolioItems:     'id, order',
  interviewSessions:  'id, type, createdAt',
  tutorMessages:      '++id, threadId, createdAt',
  skillSnapshots:     'weekIndex',
  files:              'id, ownerId',
  settings:           'key',
  meta:               'key',
});
```

### 主要欄位

```ts
interface Profile {
  id: 'me';
  displayName: string;
  startDate: string;              // ISO 日期，第 1 天
  dailyMinutes: number;           // 預設 120
  studyDays: number[];            // 0–6，一週哪幾天學習
  targetRole: string;             // '電商數據分析師' 等
  targetIndustries: string[];
  selfReport: Record<string, boolean>; // 診斷用自我回報
  createdAt: string;
}

interface PlanDay {
  dayIndex: number;               // 1..N（可因補強／重排 > 180）
  date: string;
  phaseId: string;
  tasks: {
    taskId: string;               // 唯一
    type: TaskTemplate['type'] | 'remediation';
    refId: string;
    estMinutes: number;
    status: 'todo' | 'done' | 'skipped' | 'tested_out';
    completedAt?: string;
  }[];
  status: 'upcoming' | 'today' | 'done' | 'partial' | 'missed';
  note?: string;                  // '因 JOIN 補強順延'
}

interface Attempt {
  id?: number;
  questionId: string;
  questionType: QuestionType;
  concepts: string[];
  difficulty: number;
  context: 'lesson' | 'practice' | 'quiz' | 'exam' | 'diagnostic' | 'remediation' | 'review' | 'project' | 'interview';
  sessionId?: string;             // 屬於哪次測驗／專案
  answer: unknown;                // 選項、文字或程式碼
  correct: boolean;
  scoreRatio: number;             // 0–1（部分給分）
  hintLevel: 0 | 1 | 2 | 3;       // 3 = 看了完整答案
  errorCategory?: 'concept' | 'syntax' | 'careless' | 'timeout';
  diagnostics?: string[];         // 批改器的診斷訊息
  durationSec: number;
  createdAt: string;
}

interface QuizSession {
  id: string; quizId: string;
  mode: 'unit' | 'phase' | 'weakness' | 'mistakes' | 'mock_exam' | 'diagnostic';
  questionIds: string[];
  startedAt: string; endedAt?: string;
  timeLimitSec?: number;
  score?: number;                 // 0–100
  grade?: string;                 // 能力評級
  recommendedLessonIds?: string[];
  status: 'in_progress' | 'submitted' | 'expired';
}

interface Mistake {
  questionId: string;
  concepts: string[];
  wrongCount: number;
  firstWrongAt: string; lastWrongAt: string;
  box: 1 | 2 | 3 | 4 | 5;         // Leitner 盒：1/3/7/21/60 天
  nextReviewAt: string;
  resolved: boolean;              // 連續答對到第 5 盒後設為 true
}

interface ConceptMastery {
  conceptId: string;
  domain: Domain;
  mastery: number;                // 0–1，計算方式見 04
  evidenceCount: number;
  consecutiveWrong: number;
  recentResults: number[];        // 最近 5 次 scoreRatio
  status: 'unknown' | 'learning' | 'ok' | 'weak' | 'remediating';
  updatedAt: string;
}

interface Remediation {
  id: string;
  conceptId: string;
  trigger: 'consecutive_wrong' | 'low_recent_accuracy' | 'low_mastery';
  triggeredAt: string;
  lessonId: string;
  questionIds: string[];
  gateLessonIds: string[];        // 被鎖住的下一章
  skipCount: number;              // 最多 2
  status: 'pending' | 'in_progress' | 'passed' | 'skipped';
  passedAt?: string;
}

interface ProjectSubmission {
  id: string; scenarioId: string; version: number;
  askedQuestions: number[];       // 追問主管的題目索引
  stepResults: { stepId: string; attemptId: number; passed: boolean }[];
  report: {
    background: string; problem: string; data: string; cleaning: string;
    method: string; tools: string[]; results: string; insights: string;
    actions: string; showcase: string;
  };
  fileIds: string[];
  rubricScores: { criterionId: string; score: number; source: 'auto' | 'self' | 'ai'; comment: string }[];
  totalScore?: number;
  status: 'draft' | 'submitted' | 'needs_revision' | 'closed';
  createdAt: string; updatedAt: string;
}

interface Settings {               // 以 key/value 儲存
  theme: 'system' | 'light' | 'dark';
  aiProvider: 'none' | 'anthropic';
  aiApiKey?: string;               // 只存在本機；備份匯出時預設排除
  aiModel?: string;
  aiMonthlyBudgetUsd?: number;
}
```

### 資料流（以一次 SQL 提交為例）

```
使用者按「提交批改」
  → SQL 批改器（PGlite）產生 {correct, scoreRatio, diagnostics}
  → 依作答次數決定提示等級（A1）
  → 寫入 attempts
  → 更新 conceptMastery（每個概念）
  → 若錯：寫入／更新 mistakes
  → 弱點偵測：符合條件 → 建立 remediations + 修改 planDays + 設定章節閘門
  → 若是今日任務：更新 planDays.tasks.status
  → 儀表板即時刷新（Dexie liveQuery）
```

以上步驟包在**同一個 Dexie transaction**，避免中途關閉頁面造成資料不一致。

### 版本遷移與備份

- `meta.schemaVersion` 每次結構變更 +1，以 Dexie `version(n).upgrade()` 搬移舊資料。
- 匯出格式：`{ app: 'da180', schemaVersion, exportedAt, stores: {...}, files: [{id, mime, base64}] }`。
- 匯入流程：驗證格式 → 顯示摘要（作答筆數、專案數、最後活動日）→ 確認 → 先自動匯出一份目前資料 → 覆寫。
- 熟練度與能力分數可隨時由 `attempts` + `projectSubmissions` **完整重算**，因此即使快取表損壞也能恢復。

## 三、雲端同步資料表（Supabase）

結構見 [`supabase/schema.sql`](../supabase/schema.sql)。採用一張通用資料表存放所有需同步的紀錄：

| 欄位 | 說明 |
|---|---|
| `user_id` | 帳號（列層級安全性：只能讀寫自己的資料） |
| `store` | 本機資料表名稱（attempts、planDays…） |
| `key` | 同步鍵：作答與診斷使用 `uid`（各裝置唯一），其他使用主鍵 |
| `data` | 整筆紀錄（JSON） |
| `updated_at` | 裝置上最後修改時間；伺服器拒絕用較舊的資料覆寫較新的資料 |
| `server_updated_at` | 伺服器寫入時間，用於增量下載 |

本機第 2 版 schema 為同步資料表加上 `_updatedAt`（由資料庫 hook 自動維護）與 `uid`。同步流程：先下載 `server_updated_at` 之後的資料並合併（每筆取較新者；每日任務逐項合併），再上傳本機上次同步後修改過的資料。熟練度不同步，由作答紀錄在各裝置重算。
