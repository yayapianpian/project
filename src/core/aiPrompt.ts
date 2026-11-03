import type { ObjectiveQuestion } from '../types/content';

// 「複製給 AI」：產生一段完整的提示文字，貼到使用者自己的 Claude / ChatGPT 對話中使用。
// 不呼叫任何 API，不產生額外費用。

export const LEARNER_BACKGROUND = [
  '我正在進行 180 天數據分析師轉職訓練，目標是應徵初階數據分析師。',
  '我的背景：用過 Power BI；做過電商 RFM 會員分群；了解基本資料清理與視覺化；',
  'Python 是初學者（正在學基礎語法與 Pandas）；SQL 正在從基礎系統性學習；',
  '使用 Windows，試算表用 Google 試算表或 LibreOffice Calc（沒有付費 Excel）。',
].join('');

export const GUIDED_RULES = [
  '請扮演我的資深數據分析導師，並遵守以下規則：',
  '1. 不要直接給答案。先問我怎麼想，或請我先嘗試。',
  '2. 我答錯時：第一次只指出錯在哪裡；第二次給解題方向的提示（不給完整程式碼）；第三次才給完整答案與逐步解析。',
  '3. 只有在我明確說「請直接給答案」時，才可以直接公布答案。',
  '4. 盡量用企業實際工作的情境舉例，並說明「為什麼」要這樣做。',
  '5. 每次回覆不要太長，結尾留一個問題讓我回答。',
].join('\n');

export function buildTopicPrompt(opts: {
  phaseTitle: string;
  moduleTitle: string;
  topic: string;
  domainLabel?: string;
  domainGrade?: string | null;
}): string {
  const level = opts.domainLabel
    ? `我目前「${opts.domainLabel}」的能力評估為：${opts.domainGrade ?? '證據不足（尚未測驗）'}。`
    : '';
  return [
    GUIDED_RULES,
    '',
    `【我的背景】${LEARNER_BACKGROUND}${level}`,
    '',
    `【今天的學習主題】${opts.phaseTitle} › ${opts.moduleTitle} › ${opts.topic}`,
    '',
    '請依照以下順序帶我學習：',
    '1. 用一個企業實際工作的情境，說明這個主題用在哪裡。',
    '2. 由淺入深講解重點，附上操作步驟或範例（SQL 請用 PostgreSQL 語法；試算表請用 Google 試算表）。',
    '3. 列出 2–3 個初學者常見錯誤。',
    '4. 出 3 題由易到難的練習題，一次只出一題，等我作答後再依上面的規則回應。',
  ].join('\n');
}

export function buildQuestionReviewPrompt(opts: {
  question: ObjectiveQuestion;
  myAnswerText: string;
  correctAnswerText: string;
  wasCorrect: boolean;
}): string {
  const q = opts.question;
  const options = q.options?.map((o) => `(${o.id}) ${o.text}`).join('\n') ?? '';
  return [
    GUIDED_RULES,
    '',
    `【我的背景】${LEARNER_BACKGROUND}`,
    '',
    '【我剛在能力診斷中作答的題目】',
    q.prompt,
    q.code ? `\n${q.code}\n` : '',
    options,
    '',
    `我的答案：${opts.myAnswerText || '（未作答）'}`,
    `正確答案：${opts.correctAnswerText}`,
    `平台提供的解析：${q.explanation}`,
    '',
    opts.wasCorrect
      ? '我答對了，但想確認自己是真的懂。請問我 1–2 個追問，檢查我是否理解背後的原理，再出一題同概念的變形題（不要附答案）。'
      : '我答錯了。請先問我當初為什麼選這個答案，幫我找出觀念上的誤解，再出一題同概念的變形題讓我練習（不要附答案）。',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

export function buildBusinessPrompt(question: string): string {
  return [
    '請扮演一位企業的營運主管，我是你團隊中剛到職的初階數據分析師。',
    `【我的背景】${LEARNER_BACKGROUND}`,
    '',
    `【主管的問題】${question.replace(/^每週商業思維：/, '')}`,
    '',
    '規則：',
    '1. 請先不要給答案，讓我先回答。',
    '2. 我回答後，依「分析邏輯、商業洞察、建議可行性」三項各給 1–5 分，並具體說明哪裡可以更好。',
    '3. 像真正的主管一樣追問我 1–2 個問題（例如資料從哪裡來、怎麼驗證）。',
    '4. 最後再提供一個你認為優秀的回答範例。',
  ].join('\n');
}
