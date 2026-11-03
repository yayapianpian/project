import { useState } from 'react';
import { Cloud, CloudOff, ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import {
  configure, deleteCloudData, dismissNotice, fullResync, removeConfig, resolveFirstLink, signIn, signOut, signUp, syncNow, useSyncState,
} from '../sync/manager';
import { Badge, Modal } from './ui';

const STATUS_TEXT: Record<string, string> = {
  loading: '載入中', idle: '準備同步', syncing: '同步中…', ok: '已同步', error: '同步失敗', offline: '離線中（恢復網路後自動同步）',
  needs_choice: '等待你選擇', signed_out: '未登入', disabled: '未設定',
};

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function ConfigForm() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const { busy, error, run } = useAction();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        第一次使用需要建立免費的 Supabase 專案（約 10 分鐘），步驟請看{' '}
        <a className="text-accent hover:underline" href="https://github.com/yayapianpian/project/blob/claude/data-analyst-180-platform-yl3wc2/docs/07-cloud-sync.md" target="_blank" rel="noreferrer">
          雲端同步設定教學 <ExternalLink size={12} className="inline" />
        </a>
        。完成後把專案的網址與金鑰貼在下面。若網站部署時已設定好，這一步會自動略過。
      </p>
      <div>
        <label className="label" htmlFor="sb-url">Project URL</label>
        <input id="sb-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="sb-key">Publishable key（或 anon public key）</label>
        <input id="sb-key" className="input font-mono text-xs" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_… 或 eyJ…" autoComplete="off" />
        <p className="mt-1 text-xs text-muted">這把金鑰本來就設計給網頁使用，資料安全由資料表的權限規則保護（每個帳號只能讀寫自己的資料）。請勿貼上 secret / service_role 金鑰。</p>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !url || !key} onClick={() => run(() => configure(url, key))}>儲存並連線</button>
    </div>
  );
}

function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => signIn(email, password)); }}>
      <p className="text-sm text-muted">用同一個帳號在手機、平板、電腦登入，學習紀錄就會自動同步。第一次使用請按「註冊新帳號」。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="au-email">電子郵件</label>
          <input id="au-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="au-pw">密碼（至少 6 個字元）</label>
          <input id="au-pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required minLength={6} />
        </div>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy}>登入</button>
        <button type="button" className="btn btn-ghost" disabled={busy || !email || password.length < 6} onClick={() => run(() => signUp(email, password))}>註冊新帳號</button>
      </div>
    </form>
  );
}

export function SyncCard() {
  const s = useSyncState();
  const { busy, error, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">跨裝置雲端同步</h2>
        <Badge tone={s.status === 'ok' ? 'good' : s.status === 'error' ? 'bad' : s.status === 'offline' ? 'warn' : 'muted'}>{STATUS_TEXT[s.status]}</Badge>
      </div>

      {s.notice && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-accent-soft p-3 text-sm text-accent">
          <span>{s.notice}</span>
          <button className="text-xs underline" onClick={dismissNotice}>知道了</button>
        </div>
      )}

      {s.status === 'loading' && <p className="text-sm text-muted">載入中…</p>}
      {s.status === 'disabled' && <ConfigForm />}
      {s.status === 'signed_out' && <AuthForm />}
      {s.status !== 'loading' && s.status !== 'disabled' && s.status !== 'signed_out' && (
        <div className="space-y-3">
          <p className="text-sm">
            已登入：<strong>{s.email}</strong>
            {s.lastSyncAt && <span className="text-muted">　·　上次同步 {new Date(s.lastSyncAt).toLocaleString('zh-TW')}</span>}
          </p>
          {s.error && <p className="text-sm text-bad">{s.error}</p>}
          <p className="text-xs text-muted">修改資料後幾秒內、切回這個網頁時、恢復網路時都會自動同步。</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || s.status === 'syncing'} onClick={() => run(syncNow)}><RefreshCw size={16} />立即同步</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => run(fullResync)}>完整重新同步</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => run(signOut)}><LogOut size={16} />登出</button>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">進階</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-danger !py-1 text-xs" onClick={() => setConfirmDelete(true)}>刪除雲端資料…</button>
              {s.configSource === 'device' && <button className="btn btn-ghost !py-1 text-xs" onClick={() => run(removeConfig)}>移除這台裝置的連線設定</button>}
            </div>
          </details>
        </div>
      )}
      {s.status === 'signed_out' && s.configSource === 'device' && (
        <button className="mt-3 text-xs text-muted underline" onClick={() => run(removeConfig)}>移除這台裝置的連線設定</button>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="刪除雲端資料"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>取消</button>
            <button className="btn btn-danger" onClick={() => run(async () => { await deleteCloudData(); setConfirmDelete(false); })}>刪除並登出</button>
          </>
        }
      >
        <p className="text-sm">會刪除這個帳號存在雲端的所有學習紀錄，並在這台裝置登出。這台裝置上的資料會保留；其他裝置上的資料也不會被刪除，但不再同步。</p>
      </Modal>
    </section>
  );
}

/** 第一次在已有資料的裝置登入時，詢問要用哪一份資料 */
export function FirstLinkModal() {
  const s = useSyncState();
  const [busy, setBusy] = useState(false);
  const choose = async (c: 'cloud' | 'merge') => {
    setBusy(true);
    await resolveFirstLink(c);
    setBusy(false);
  };
  return (
    <Modal open={s.status === 'needs_choice'} onClose={() => undefined} title="雲端已經有你的學習紀錄">
      <p className="mb-4 text-sm leading-relaxed">這台裝置上也有學習資料。要怎麼處理？</p>
      <div className="grid gap-2">
        <button className="btn btn-primary justify-start text-left" disabled={busy} onClick={() => choose('cloud')}>
          使用雲端紀錄（建議）——這台裝置的資料會被雲端資料取代
        </button>
        <button className="btn btn-ghost justify-start text-left" disabled={busy} onClick={() => choose('merge')}>
          合併兩邊——作答紀錄全部保留；設定與計畫以較新修改的為準
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">如果這台裝置只是剛剛試用過，請選「使用雲端紀錄」。</p>
    </Modal>
  );
}

export function SyncIndicator() {
  const s = useSyncState();
  if (s.status === 'loading' || s.status === 'disabled' || s.status === 'signed_out') return null;
  const bad = s.status === 'error' || s.status === 'offline';
  const Icon = bad ? CloudOff : Cloud;
  return (
    <button
      className={`btn btn-ghost !px-2.5 ${s.status === 'error' ? 'text-bad' : s.status === 'offline' ? 'text-warn' : ''}`}
      onClick={() => syncNow()}
      title={`${STATUS_TEXT[s.status]}${s.error ? `：${s.error}` : ''}（點擊立即同步）`}
      aria-label={`雲端同步狀態：${STATUS_TEXT[s.status]}，點擊立即同步`}
    >
      <Icon size={16} className={s.status === 'syncing' ? 'animate-pulse' : ''} />
      <span className="hidden sm:inline">{s.status === 'ok' ? '已同步' : STATUS_TEXT[s.status]}</span>
    </button>
  );
}
