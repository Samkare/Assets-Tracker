// Export buttons + Excel import (dry-run preview -> commit). Shown on the Assets page.
import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api/client.js";
import { Icon, ICONS } from "./components.jsx";

export function ImportExportBar({ canManage, onToast }) {
  const fileRef = useRef(null);
  const qc = useQueryClient();
  const [preview, setPreview] = useState(null); // {token, insert, update, total, duplicates, newDepartments, errors}
  const [busy, setBusy] = useState(false);

  const pick = () => fileRef.current && fileRef.current.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const res = await api.upload("/import/assets", file);
      setPreview(res);
    } catch (ex) {
      onToast(ex.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const r = await api.post("/import/assets/commit", { token: preview.token });
      onToast(`Imported ${r.committed} assets`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
    } catch (ex) {
      onToast(ex.message || "Commit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <React.Fragment>
      <div className="io-toolbar" role="group" aria-label="Import and export">
        <button type="button" className="io-btn" onClick={() => api.download("/export/assets.xlsx")} title="Export the register to Excel">
          <Icon d={ICONS.download || ICONS.assets} size={14} /> Export
        </button>
        {canManage ?
          <button type="button" className="io-btn" onClick={() => api.download("/export/assets-template.xlsx")} title="Download a blank Excel template with the right columns + sample rows">
            <Icon d={ICONS.template || ICONS.hdd} size={14} /> Template
          </button> : null}
        {canManage ?
          <button type="button" className="io-btn io-btn-accent" onClick={pick} disabled={busy} title="Import assets from Excel">
            <Icon d={ICONS.upload || ICONS.plus} size={14} /> Import
          </button> : null}
      </div>
      <input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={onFile} />

      {preview ?
        <div className="modal-scrim modal-scrim-on" onClick={() => !busy && setPreview(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">Import preview</h2>
              <button type="button" className="icon-btn" onClick={() => setPreview(null)}><Icon d={ICONS.close} size={16} /></button>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 10 }}>
              <div className="stats" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="stat-card"><div className="stat-label">New</div><div className="stat-value">{preview.insert}</div></div>
                <div className="stat-card"><div className="stat-label">Updated</div><div className="stat-value">{preview.update}</div></div>
                <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{preview.total}</div></div>
              </div>
              {preview.duplicates?.length ? <div className="login-sub">Duplicate tags collapsed: {preview.duplicates.length}</div> : null}
              {preview.newDepartments?.length ? <div className="login-sub">New departments: {preview.newDepartments.join(", ")}</div> : null}
              {preview.errors?.length ?
                <div className="login-err">{preview.errors.length} row(s) skipped — first: row {preview.errors[0].row} {preview.errors[0].error}</div> : null}
            </div>
            <div className="modal-foot" style={{ padding: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={commit} disabled={busy || preview.total === 0}>
                {busy ? "Importing…" : `Apply ${preview.total}`}
              </button>
            </div>
          </div>
        </div> : null}
    </React.Fragment>);
}
