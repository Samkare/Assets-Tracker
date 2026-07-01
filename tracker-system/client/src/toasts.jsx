// S3 — typed toast queue with Undo + progress bar. Replaces single-string toast.
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { Icon, ICONS } from "./components.jsx";

const ToastCtx = createContext(null);
let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  // HIGH-20: clear every pending timer on unmount so they can't fire setState on a dead tree.
  useEffect(() => () => {
    for (const tm of timers.current.values()) clearTimeout(tm);
    timers.current.clear();
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const push = useCallback((opts) => {
    const id = ++counter;
    const tone = opts.tone || "info";
    const ttl = opts.ttl ?? (tone === "error" ? 6000 : 3500);
    const t = { id, tone, title: opts.title || opts.msg, body: opts.body, action: opts.action, ttl };
    setToasts((arr) => {
      const next = [...arr, t].slice(-3);
      // HIGH-20: when slice evicts old toasts, kill their timers so the Map doesn't leak
      // and a stale timeout can't try to dismiss a toast that was already booted.
      const kept = new Set(next.map((x) => x.id));
      for (const [tid, tm] of timers.current.entries()) {
        if (!kept.has(tid) && tid !== id) { clearTimeout(tm); timers.current.delete(tid); }
      }
      return next;
    });
    timers.current.set(id, setTimeout(() => dismiss(id), ttl));
    return id;
  }, [dismiss]);

  const api = useCallback((msg, tone = "info", extra) =>
    push({ title: msg, tone, ...(extra || {}) }), [push]);

  const value = { showToast: api, push, dismiss };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => <ToastItem key={t.id} t={t} onDismiss={() => dismiss(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ t, onDismiss }) {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(0, 100 - ((Date.now() - start) / t.ttl) * 100);
      setPct(left);
      if (left <= 0) clearInterval(tick);
    }, 50);
    return () => clearInterval(tick);
  }, [t.ttl]);
  const onAction = () => { t.action?.onClick?.(); onDismiss(); };
  return (
    <div className={"toast toast-" + t.tone} role={t.tone === "error" ? "alert" : "status"}>
      <span className="toast-ico" aria-hidden="true">
        <Icon d={t.tone === "error" ? ICONS.close : t.tone === "success" ? ICONS.check : ICONS.bell} size={14} />
      </span>
      <div className="toast-body">
        <div className="toast-msg">{t.title}</div>
        {t.body ? <div className="toast-sub">{t.body}</div> : null}
      </div>
      {t.action ? (
        <button type="button" className="toast-action" onClick={onAction}>{t.action.label}</button>
      ) : null}
      <button type="button" className="toast-x" onClick={onDismiss} aria-label="Dismiss">
        <Icon d={ICONS.close} size={12} />
      </button>
      <span className="toast-progress" style={{ width: pct + "%" }} aria-hidden="true" />
    </div>
  );
}

export const useToast = () => useContext(ToastCtx);
