// Forced password change for first-login (must_reset) accounts.
import React, { useState } from "react";
import { api } from "./api/client.js";
import { PASSWORD_RULES, checkPassword } from "@its/shared/validation";

export function ForceReset({ onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const pol = checkPassword(next);
    if (!pol.ok) return setErr(pol.error);
    if (next !== confirm) return setErr("Passwords do not match.");
    setBusy(true); setErr("");
    try {
      await api.post("/auth/password", { current, next });
      onDone();
    } catch (ex) {
      setErr(ex.message || "Could not update password");
      setBusy(false);
    }
  };

  return (
    <div className="modal-scrim modal-scrim-on" style={{ zIndex: 200 }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head"><h2 className="modal-title">Set a new password</h2></div>
        <p className="login-sub" style={{ padding: "0 20px" }}>
          Your account uses a temporary password. Choose a new one to continue.
        </p>
        <form onSubmit={submit} className="login-form" style={{ padding: 20 }}>
          <label className="form-row">
            <span className="form-label">Current (temporary) password</span>
            <input className="input" type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setErr(""); }} />
          </label>
          <label className="form-row">
            <span className="form-label">New password</span>
            <input className="input" type="password" value={next} onChange={(e) => { setNext(e.target.value); setErr(""); }} />
            <span style={{ fontSize: "var(--fs-11)", color: "var(--text-3)" }}>{PASSWORD_RULES}</span>
          </label>
          <label className="form-row">
            <span className="form-label">Confirm new password</span>
            <input className="input" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr(""); }} />
          </label>
          {err ? <div className="login-err">{err}</div> : null}
          <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </div>);
}
