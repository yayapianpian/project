-- Data Analyst 180：雲端同步資料表
-- 使用方式：Supabase 專案 → SQL Editor → 貼上整份檔案 → Run（可重複執行）

create table if not exists public.sync_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null,           -- 資料在裝置上最後修改的時間（用來判斷哪一份比較新）
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),  -- 伺服器收到的時間（用來增量下載）
  primary key (user_id, store, key)
);

create index if not exists sync_records_pull_idx on public.sync_records (user_id, server_updated_at);

-- 只保留較新的一份：如果上傳的資料比雲端舊，就不覆寫；每次寫入都更新伺服器時間
create or replace function public.sync_records_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists sync_records_guard on public.sync_records;
create trigger sync_records_guard
  before insert or update on public.sync_records
  for each row execute function public.sync_records_guard();

-- 每個人只能讀寫自己的資料
alter table public.sync_records enable row level security;

drop policy if exists "own records" on public.sync_records;
create policy "own records" on public.sync_records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
