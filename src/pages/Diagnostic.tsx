import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Play, RotateCcw, XCircle } from 'lucide-react';
import { db } from '../db/db';
import { answerDiagnostic, finishDiagnostic, sessionAttempts, startDiagnostic } from '../db/repo';
import { useProfile } from '../hooks/data';
import { DIAGNOSTIC_BY_ID } from '../content/diagnosticQuestions';
import { diagnosticState, DIAGNOSTIC_DOMAINS, QUESTIONS_PER_DOMAIN } from '../core/diagnostic';
import { gradeObjective } from '../core/grading';
import { gradeLabel } from '../core/scoring';
import { allocateModuleDays } from '../core/planner';
import { buildQuestionReviewPrompt } from '../core/aiPrompt';
import { DOMAIN_LABEL, type ObjectiveQuestion } from '../types/content';
import type { Attempt, DiagnosticResult } from '../types/user';
import { Badge, Loading, PageHeader, ProgressBar } from '../components/ui';
import { CopyToAIButton } from '../components/CopyToAI';

function answerText(q: ObjectiveQuestion, ids: string[]): string {
  if (q.type === 'fill') return ids[0] ?? '';
  return ids.map((id) => `(${id}) ${q.options?.find((o) => o.id === id)?.text ?? ''}`).join('；');
}

export function CodeBlock({ code }: { code: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed sm:text-sm">{code}</pre>;
}

function QuestionView({ q, onSubmit }: { q: ObjectiveQuestion; onSubmit: (answer: string[], durationSec: number) => Promise<void> }) {
  const [answer, setAnswer] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const startRef = useRef(Date.now());

  const ready = q.type === 'fill' ? (answer[0] ?? '').trim() !== '' : answer.length > 0;
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    await onSubmit(answer, Math.round((Date.now() - startRef.current) / 1000));
  };

  return (
    <form onSubmit={submit}>
      <div className="mb-1 flex flex-wrap gap-1.5">
        <Badge tone="muted">{q.type === 'single' ? '單選' : q.type === 'multi' ? '多選（選出所有正確選項）' : '填空'}</Badge>
        <Badge tone="muted">難度 {q.difficulty}</Badge>
      </div>
      <p className="mt-2 text-base leading-relaxed">{q.prompt}</p>
      {q.code && <CodeBlock code={q.code} />}
      {q.type === 'fill' ? (
        <input className="input mt-4 max-w-xs" autoFocus value={answer[0] ?? ''} onChange={(e) => setAnswer([e.target.value])} placeholder="輸入答案" aria-label="答案" />
      ) : (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">選項</legend>
          {q.options!.map((o) => {
            const checked = answer.includes(o.id);
            return (
              <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${checked ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={q.id}
                  className="mt-0.5"
                  checked={checked}
                  onChange={() =>
                    setAnswer(q.type === 'single' ? [o.id] : checked ? answer.filter((x) => x !== o.id) : [...answer, o.id])
                  }
                />
                <span className="min-w-0 break-words"><span className="mr-1 font-medium">({o.id})</span>{o.text}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button className="btn btn-primary" disabled={!ready || busy}>{busy ? '儲存中…' : '送出，下一題'}</button>
        <span className="text-xs text-muted">送出後無法修改；診斷中不顯示對錯</span>
      </div>
    </form>
  );
}

function Running({ sessionId }: { sessionId: string }) {
  const profile = useProfile();
  const attempts = useLiveQuery(() => sessionAttempts(sessionId), [sessionId]);
  const [finishing, setFinishing] = useState(false);
  const state = useMemo(
    () => (attempts && profile ? diagnosticState(attempts.map((a) => ({ questionId: a.questionId, correct: a.correct })), profile.selfReport) : null),
    [attempts, profile],
  );

  useEffect(() => {
    if (state?.done && !finishing) {
      setFinishing(true);
      finishDiagnostic(sessionId);
    }
  }, [state, finishing, sessionId]);

  if (!state || !profile) return <Loading />;
  if (state.done) return <div className="card text-sm">正在計算結果並產生你的 180 天計畫…</div>;
  const q = state.next!;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="能力診斷"
        subtitle={`第 ${state.domainIndex + 1} / ${DIAGNOSTIC_DOMAINS.length} 區：${DOMAIN_LABEL[state.domain!]} · 本區第 ${state.questionInDomain + 1} / ${QUESTIONS_PER_DOMAIN} 題`}
        actions={<Link to="/" className="btn btn-ghost">暫停，下次接續</Link>}
      />
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-muted"><span>整體進度</span><span>{state.answeredCount} / {state.totalCount}</span></div>
        <ProgressBar value={state.answeredCount} max={state.totalCount} label="診斷進度" />
      </div>
      <div className="card">
        <QuestionView
          key={q.id}
          q={q}
          onSubmit={async (answer, durationSec) => {
            const g = gradeObjective(q, answer);
            await answerDiagnostic(sessionId, {
              questionId: q.id, domain: q.domain, concepts: q.concepts, difficulty: q.difficulty,
              answer, correct: g.correct, scoreRatio: g.scoreRatio, hintLevel: 0, durationSec, createdAt: new Date().toISOString(),
            });
          }}
        />
      </div>
    </div>
  );
}

function Result({ result, onRetake }: { result: DiagnosticResult; onRetake: () => void }) {
  const attempts = useLiveQuery(() => sessionAttempts(result.sessionId), [result.sessionId]);
  const [filter, setFilter] = useState<'all' | 'wrong'>('wrong');
  const navigate = useNavigate();
  const changes = useMemo(() => allocateModuleDays(result.domainMastery).filter((p) => p.adjust !== 'normal' && p.days !== p.module.baseDays), [result]);
  if (!attempts) return <Loading />;
  const shown = attempts.filter((a) => filter === 'all' || !a.correct);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="能力診斷結果"
        subtitle={`${new Date(result.takenAt).toLocaleString('zh-TW')} · 答對 ${result.totalCorrect} / ${result.totalQuestions} 題`}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/')}>前往今日任務</button>
            <button className="btn btn-ghost" onClick={onRetake}><RotateCcw size={16} />重新診斷</button>
          </>
        }
      />

      <section className="card mb-4" aria-labelledby="h-domains">
        <h2 id="h-domains" className="mb-3 text-sm font-semibold">各能力初步評估</h2>
        <div className="space-y-3">
          {DIAGNOSTIC_DOMAINS.map((d) => {
            const m = result.domainMastery[d];
            const s = m === undefined ? null : Math.round(m * 100);
            const capped = s !== null && s >= 75;
            return (
              <div key={d} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[100px_1fr_220px]">
                <span className="font-medium">{DOMAIN_LABEL[d]}</span>
                <ProgressBar value={s ?? 0} tone={s === null ? 'accent' : s < 40 ? 'bad' : s < 60 ? 'warn' : 'good'} label={`${DOMAIN_LABEL[d]} 分數`} />
                <span className="text-right text-xs text-muted sm:text-sm">
                  <span className="font-semibold tabular-nums text-ink">{s ?? '—'}</span>{' '}
                  <span className="hidden sm:inline">{s === null ? '' : capped ? '具備基礎實作能力（上限）' : gradeLabel(s)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">
          診斷只是起點，不是最終分數。依評分制度，要顯示「具備獨立分析能力（75 分以上）」必須有限時測驗或專案作品證據，所以目前最高顯示到「具備基礎實作能力」。「專案表達」無法用選擇題診斷，會在專案與面試中評估。
        </p>
      </section>

      <section className="card mb-4" aria-labelledby="h-plan">
        <h2 id="h-plan" className="mb-2 text-sm font-semibold">你的 180 天計畫怎麼調整</h2>
        {changes.length === 0 ? (
          <p className="text-sm text-muted">各項能力都在中等範圍，維持標準計畫。</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {changes.map((p) => (
              <li key={p.module.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{p.module.title}</span>
                <Badge tone={p.days < p.module.baseDays ? 'good' : 'warn'}>{p.module.baseDays} → {p.days} 天</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">較強的能力壓縮為「快速複習＋免修測驗」，省下的天數分配給較弱的能力。總天數維持 180 天。</p>
      </section>

      <section className="card" aria-labelledby="h-review">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="h-review" className="text-sm font-semibold">逐題解析</h2>
          <div className="flex gap-1" role="group" aria-label="篩選題目">
            <button className={`btn !py-1 text-xs ${filter === 'wrong' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('wrong')}>只看答錯（{attempts.filter((a) => !a.correct).length}）</button>
            <button className={`btn !py-1 text-xs ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>全部（{attempts.length}）</button>
          </div>
        </div>
        {shown.length === 0 && <p className="text-sm text-muted">全部答對！</p>}
        <ol className="space-y-3">
          {shown.map((a: Attempt) => {
            const q = DIAGNOSTIC_BY_ID[a.questionId];
            if (!q) return null;
            const mine = answerText(q, a.answer);
            const right = answerText(q, q.correct);
            return (
              <li key={a.id} className="rounded-lg border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {a.correct ? <Badge tone="good"><CheckCircle2 size={12} className="mr-1" />答對</Badge> : <Badge tone="bad"><XCircle size={12} className="mr-1" />{a.scoreRatio > 0 ? `部分正確 ${Math.round(a.scoreRatio * 100)}%` : '答錯'}</Badge>}
                  <Badge tone="muted">{DOMAIN_LABEL[q.domain]}</Badge>
                  <Badge tone="muted">難度 {q.difficulty}</Badge>
                </div>
                <p className="text-sm leading-relaxed">{q.prompt}</p>
                {q.code && <CodeBlock code={q.code} />}
                <dl className="mt-3 grid gap-1 text-sm">
                  <div><dt className="inline text-muted">你的答案：</dt><dd className={`inline ${a.correct ? 'text-good' : 'text-bad'}`}>{mine || '（未作答）'}</dd></div>
                  {!a.correct && <div><dt className="inline text-muted">正確答案：</dt><dd className="inline text-good">{right}</dd></div>}
                </dl>
                <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm leading-relaxed"><span className="font-medium">解析：</span>{q.explanation}</p>
                <div className="mt-3">
                  <CopyToAIButton compact label={a.correct ? '請 AI 追問確認' : '請 AI 引導我理解'} build={() => buildQuestionReviewPrompt({ question: q, myAnswerText: mine, correctAnswerText: right, wasCorrect: a.correct })} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export function DiagnosticPage() {
  const profile = useProfile();
  const active = useLiveQuery(async () => (await db.quizSessions.where('status').equals('in_progress').filter((s) => s.mode === 'diagnostic').first()) ?? null, []);
  const latest = useLiveQuery(async () => (await db.diagnostics.orderBy('takenAt').last()) ?? null, []);
  const [retake, setRetake] = useState(false);
  const [starting, setStarting] = useState(false);

  if (profile === undefined || active === undefined || latest === undefined) return <Loading />;
  if (profile === null) {
    return (
      <div className="card mx-auto max-w-xl text-sm">
        請先完成基本設定。<Link to="/" className="ml-1 text-accent hover:underline">前往首頁設定</Link>
      </div>
    );
  }
  if (active) return <Running sessionId={active.id} />;
  if (latest && !retake) return <Result result={latest} onRetake={() => setRetake(true)} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={latest ? '重新進行能力診斷' : '能力診斷'} subtitle="約 30 題、40 分鐘。自適應出題，診斷中不顯示對錯，結束後有逐題解析。" />
      <div className="card">
        <ul className="mb-5 grid gap-2 text-sm sm:grid-cols-2">
          {DIAGNOSTIC_DOMAINS.map((d) => <li key={d} className="rounded-lg border border-line px-3 py-2">{DOMAIN_LABEL[d]} · {QUESTIONS_PER_DOMAIN} 題</li>)}
        </ul>
        {latest && <p className="mb-4 text-sm text-muted">重新診斷後會依新結果重新產生計畫，已完成的任務會保留。新的作答也會計入熟練度，舊的作答會隨時間降低權重。</p>}
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await startDiagnostic();
              setStarting(false);
              setRetake(false);
            }}
          >
            <Play size={16} />開始
          </button>
          {latest && <button className="btn btn-ghost" onClick={() => setRetake(false)}>返回上次結果</button>}
        </div>
      </div>
    </div>
  );
}
