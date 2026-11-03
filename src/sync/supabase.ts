import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/db';
import type { RemoteRecord, SyncRemote } from './engine';

// Supabase 連線設定：優先使用部署時設定的環境變數，其次使用這台裝置在設定頁輸入的值。

export interface SyncConfig {
  url: string;
  key: string;
  source: 'build' | 'device';
}

const TABLE = 'sync_records';

export async function loadConfig(): Promise<SyncConfig | null> {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envUrl && envKey) return { url: envUrl, key: envKey, source: 'build' };
  const [u, k] = await Promise.all([db.settings.get('sync.url'), db.settings.get('sync.key')]);
  if (typeof u?.value === 'string' && typeof k?.value === 'string' && u.value && k.value) {
    return { url: u.value, key: k.value, source: 'device' };
  }
  return null;
}

export async function saveDeviceConfig(url: string, key: string) {
  const clean = url.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(clean) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean)) {
    throw new Error('Project URL 格式應為 https://xxxx.supabase.co');
  }
  if (key.trim().length < 20) throw new Error('金鑰看起來不完整，請確認複製了完整的 Publishable key（或 anon key）。');
  await db.settings.bulkPut([
    { key: 'sync.url', value: clean },
    { key: 'sync.key', value: key.trim() },
  ]);
}

export async function clearDeviceConfig() {
  await db.settings.bulkDelete(['sync.url', 'sync.key']);
}

export async function createSupabase(cfg: SyncConfig): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE 會把驗證碼放在 ?code=，不會和網站的 #/ 路由衝突
      flowType: 'pkce',
      detectSessionInUrl: true,
      storageKey: 'da180-auth',
    },
  });
}

export class SupabaseRemote implements SyncRemote {
  constructor(private client: SupabaseClient, private userId: string) {}

  async pull(since: string | null, limit: number): Promise<RemoteRecord[]> {
    let q = this.client.from(TABLE).select('store,key,data,updated_at,server_updated_at');
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q.order('server_updated_at', { ascending: true }).limit(limit);
    if (error) throw new Error(explain(error.message));
    return (data ?? []) as RemoteRecord[];
  }

  async push(records: RemoteRecord[]): Promise<void> {
    if (records.length === 0) return;
    const rows = records.map((r) => ({ user_id: this.userId, store: r.store, key: r.key, data: r.data, updated_at: r.updated_at }));
    const { error } = await this.client.from(TABLE).upsert(rows, { onConflict: 'user_id,store,key' });
    if (error) throw new Error(explain(error.message));
  }

  async hasAnyData(): Promise<boolean> {
    const { count, error } = await this.client.from(TABLE).select('key', { count: 'exact', head: true });
    if (error) throw new Error(explain(error.message));
    return (count ?? 0) > 0;
  }

  async deleteAll(): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq('user_id', this.userId);
    if (error) throw new Error(explain(error.message));
  }
}

/** 把常見錯誤轉成看得懂的說明 */
export function explain(msg: string): string {
  if (/relation .*sync_records.* does not exist|Could not find the table/i.test(msg)) {
    return '雲端資料表尚未建立：請到 Supabase 的 SQL Editor 執行 supabase/schema.sql。';
  }
  if (/Invalid login credentials/i.test(msg)) return '電子郵件或密碼錯誤。';
  if (/Email not confirmed/i.test(msg)) return '信箱尚未確認：請到信箱點擊確認連結後再登入。';
  if (/User already registered/i.test(msg)) return '這個電子郵件已經註冊過，請直接登入。';
  if (/Password should be at least/i.test(msg)) return '密碼至少需要 6 個字元。';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return '無法連線到雲端，請確認網路連線。';
  if (/Invalid API key|No API key/i.test(msg)) return '金鑰無效，請確認貼上的是這個專案的 Publishable key（或 anon key）。';
  return msg;
}
