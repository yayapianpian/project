import Dexie, { type Table, type Transaction } from 'dexie';
import { notifyLocalChange } from '../sync/signal';
import type {
  Attempt,
  ConceptMastery,
  DiagnosticResult,
  MetaRow,
  PlanDay,
  Profile,
  QuizSession,
  SettingRow,
  SkillSnapshot,
} from '../types/user';

export const SCHEMA_VERSION = 2;

/** 需要跨裝置同步的資料表；uid 表示用 uid 欄位當同步鍵（本機 id 為自動編號，各裝置會重複） */
export const SYNC_STORES: { name: string; uidKey?: true }[] = [
  { name: 'profile' },
  { name: 'diagnostics', uidKey: true },
  { name: 'planDays' },
  { name: 'lessonProgress' },
  { name: 'attempts', uidKey: true },
  { name: 'quizSessions' },
  { name: 'mistakes' },
  { name: 'remediations' },
  { name: 'projectSubmissions' },
  { name: 'portfolioItems' },
  { name: 'interviewSessions' },
  { name: 'skillSnapshots' },
  { name: 'settings' },
];

/** 只存在這台裝置、不同步的設定 */
export const LOCAL_ONLY_SETTING_KEYS = new Set(['aiApiKey', 'sync.url', 'sync.key']);

const UID_STORES = new Set(SYNC_STORES.filter((s) => s.uidKey).map((s) => s.name));

export function newUid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** 由同步引擎寫入時標記，避免被當成本機修改又上傳一次 */
export function markFromSync(tx: Transaction) {
  (tx as unknown as { __fromSync?: boolean }).__fromSync = true;
}
function isFromSync(tx: Transaction | undefined) {
  return !!(tx as unknown as { __fromSync?: boolean } | undefined)?.__fromSync;
}

// 尚未在第 2 階段使用的資料表（錯題、補強、專案…）先宣告結構，避免日後遷移
type Row = Record<string, unknown>;

export class DA180DB extends Dexie {
  profile!: Table<Profile, string>;
  diagnostics!: Table<DiagnosticResult, number>;
  planDays!: Table<PlanDay, number>;
  lessonProgress!: Table<Row, string>;
  attempts!: Table<Attempt, number>;
  quizSessions!: Table<QuizSession, string>;
  mistakes!: Table<Row, string>;
  conceptMastery!: Table<ConceptMastery, string>;
  remediations!: Table<Row, string>;
  projectSubmissions!: Table<Row, string>;
  portfolioItems!: Table<Row, string>;
  interviewSessions!: Table<Row, string>;
  tutorMessages!: Table<Row, number>;
  skillSnapshots!: Table<SkillSnapshot, number>;
  files!: Table<Row, string>;
  settings!: Table<SettingRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'da180') {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      profile: 'id',
      diagnostics: '++id, takenAt, sessionId',
      planDays: 'dayIndex, date',
      lessonProgress: 'lessonId, status',
      attempts: '++id, questionId, *concepts, context, sessionId, createdAt',
      quizSessions: 'id, quizId, mode, status, endedAt',
      mistakes: 'questionId, nextReviewAt, resolved',
      conceptMastery: 'conceptId, domain, status',
      remediations: 'id, conceptId, status',
      projectSubmissions: 'id, scenarioId, status',
      portfolioItems: 'id, order',
      interviewSessions: 'id, type, createdAt',
      tutorMessages: '++id, threadId, createdAt',
      skillSnapshots: 'weekIndex',
      files: 'id, ownerId',
      settings: 'key',
      meta: 'key',
    });

    // 第 2 版：加入跨裝置同步需要的 uid 與修改時間
    this.version(2)
      .stores({
        attempts: '++id, &uid, questionId, *concepts, context, sessionId, createdAt',
        diagnostics: '++id, &uid, takenAt, sessionId',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        for (const { name, uidKey } of SYNC_STORES) {
          await tx.table(name).toCollection().modify((row: Record<string, unknown>) => {
            if (uidKey && !row.uid) row.uid = newUid();
            if (!row._updatedAt) row._updatedAt = now;
          });
        }
      });

    // 自動記錄每筆同步資料的修改時間
    for (const { name } of SYNC_STORES) {
      const table = this.table(name);
      table.hook('creating', function (_pk, obj: Record<string, unknown>, tx) {
        if (UID_STORES.has(name) && !obj.uid) obj.uid = newUid();
        if (!isFromSync(tx) || !obj._updatedAt) obj._updatedAt = new Date().toISOString();
        if (!isFromSync(tx)) tx.on('complete', notifyLocalChange);
      });
      table.hook('updating', function (_mods, _pk, _obj, tx) {
        if (isFromSync(tx)) return undefined;
        tx.on('complete', notifyLocalChange);
        return { _updatedAt: new Date().toISOString() };
      });
    }
  }
}

export const db = new DA180DB();

export const STORE_NAMES = [
  'profile',
  'diagnostics',
  'planDays',
  'lessonProgress',
  'attempts',
  'quizSessions',
  'mistakes',
  'conceptMastery',
  'remediations',
  'projectSubmissions',
  'portfolioItems',
  'interviewSessions',
  'tutorMessages',
  'skillSnapshots',
  'files',
  'settings',
  'meta',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];
