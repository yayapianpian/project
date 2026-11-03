import { useState } from 'react';
import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { Modal } from './ui';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 舊瀏覽器或未授權剪貼簿時的備援
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * 「複製給 AI」：產生帶有引導規則與學習脈絡的提示文字，
 * 讓使用者貼到自己的 Claude / ChatGPT 對話中，不需要 API、不產生額外費用。
 */
export function CopyToAIButton({ build, label = '複製給 AI', compact = false }: { build: () => string; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const openModal = () => {
    setText(build());
    setStatus('idle');
    setOpen(true);
  };

  const doCopy = async () => setStatus((await copyText(text)) ? 'copied' : 'failed');

  return (
    <>
      <button type="button" className={`btn btn-ghost ${compact ? '!px-2.5 !py-1 text-xs' : ''}`} onClick={openModal} title="產生提示文字，貼到你自己的 Claude 或 ChatGPT">
        <Sparkles size={compact ? 14 : 16} />
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="複製給 AI"
        footer={
          <>
            <a className="btn btn-ghost" href="https://claude.ai/new" target="_blank" rel="noreferrer">開啟 Claude <ExternalLink size={14} /></a>
            <a className="btn btn-ghost" href="https://chatgpt.com/" target="_blank" rel="noreferrer">開啟 ChatGPT <ExternalLink size={14} /></a>
            <button className="btn btn-primary" onClick={doCopy}>
              {status === 'copied' ? <Check size={16} /> : <Copy size={16} />}
              {status === 'copied' ? '已複製' : '複製文字'}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          複製後貼到你自己的 Claude 或 ChatGPT 對話。使用的是你現有的訂閱，<strong className="text-ink">不需要 API、不會產生額外費用</strong>。
          提示已包含「先引導、再提示、最後才給答案」的規則。你可以先修改內容再複製。
        </p>
        <textarea className="input h-72 font-mono text-xs leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} aria-label="提示文字" />
        {status === 'copied' && <p className="mt-2 text-sm text-good">已複製到剪貼簿，請貼到 AI 對話中。</p>}
        {status === 'failed' && <p className="mt-2 text-sm text-bad">無法自動複製，請在上方文字框按 Ctrl+A 全選後再按 Ctrl+C。</p>}
      </Modal>
    </>
  );
}
