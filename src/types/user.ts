// 使用者資料型別（存在 IndexedDB）

import type { Domain } from './content';

export interface Profile {
  id: 'me';
  displayName: string;
  /** ISO 日期（YYYY-MM-DD），計畫第 1 天 */
  startDate: string;
  dailyMinutes: number;
  targetRole: string;
  selfReport: Partial<Record<Domain, boolean>>;
  createdAt: string;
}

export type AttemptContext =
  | 'lesson'
  | 'practice'
  | 'quiz'
  | 'exam'
  | 'diagnostic'
  | 'remediation'
  | 'review'
  | 'project'
  | 'interview';

export interface Attempt {
  id?: number;
  questionId: string;
  domain: Domain;
  concepts: string[];
  difficulty: number;
  context: AttemptContext;
  sessionId?: string;
  answer: string[];
  correct: boolean;
  /** 0–1，部分給分 */
  scoreRatio: number;
  /** 0 無提示、1 錯在哪、2 解題提示、3 看完整答案 */
  hintLevel: 0 | 1 | 2 | 3;
  durationSec: number;
  createdAt: string;
}

export type QuizMode = 'unit' | 'phase' | 'weakness' | 'mistakes' | 'mock_exam' | 'diagnostic';

export interface QuizSession {
  id: string;
  quizId: string;
  mode: QuizMode;
  questionIds: string[];
  startedAt: string;
  endedAt?: string;
  timeLimitSec?: number;
  score?: number;
  status: 'in_progress' | 'submitted' | 'expired';
}

export interface DiagnosticResult {
  id?: number;
  sessionId: string;
  takenAt: string;
  /** 0–1 */
  domainMastery: Partial<Record<Domain, number>>;
  totalCorrect: number;
  totalQuestions: number;
}

export type TaskType = 'lesson' | 'practice' | 'quiz' | 'project' | 'review' | 'interview' | 'business' | 'remediation';
export type TaskStatus = 'todo' | 'done' | 'skipped' | 'tested_out';

export interface PlanTask {
  taskId: string;
  type: TaskType;
  moduleId: string;
  title: string;
  estMinutes: number;
  status: TaskStatus;
  completedAt?: string;
}

export interface PlanDay {
  dayIndex: number;
  date: string;
  phaseId: number;
  moduleId: string;
  tasks: PlanTask[];
  note?: string;
}

export interface ConceptMastery {
  conceptId: string;
  domain: Domain;
  mastery: number;
  evidenceCount: number;
  consecutiveWrong: number;
  recentResults: number[];
  status: 'unknown' | 'learning' | 'ok' | 'weak';
  updatedAt: string;
}

export interface SkillSnapshot {
  weekIndex: number;
  takenAt: string;
  total: number;
  domains: Partial<Record<Domain, number>>;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
