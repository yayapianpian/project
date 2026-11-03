import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload } from 'lucide-react';
import { db } from '../db/db';
import { regeneratePlan, resetAllData } from '../db/repo';
import { downloadJson, exportBackup, importBackup, isPersistentStorage, markBackedUp, parseBackup, requestPersistentStorage, type BackupFile, type BackupSummary } from '../db/backup';
import { useProfile } from '../hooks/data';
import { ProfileForm } from '../components/ProfileForm';
import { Loading, Modal, PageHeader } from '../components/ui';
import { SyncCard } from '../components/SyncPanel';

function fmt(v: unknown) {
  return typeof v === 'string' ? new Date(v).toLocaleString('zh-TW') : '從未';
}

export function SettingsPage() {
  const profile = useProfile();
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value ?? null, []);
  const [persisted, setPersisted] = useState<boolean | null | undefined>(undefined);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isPersistentStorage().then(setPersisted);
  }, []);

  if (profile === undefined) return <Loading />;

  const doExport = async () => {
    const b = await exportBackup();
    downloadJson(b, `da180-backup-${new Date().toISOString().slice(0, 10)}.json`);
    await markBackedUp();
    setMsg({ tone: 'good', text: '已下載備份檔。' });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
      setMsg(null);
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!pending) return;
    // 覆寫前先自動備份目前資料
    downloadJson(await exportBackup(), `da180-before-import-${new Date().toISOString().slice(0, 10)}.json`);
    await importBackup(pending.backup);
    setPending(null);
    setMsg({ tone: 'good', text: '已還原備份。匯入前的資料也已自動下載一份。' });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="設定與備份" />

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold">個人設定</h2>
        {profile ? (
          <ProfileForm
            initial={profile}
            submitLabel="儲存設定"
            onSaved={async () => {
              if ((await db.planDays.count()) > 0) await regeneratePlan();
            }}
          />
        ) : (
          <p className="text-sm text-muted">尚未建立個人資料，請先到首頁完成設定。</p>
        )}
        {profile && <p className="mt-3 text-xs text-muted">修改開始日或每日時間後，計畫會自動重新排列日期，已完成的任務會保留。</p>}
      </section>

      <SyncCard />

      <section className="card">
        <h2 className="mb-1 text-sm font-semibold">備份與還原</h2>
        <p className="mb-4 text-sm text-muted">學習紀錄只存在這個瀏覽器。換電腦、換瀏覽器或清除瀏覽資料前，請先匯出備份。上次備份：{fmt(lastBackup)}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={doExport}><Download size={16} />匯出備份</button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={16} />從備份還原</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="選擇備份檔" />
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.tone === 'good' ? 'text-good' : 'text-bad'}`}>{msg.text}</p>}
        <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
          <div className="font-medium">瀏覽器持久化儲存</div>
          <div className="mt-1 text-muted">
            {persisted === undefined ? '檢查中…' : persisted ? '已啟用：瀏覽器不會在空間不足時自動清除你的資料。' : persisted === false ? '未啟用：瀏覽器在空間不足時可能清除資料，請定期備份。' : '此瀏覽器不支援查詢。'}
          </div>
          {persisted === false && <button className="btn btn-ghost mt-2 !py-1 text-xs" onClick={async () => setPersisted(await requestPersistentStorage())}>再次請求</button>}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 text-sm font-semibold">AI 導師</h2>
        <p className="text-sm text-muted">
          目前使用「複製給 AI」：在任務、題目與 AI 導師頁產生提示文字，貼到你自己的 Claude 或 ChatGPT，不需要 API、不會額外付費。
          網站內直接呼叫 AI 的功能需要自備 Anthropic API Key（與 Claude 訂閱分開計費），規劃於第 6 階段提供，屬於選用功能。
        </p>
      </section>

      <section className="card border-bad">
        <h2 className="mb-1 text-sm font-semibold text-bad">清除所有資料</h2>
        <p className="mb-3 text-sm text-muted">刪除這個瀏覽器中的所有學習紀錄、計畫與設定，無法復原。建議先匯出備份。如果已登入雲端同步，清除後會再從雲端下載；要刪除雲端資料請使用上方「跨裝置雲端同步 → 進階」。</p>
        <button className="btn btn-danger" onClick={() => { setResetText(''); setResetOpen(true); }}>清除所有資料…</button>
      </section>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="確認還原備份"
        footer={<><button className="btn btn-ghost" onClick={() => setPending(null)}>取消</button><button className="btn btn-primary" onClick={confirmImport}>覆寫並還原</button></>}
      >
        {pending && (
          <div className="space-y-2 text-sm">
            <p>備份時間：{fmt(pending.summary.exportedAt)}</p>
            <ul className="list-inside list-disc text-muted">
              <li>作答紀錄 {pending.summary.attempts} 筆</li>
              <li>學習計畫 {pending.summary.planDays} 天</li>
              <li>能力診斷 {pending.summary.diagnostics} 次</li>
              <li>專案提交 {pending.summary.projects} 份</li>
            </ul>
            <p className="text-warn">目前瀏覽器中的資料會被覆寫。覆寫前會自動下載一份目前資料的備份。</p>
          </div>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="清除所有資料"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setResetOpen(false)}>取消</button>
            <button
              className="btn btn-danger"
              disabled={resetText !== '清除'}
              onClick={async () => {
                await resetAllData();
                setResetOpen(false);
                setMsg({ tone: 'good', text: '已清除所有資料。' });
              }}
            >
              永久清除
            </button>
          </>
        }
      >
        <label className="label" htmlFor="reset-confirm">請輸入「清除」兩個字確認</label>
        <input id="reset-confirm" className="input" value={resetText} onChange={(e) => setResetText(e.target.value)} />
      </Modal>
    </div>
  );
}
