// Reusable confirm dialog — await confirm({...}) returns true/false.
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Icon, ICONS } from "./components.jsx";

const ConfirmCtx = createContext(() => Promise.resolve(false));

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, body, confirmLabel, danger }
  const resolver = useRef(null);
  const trigger = useRef(null); // element to restore focus to on close

  const confirm = useCallback((opts) => {
    // HIGH-19: if a prior confirm() is still pending, resolve it to false before overwriting
    // so the previous awaiter doesn't hang forever and tree state stays consistent.
    if (resolver.current) { try { resolver.current(false); } catch {} resolver.current = null; }
    trigger.current = document.activeElement;
    setState({ confirmLabel: "Confirm", danger: true, ...opts });
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const close = (val) => {
    setState(null);
    resolver.current && resolver.current(val); resolver.current = null;
    // return focus to whatever opened the dialog
    if (trigger.current && trigger.current.focus) { try { trigger.current.focus(); } catch {} }
    trigger.current = null;
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state ? (
        <div className="modal-root" role="dialog" aria-modal="true" aria-label={state.title}>
          <div className="modal-scrim" onClick={() => close(false)} />
          <div className="modal confirm-modal">
            <div className="confirm-head">
              <span className={"confirm-ico" + (state.danger ? " confirm-ico-danger" : "")}>
                <Icon d={state.danger ? ICONS.wrench : ICONS.check} size={18} />
              </span>
              <h2 className="modal-title">{state.title}</h2>
            </div>
            {state.body ? <p className="confirm-body">{state.body}</p> : null}
            <div className="confirm-foot">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)} autoFocus>Cancel</button>
              <button type="button" className={"btn " + (state.danger ? "btn-ghost-danger confirm-danger-btn" : "btn-primary")}
                onClick={() => close(true)}>{state.confirmLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
