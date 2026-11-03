// 內容資料型別（唯讀，隨程式打包）

export type Domain = 'data' | 'sql' | 'python' | 'powerbi' | 'business' | 'communication';

export const DOMAINS: Domain[] = ['data', 'sql', 'python', 'powerbi', 'business', 'communication'];

export const DOMAIN_LABEL: Record<Domain, string> = {
  data: '資料處理',
  sql: 'SQL',
  python: 'Python',
  powerbi: 'Power BI',
  business: '商業分析',
  communication: '專案表達',
};

/** 100 分制中各能力的滿分 */
export const DOMAIN_MAX: Record<Domain, number> = {
  data: 20,
  sql: 20,
  python: 15,
  powerbi: 15,
  business: 20,
  communication: 10,
};

export interface Concept {
  id: string;
  domain: Domain;
  name: string;
  /** 1–3，反映企業筆試與實務使用頻率 */
  importance: 1 | 2 | 3;
}

export interface ChoiceOption {
  id: string;
  text: string;
}

export type ObjectiveType = 'single' | 'multi' | 'fill';

/** 客觀題（單選、多選、填空）。第 4 階段會再加入 SQL / Python 等實作題型。 */
export interface ObjectiveQuestion {
  id: string;
  domain: Domain;
  type: ObjectiveType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  concepts: string[];
  prompt: string;
  /** 題目附帶的程式碼或資料片段 */
  code?: string;
  codeLang?: 'sql' | 'python' | 'dax' | 'text';
  options?: ChoiceOption[];
  /** 單選／多選：正確選項 id；填空：可接受的答案 */
  correct: string[];
  explanation: string;
}

export type ModuleKind = 'learn' | 'project' | 'job';

export interface CurriculumModule {
  id: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  domain: Domain;
  kind: ModuleKind;
  baseDays: number;
  /** 每天的學習主題，天數多於主題時以「綜合練習」補足 */
  topics: string[];
  concepts: string[];
}

export interface Phase {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  practice: string;
}

/** 課程中的練習題與小測題：多了三段式引導需要的內容 */
export interface LessonQuestion extends ObjectiveQuestion {
  /** 第二段：解題方向提示（不含答案） */
  hint: string;
  /** 第一段（選擇題）：選了某個錯誤選項時，指出錯在哪 */
  feedback?: Record<string, string>;
  /** 第一段（填空題）：答錯時指出錯在哪 */
  wrongHint?: string;
}

export interface LessonExample {
  title: string;
  code: string;
  lang: 'sql' | 'python' | 'formula' | 'text';
  /** 執行結果或說明 */
  result?: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  /** 對應模組 topics 的索引 */
  topicIndex: number;
  title: string;
  /** 這個技能在工作上用在哪裡 */
  workUseCase: string;
  /** 教學內容（簡易 Markdown：## 標題、- 清單、1. 清單、```程式碼```、| 表格 |、**粗體**、`程式碼`） */
  body: string;
  steps: string[];
  examples: LessonExample[];
  practice: LessonQuestion[];
  commonMistakes: string[];
  quiz: LessonQuestion[];
  /** 需要下載的資料集 */
  datasets?: { title: string; file: string }[];
}
