// 本機資料變更通知（資料庫 hook → 同步排程），獨立成小模組避免循環引用
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyLocalChange() {
  listeners.forEach((fn) => fn());
}
