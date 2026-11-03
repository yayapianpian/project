import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clearLocalForCloud, hasLocalData, hasSyncedBefore, resetSyncState, syncOnce } from './engine';
import { clearDeviceConfig, createSupabase, explain, loadConfig, saveDeviceConfig, SupabaseRemote, type SyncConfig } from './supabase';
import { onLocalChange } from './signal';

// 同步狀態管理：登入、自動同步（本機修改後、切回網頁、恢復網路時）、狀態顯示。

export type SyncStatus = 'loading' | 'idle' | 'disabled' | 'signed_out' | 'needs_choice' | 'syncing' | 'ok' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  configSource?: SyncConfig['source'];
  email?: string;
  lastSyncAt?: string;
  error?: string;
  /** 給使用者看的一次性訊息（例如註冊後請收信） */
  notice?: string;
}

let state: SyncState = { status: 'loading' };
const listeners = new Set<() => void>();
let client: SupabaseClient | null = null;
let remote: SupabaseRemote | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let again = false;
let initialized = false;
let unsubAuth: (() => void) | null = null;

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

function redirectUrl() {
  return `${location.origin}${location.pathname}`;
}

async function handleSession(userId: string | null, email: string | null) {
  if (!userId) {
    remote = null;
    set({ status: 'signed_out', email: undefined });
    return;
  }
  remote = new SupabaseRemote(client!, userId);
  set({ email: email ?? undefined, error: undefined });
  try {
    if (!(await hasSyncedBefore()) && (await hasLocalData()) && (await remote.hasAnyData())) {
      set({ status: 'needs_choice' });
      return;
    }
  } catch (e) {
    set({ status: 'error', error: (e as Error).message });
    return;
  }
  await syncNow();
}

export async function initSync() {
  if (initialized) return;
  initialized = true;
  onLocalChange(() => scheduleSync());
  window.addEventListener('online', () => scheduleSync(500));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && scheduleSync(500));
  await connect();
}

async function connect() {
  unsubAuth?.();
  unsubAuth = null;
  client = null;
  remote = null;
  const cfg = await loadConfig();
  if (!cfg) {
    set({ status: 'disabled', configSource: undefined, email: undefined });
    return;
  }
  set({ configSource: cfg.source });
  try {
    client = await createSupabase(cfg);
    const fromEmailLink = /[?&](code|error_description)=/.test(location.search);
    const { data } = await client.auth.getSession();
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      // Supabase 建議不要在這個回呼中直接 await 其他呼叫
      setTimeout(() => handleSession(session?.user.id ?? null, session?.user.email ?? null), 0);
    });
    unsubAuth = () => sub.subscription.unsubscribe();
    if (fromEmailLink) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (!data.session) set({ notice: '信箱已確認，請用電子郵件與密碼登入。' });
    }
    await handleSession(data.session?.user.id ?? null, data.session?.user.email ?? null);
  } catch (e) {
    set({ status: 'error', error: explain((e as Error).message) });
  }
}

export function scheduleSync(ms = 4000) {
  if (!remote || state.status === 'needs_choice') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow();
  }, ms);
}

export async function syncNow() {
  if (!remote || state.status === 'needs_choice') return;
  if (running) {
    again = true;
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    set({ status: 'offline' });
    return;
  }
  running = true;
  set({ status: 'syncing', error: undefined });
  try {
    await syncOnce(remote);
    set({ status: 'ok', lastSyncAt: new Date().toISOString() });
  } catch (e) {
    set({ status: 'error', error: explain((e as Error).message) });
  } finally {
    running = false;
    if (again) {
      again = false;
      scheduleSync(500);
    }
  }
}

/** 第一次在已有本機資料的裝置登入時：使用雲端資料，或合併兩邊 */
export async function resolveFirstLink(choice: 'cloud' | 'merge') {
  if (choice === 'cloud') await clearLocalForCloud();
  set({ status: 'idle' });
  await syncNow();
}

export async function signIn(email: string, password: string) {
  if (!client) throw new Error('尚未設定雲端同步。');
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(explain(error.message));
  set({ notice: undefined });
}

export async function signUp(email: string, password: string) {
  if (!client) throw new Error('尚未設定雲端同步。');
  const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw new Error(explain(error.message));
  if (!data.session) set({ notice: `已寄出確認信到 ${email.trim()}，請點擊信中的連結，再回來登入。` });
}

export async function signOut() {
  await client?.auth.signOut();
  await resetSyncState();
  set({ status: 'signed_out', email: undefined, lastSyncAt: undefined });
}

export async function configure(url: string, key: string) {
  await saveDeviceConfig(url, key);
  await connect();
}

export async function removeConfig() {
  await client?.auth.signOut().catch(() => undefined);
  await clearDeviceConfig();
  await resetSyncState();
  await connect();
}

export async function fullResync() {
  await resetSyncState();
  await syncNow();
}

export async function deleteCloudData() {
  if (!remote) throw new Error('請先登入。');
  await remote.deleteAll();
  await signOut();
  set({ notice: '已刪除雲端資料並登出。這台裝置的資料仍保留；之後再次登入時會重新上傳。' });
}

export function dismissNotice() {
  set({ notice: undefined });
}
