// Toast (pemberitahuan singkat) + dialog konfirmasi, dipanggil dari mana saja.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { Icon } from "./Icon.jsx";

let tid = 0;
const useFeedback = create((set) => ({ toasts: [], confirm: null }));

export function toast(text, tone = "ok") {
  const id = ++tid;
  useFeedback.setState((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
  setTimeout(() => useFeedback.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === "err" ? 7000 : 4000);
}

/** confirmAction({ title, body, confirmText, danger }) -> Promise<boolean> */
export function confirmAction(opts) {
  return new Promise((resolve) => useFeedback.setState({ confirm: { ...opts, resolve } }));
}

export function FeedbackHost() {
  const toasts = useFeedback((s) => s.toasts);
  const confirm = useFeedback((s) => s.confirm);
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (confirm && !d.open) d.showModal();
    if (!confirm && d.open) d.close();
  }, [confirm]);

  const answer = (v) => { confirm?.resolve(v); useFeedback.setState({ confirm: null }); };

  return (
    <>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.tone}>
            <Icon name={t.tone === "err" ? "alert" : "checkCircle"} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); answer(false); }}
        onClick={(e) => { if (e.target === e.currentTarget) answer(false); }}>
        {confirm && (
          <div className="confirm-box">
            <div className={"confirm-ic" + (confirm.danger ? " danger" : "")}><Icon name={confirm.danger ? "trash" : "info"} size={20} /></div>
            <h3>{confirm.title}</h3>
            {confirm.body && <p>{confirm.body}</p>}
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => answer(false)}>Batal</button>
              <button type="button" className={"btn " + (confirm.danger ? "btn-danger" : "btn-primary")} autoFocus onClick={() => answer(true)}>
                {confirm.confirmText || "Lanjutkan"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
