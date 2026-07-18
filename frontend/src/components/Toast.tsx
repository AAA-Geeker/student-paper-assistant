import { create } from 'zustand';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastItem {
  id: number;
  type: 'ok' | 'err' | 'info';
  text: string;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (type: ToastItem['type'], text: string) => void;
  removeToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, text) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, type, text }] }));
    // 3 秒后自动消失
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  const styles = {
    ok: 'bg-green-50 border-green-200 text-green-800',
    err: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  };
  const icons = {
    ok: <CheckCircle size={16} />,
    err: <AlertCircle size={16} />,
    info: <AlertCircle size={16} />,
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm animate-slide-in ${styles[t.type]}`}
        >
          <span className="shrink-0 mt-0.5">{icons[t.type]}</span>
          <span className="flex-1">{t.text}</span>
          <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
