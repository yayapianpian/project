import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Download, Wrench, AlertTriangle, ClipboardCheck, Briefcase, ListOrdered, Code2 } from 'lucide-react';
import { db } from '../db/db';
import { markLessonPracticed, markLessonRead, recordAttempt, submitLessonQuiz, type LessonProgressRow } from '../db/repo';
import { LESSON_BY_ID, nextLesson } from '../content/lessons';
import { MODULE_BY_ID, PHASES } from '../content/curriculum';
import { gradeObjective } from '../core/grading';
import { gradeLabel } from '../core/scoring';
import { buildTopicPrompt } from '../core/aiPrompt';
import { DOMAIN_LABEL, type Lesson, type LessonQuestion } from '../types/content';
import { Markdown } from '../components/Markdown';
import { AnswerInput, answerLabel, PracticeQuestion } from '../components/LessonQuestion';
import { CopyToAIButton } from '../components/CopyToAI';
import { Badge, PageHeader } from '../components/ui';

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20" aria-labelledby={`h-${id}`}>
      <h2 id={`h-${id}`} className="mb-3 flex items-center gap-2 text-base font-semibold"><Icon size={18} className="text-accent" />{title}</h2>
      {children}
    </section>
  );
}

function Practice({ lesson }: { lesson: Lesson }) {
  const prev = useLiveQuery(
    () => db.attempts.where('questionId').anyOf(lesson.practice.map((q) => q.id)).filter((a) => a.context === 'practice').toArray(),
    [lesson.id],
  );
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  if (!prev) return null;
  const prevBy = new Map(prev.map((a) => [a.questionId, a]));
  const doneCount = lesson.practice.filter((q) => resolved.has(q.id) || prevBy.has(q.id)).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">答錯時：第 1 次指出錯在哪、第 2 次給提示、第 3 次才顯示完整解答。用越少提示答對，熟練度越高。</p>
      {lesson.practice.map((q, i) => (
        <PracticeQuestion
          key={q.id}
          q={q}
          index={i}
          previous={prevBy.get(q.id)}
          onResolved={async (r) => {
            await recordAttempt({
              questionId: q.id, domain: q.domain, concepts: q.concepts, difficulty: q.difficulty, context: 'practice',
              answer: r.answer, correct: r.correct, scoreRatio: r.correct ? 1 : 0, hintLevel: r.hintLevel, durationSec: r.durationSec,
              createdAt: new Date().toISOString(),
            });
            const next = new Set(resolved).add(q.id);
            setResolved(next);
            if (lesson.practice.every((x) => next.has(x.id) || prevBy.has(x.id))) await markLessonPracticed(lesson.id);
          }}
        />
      ))}
      <p className="text-xs text-muted">已完成 {doneCount} / {lesson.practice.length} 題</p>
    </div>
  );
}

function Quiz({ lesson, progress }: { lesson: Lesson; progress?: LessonProgressRow }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ score: number; graded: { q: LessonQuestion; answer: string[]; correct: boolean; ratio: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(new Date().toISOString());
  const allAnswered = lesson.quiz.every((q) => (answers[q.id] ?? []).some((v) => v.trim() !== ''));

  const submit = async () => {
    setBusy(true);
    const graded = lesson.quiz.map((q) => {
      const answer = answers[q.id] ?? [];
      const g = gradeObjective(q, answer);
      return { q, answer, correct: g.correct, ratio: g.scoreRatio };
    });
    const now = new Date().toISOString();
    const { score } = await submitLessonQuiz(
      lesson.id,
      graded.map(({ q, answer, correct, ratio }) => ({
        questionId: q.id, domain: q.domain, concepts: q.concepts, difficulty: q.difficulty, answer, correct, scoreRatio: ratio, hintLevel: 0,
        durationSec: Math.round((Date.now() - Date.parse(startedAt.current)) / 1000 / lesson.quiz.length), createdAt: now,
      })),
      startedAt.current,
    );
    setResult({ score, graded });
    setBusy(false);
  };

  if (result) {
    const wrong = result.graded.filter((g) => !g.correct);
    return (
      <div className="space-y-3">
        <div className={`rounded-xl p-4 ${result.score >= 80 ? 'bg-good-soft' : 'bg-warn-soft'}`}>
          <div className="text-2xl font-semibold tabular-nums">{result.score} 分</div>
          <div className="text-sm">{gradeLabel(result.score)}　·　答對 {result.graded.filter((g) => g.correct).length} / {result.graded.length} 題　·　{result.score >= 80 ? '通過本單元' : '80 分以上算通過，建議複習後再試一次'}</div>
        </div>
        {result.graded.map(({ q, answer, correct, ratio }, i) => (
          <div key={q.id} className="rounded-xl border border-line p-4">
            <div className="mb-1 flex items-center gap-1.5">
              {correct ? <Badge tone="good">答對</Badge> : <Badge tone="bad">{ratio > 0 ? `部分正確 ${Math.round(ratio * 100)}%` : '答錯'}</Badge>}
              <span className="text-xs text-muted">第 {i + 1} 題</span>
            </div>
            <p className="whitespace-pre-line text-sm">{q.prompt}</p>
            <p className="mt-2 text-sm"><span className="text-muted">你的答案：</span><span className={correct ? 'text-good' : 'text-bad'}>{answerLabel(q, answer) || '（未作答）'}</span></p>
            {!correct && <p className="text-sm"><span className="text-muted">正確答案：</span><span className="text-good">{answerLabel(q, q.correct)}</span></p>}
            <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm leading-relaxed"><span className="font-medium">解析：</span>{q.explanation}</p>
          </div>
        ))}
        {wrong.length > 0 && (
          <div className="rounded-xl border border-line p-4 text-sm">
            <div className="mb-2 font-medium">建議複習</div>
            <p className="mb-3 text-muted">回到上方「教學內容」與「常見錯誤」重讀一次，或請 AI 針對答錯的觀念出變形題。</p>
            <CopyToAIButton build={() => buildTopicPrompt({ phaseTitle: '單元小測複習', moduleTitle: MODULE_BY_ID[lesson.moduleId].title, topic: `${lesson.title}（我答錯的題目：${wrong.map((w) => w.q.prompt.slice(0, 40)).join('／')}）`, domainLabel: DOMAIN_LABEL[MODULE_BY_ID[lesson.moduleId].domain] })} label="請 AI 出變形題" />
          </div>
        )}
        <button className="btn btn-ghost" onClick={() => { setResult(null); setAnswers({}); startedAt.current = new Date().toISOString(); }}>重新測驗</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {lesson.quiz.length} 題，不提供提示。成績會計入能力分數，80 分以上算通過。
        {progress?.bestQuizScore !== undefined && <>　最高分：<strong className="text-ink">{progress.bestQuizScore}</strong></>}
      </p>
      {lesson.quiz.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-line p-4">
          <div className="mb-1 flex flex-wrap gap-1.5"><Badge tone="muted">第 {i + 1} 題</Badge><Badge tone="muted">{q.type === 'single' ? '單選' : q.type === 'multi' ? '多選' : '填空'}</Badge></div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{q.prompt}</p>
          <AnswerInput q={q} value={answers[q.id] ?? []} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
        </div>
      ))}
      <button className="btn btn-primary" disabled={!allAnswered || busy} onClick={submit}>{busy ? '批改中…' : '交卷'}</button>
      {!allAnswered && <span className="ml-2 text-xs text-muted">全部作答後才能交卷</span>}
    </div>
  );
}

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const lesson = LESSON_BY_ID[lessonId];
  const progress = useLiveQuery(async () => (await db.lessonProgress.get(lessonId)) as LessonProgressRow | undefined, [lessonId]);
  const next = useMemo(() => (lesson ? nextLesson(lesson.id) : undefined), [lesson]);

  const location = useLocation();
  useEffect(() => {
    const target = location.hash.slice(1);
    if (target) setTimeout(() => document.getElementById(target)?.scrollIntoView(), 50);
    else window.scrollTo(0, 0);
  }, [lessonId, location.hash]);

  if (!lesson) {
    return <div className="card text-sm">找不到這個單元。<Link className="ml-1 text-accent hover:underline" to="/lessons">回到課程中心</Link></div>;
  }
  const m = MODULE_BY_ID[lesson.moduleId];
  const phase = PHASES.find((p) => p.id === m.phase)!;
  const nav = [['use', '工作情境'], ['body', '教學內容'], ['steps', '操作步驟'], ['examples', '範例'], ['practice', '練習題'], ['mistakes', '常見錯誤'], ['quiz', '單元小測']].filter(([id]) => id !== 'examples' || lesson.examples.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/lessons" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} />課程中心</Link>
      <PageHeader
        title={lesson.title}
        subtitle={<>第 {phase.id} 個月 · {m.title} · 第 {lesson.topicIndex + 1} / {m.topics.length} 單元</>}
        actions={
          <>
            {progress?.status === 'passed' ? <Badge tone="good">已通過 {progress.bestQuizScore} 分</Badge> : progress ? <Badge tone="accent">已讀</Badge> : null}
          </>
        }
      />
      <nav className="sticky top-14 z-20 -mx-4 mb-4 flex gap-1.5 overflow-x-auto border-b border-line bg-bg/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border" aria-label="單元目錄">
        {nav.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:text-ink">{label}</a>
        ))}
      </nav>

      <div className="space-y-4">
        <Section id="use" icon={Briefcase} title="工作上用在哪裡">
          <p className="text-sm leading-relaxed">{lesson.workUseCase}</p>
        </Section>

        <Section id="body" icon={BookOpen} title="教學內容">
          <Markdown source={lesson.body} />
          {lesson.datasets && lesson.datasets.length > 0 && (
            <div className="mt-4 rounded-lg bg-surface-2 p-3">
              <div className="mb-2 text-sm font-medium">本單元資料</div>
              <div className="flex flex-wrap gap-2">
                {lesson.datasets.map((d) => (
                  <a key={d.file} className="btn btn-ghost !py-1.5 text-xs" href={d.file} download>
                    <Download size={14} />{d.title}
                  </a>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">電腦：下載後到 Google 試算表「檔案 → 匯入」，或用 LibreOffice Calc 開啟。手機：可用 Google 試算表 App 開啟，但操作較不方便，建議用電腦做練習、手機複習。</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!progress && <button className="btn btn-primary" onClick={() => markLessonRead(lesson.id)}><CheckCircle2 size={16} />我讀完了</button>}
            <CopyToAIButton label="請 AI 再解釋一次" build={() => buildTopicPrompt({ phaseTitle: phase.title, moduleTitle: m.title, topic: lesson.title, domainLabel: DOMAIN_LABEL[m.domain] })} />
          </div>
          {progress && <p className="mt-2 text-xs text-muted">已標記為讀完（只記錄進度，不加能力分數）。</p>}
        </Section>

        <Section id="steps" icon={ListOrdered} title="操作步驟">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{lesson.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </Section>

        {lesson.examples.length > 0 && (
          <Section id="examples" icon={Code2} title="範例">
            {lesson.examples.map((e) => (
              <div key={e.title} className="mb-3 last:mb-0">
                <div className="text-sm font-medium">{e.title}</div>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed sm:text-sm">{e.code}</pre>
                {e.result && <p className="mt-1.5 text-sm text-muted">→ {e.result}</p>}
              </div>
            ))}
          </Section>
        )}

        <Section id="practice" icon={Wrench} title="練習題">
          <Practice lesson={lesson} />
        </Section>

        <Section id="mistakes" icon={AlertTriangle} title="常見錯誤">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">{lesson.commonMistakes.map((s) => <li key={s}>{s}</li>)}</ul>
        </Section>

        <Section id="quiz" icon={ClipboardCheck} title="單元小測">
          <Quiz key={lesson.id} lesson={lesson} progress={progress} />
        </Section>

        {next && (
          <Link to={`/lessons/${next.id}`} className="card flex items-center justify-between gap-3 hover:bg-surface-2">
            <div>
              <div className="text-xs text-muted">下一個單元</div>
              <div className="text-sm font-medium">{next.title}</div>
            </div>
            <ArrowRight size={18} />
          </Link>
        )}
      </div>
    </div>
  );
}
