import { useRef, useState } from 'react';
import { CheckCircle2, Eye, Lightbulb, Search, XCircle } from 'lucide-react';
import type { LessonQuestion } from '../types/content';
import { gradeObjective } from '../core/grading';
import { buildQuestionReviewPrompt } from '../core/aiPrompt';
import { CopyToAIButton } from './CopyToAI';
import { Badge, Modal } from './ui';
import { CodeBlock } from '../pages/Diagnostic';

export function answerLabel(q: LessonQuestion, ids: string[]): string {
  if (q.type === 'fill') return ids[0] ?? '';
  return ids.map((id) => `(${id}) ${q.options?.find((o) => o.id === id)?.text ?? ''}`).join('；');
}

/** 作答區（單選、多選、填空），練習與小測共用 */
export function AnswerInput({ q, value, onChange, disabled }: { q: LessonQuestion; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  if (q.type === 'fill') {
    return (
      <input
        className="input mt-3 max-w-xs"
        value={value[0] ?? ''}
        disabled={disabled}
        inputMode={/^-?[\d.]+$/.test(q.correct[0]) ? 'decimal' : 'text'}
        onChange={(e) => onChange([e.target.value])}
        placeholder="輸入答案"
        aria-label="答案"
      />
    );
  }
  return (
    <fieldset className="mt-3 space-y-2" disabled={disabled}>
      <legend className="sr-only">選項</legend>
      {q.options!.map((o) => {
        const checked = value.includes(o.id);
        return (
          <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${checked ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'} ${disabled ? 'cursor-default opacity-90' : ''}`}>
            <input
              type={q.type === 'single' ? 'radio' : 'checkbox'}
              name={q.id}
              className="mt-0.5"
              checked={checked}
              onChange={() => onChange(q.type === 'single' ? [o.id] : checked ? value.filter((x) => x !== o.id) : [...value, o.id])}
            />
            <span className="min-w-0 break-words"><span className="mr-1 font-medium">({o.id})</span>{o.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** 第一段：指出錯在哪 */
function whereWrong(q: LessonQuestion, answer: string[]): string {
  if (q.type === 'fill') return q.wrongHint ?? '答案不正確，請再檢查一次。';
  const wrongPick = answer.find((a) => !q.correct.includes(a));
  if (q.type === 'single') return (wrongPick && q.feedback?.[wrongPick]) || '這個選項不正確，再想想看。';
  const hit = answer.filter((a) => q.correct.includes(a)).length;
  const extra = answer.length - hit;
  const parts = [`你選對了 ${hit} / ${q.correct.length} 個正確選項`];
  if (extra > 0) parts.push(`另外多選了 ${extra} 個錯誤選項`);
  const fb = wrongPick && q.feedback?.[wrongPick];
  return parts.join('，') + '。' + (fb ? `\n例如 (${wrongPick})：${fb}` : '');
}

export interface PracticeResult {
  correct: boolean;
  hintLevel: 0 | 1 | 2 | 3;
  answer: string[];
  durationSec: number;
}

/**
 * 練習題：三段式引導
 * 第 1 次答錯 → 指出錯在哪；第 2 次答錯 → 解題提示；第 3 次答錯 → 完整答案與解析。
 */
export function PracticeQuestion({ q, index, onResolved, previous }: { q: LessonQuestion; index: number; onResolved: (r: PracticeResult) => void; previous?: { correct: boolean; hintLevel: number } }) {
  const [answer, setAnswer] = useState<string[]>([]);
  const [wrongTries, setWrongTries] = useState(0);
  const [stage1, setStage1] = useState<string | null>(null);
  const [state, setState] = useState<'open' | 'correct' | 'revealed'>(previous ? (previous.correct ? 'correct' : 'revealed') : 'open');
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<string[]>([]);
  const start = useRef(Date.now());

  const ready = q.type === 'fill' ? (answer[0] ?? '').trim() !== '' : answer.length > 0;
  const finish = (correct: boolean, hintLevel: 0 | 1 | 2 | 3, ans: string[]) => {
    setState(correct ? 'correct' : 'revealed');
    onResolved({ correct, hintLevel, answer: ans, durationSec: Math.round((Date.now() - start.current) / 1000) });
  };

  const submit = () => {
    if (!ready) return;
    setLastAnswer(answer);
    const g = gradeObjective(q, answer);
    if (g.correct) return finish(true, Math.min(wrongTries, 2) as 0 | 1 | 2, answer);
    const n = wrongTries + 1;
    setWrongTries(n);
    setStage1(whereWrong(q, answer));
    if (n >= 3) finish(false, 3, answer);
  };

  const resolved = state !== 'open';
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="muted">練習 {index + 1}</Badge>
        <Badge tone="muted">{q.type === 'single' ? '單選' : q.type === 'multi' ? '多選' : '填空'}</Badge>
        <Badge tone="muted">難度 {q.difficulty}</Badge>
        {state === 'correct' && <Badge tone="good"><CheckCircle2 size={12} className="mr-1" />{previous && wrongTries === 0 && !lastAnswer.length ? '已完成' : wrongTries === 0 ? '一次答對' : `第 ${wrongTries + 1} 次答對`}</Badge>}
        {state === 'revealed' && <Badge tone="warn">已看解答</Badge>}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed">{q.prompt}</p>
      {q.code && <CodeBlock code={q.code} />}
      <AnswerInput q={q} value={resolved ? (lastAnswer.length ? lastAnswer : q.correct) : answer} onChange={setAnswer} disabled={resolved} />

      {!resolved && (
        <>
          {wrongTries >= 1 && stage1 && (
            <div className="mt-3 flex gap-2 rounded-lg bg-bad-soft p-3 text-sm text-ink">
              <Search size={16} className="mt-0.5 shrink-0 text-bad" />
              <div className="whitespace-pre-line"><span className="font-medium text-bad">錯在哪：</span>{stage1}</div>
            </div>
          )}
          {wrongTries >= 2 && (
            <div className="mt-2 flex gap-2 rounded-lg bg-warn-soft p-3 text-sm text-ink">
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
              <div><span className="font-medium text-warn">提示：</span>{q.hint}</div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" disabled={!ready} onClick={submit}>{wrongTries === 0 ? '送出' : '再試一次'}</button>
            <button className="btn btn-ghost" onClick={() => setConfirmReveal(true)}><Eye size={16} />直接看答案</button>
            {wrongTries > 0 && <span className="text-xs text-muted">再答錯 {3 - wrongTries} 次會顯示完整解答</span>}
          </div>
        </>
      )}

      {resolved && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${state === 'correct' ? 'bg-good-soft' : 'bg-surface-2'}`}>
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            {state === 'correct' ? <CheckCircle2 size={16} className="text-good" /> : <XCircle size={16} className="text-warn" />}
            正確答案：{answerLabel(q, q.correct)}
          </div>
          <p className="leading-relaxed"><span className="font-medium">為什麼：</span>{q.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyToAIButton compact label="請 AI 換個方式解釋" build={() => buildQuestionReviewPrompt({ question: q, myAnswerText: answerLabel(q, lastAnswer), correctAnswerText: answerLabel(q, q.correct), wasCorrect: state === 'correct' })} />
            <button
              className="btn btn-ghost !px-2.5 !py-1 text-xs"
              onClick={() => {
                setAnswer([]);
                setLastAnswer([]);
                setWrongTries(0);
                setStage1(null);
                setState('open');
                start.current = Date.now();
              }}
            >
              再練一次
            </button>
          </div>
        </div>
      )}

      <Modal
        open={confirmReveal}
        onClose={() => setConfirmReveal(false)}
        title="直接看答案？"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmReveal(false)}>再想想</button>
            <button className="btn btn-primary" onClick={() => { setConfirmReveal(false); finish(false, 3, lastAnswer); }}>看答案</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">看答案後，這題的熟練度會計為 0，並在之後安排同概念的題目讓你複習。建議先看「提示」再試一次。</p>
      </Modal>
    </div>
  );
}
