import Dexie, { type Table } from 'dexie';
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

export const SCHEMA_VERSION = 1;

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
