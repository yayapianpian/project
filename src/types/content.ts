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
