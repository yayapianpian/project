import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// 在真正的 PostgreSQL（PGlite）中執行 supabase/schema.sql，確認語法與「較舊資料不覆寫」規則
describe('supabase schema', () => {
  it('runs and keeps the newer record', async () => {
    const pg = new PGlite();
    await pg.exec(`
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
      create role authenticated;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001');
    `);
    const sql = readFileSync('supabase/schema.sql', 'utf8');
    await pg.exec(sql);
    await pg.exec(sql); // 可重複執行
    const up = (t: string, v: string) =>
      pg.query(
        `insert into public.sync_records (store, key, data, updated_at) values ('profile','me',$1,$2)
         on conflict (user_id, store, key) do update set data = excluded.data, updated_at = excluded.updated_at`,
        [JSON.stringify({ v }), t],
      );
    await up('2026-11-03T10:00:00Z', 'b');
    const first = (await pg.query<{ server_updated_at: Date }>('select server_updated_at from public.sync_records')).rows[0].server_updated_at;
    await up('2026-11-03T09:00:00Z', 'older');
    const row = (await pg.query<{ data: { v: string } }>('select data from public.sync_records')).rows[0];
    expect(row.data.v).toBe('b');
    await up('2026-11-03T11:00:00Z', 'newer');
    const r2 = (await pg.query<{ data: { v: string }; server_updated_at: Date }>('select data, server_updated_at from public.sync_records')).rows[0];
    expect(r2.data.v).toBe('newer');
    expect(r2.server_updated_at.getTime()).toBeGreaterThanOrEqual(first.getTime());
    await pg.close();
  });
});
