// Real-auth login — posts email+password to the API. Reuses the prototype's login CSS classes.
import React, { useState } from "react";
import { Icon, ICONS } from "./components.jsx";

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setErr("Enter your work email."); return; }
    if (!pw) { setErr("Enter your password."); return; }
    setBusy(true); setErr("");
    try {
      await onLogin({ email: email.trim(), password: pw });
    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-stage">
      <div className="login-card">
        <div className="login-brand">
          <img className="login-logo" src="/logo.png" alt="Task Source" />
          <span className="login-tagline">IT Asset Tracker</span>
        </div>
        <h1 className="login-title">Sign in to your workspace</h1>
        <p className="login-sub">Restricted to the IT operations team.</p>
        <form onSubmit={submit} className="login-form">
          <label className="form-row">
            <span className="form-label">Work email</span>
            <input className={"input" + (err && !email ? " input-error" : "")} type="email" autoComplete="username"
              placeholder="e.g. santosh@belgiumdia.com" value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
          </label>
          <label className="form-row">
            <span className="form-label">Password</span>
            <input className="input" type="password" autoComplete="current-password"
              placeholder="••••••••" value={pw}
              onChange={(e) => { setPw(e.target.value); setErr(""); }} />
          </label>
          {err ? <div className="login-err">{err}</div> : null}
          <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="login-help">
          <Icon d={ICONS.shield} size={13} />
          <span>New to the team? Ask an admin to create your account.</span>
        </div>
      </div>
    </div>);
}
