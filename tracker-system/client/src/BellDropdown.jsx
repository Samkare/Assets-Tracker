// In-app notifications dropdown — opens from topbar bell.
import React, { useState, useRef, useEffect } from "react";
import { Icon, ICONS } from "./components.jsx";
import { useNotifications, usePref, useSetPref } from "./api/hooks.js";
import { useFocusTrap } from "./useFocusTrap.js";

const KIND_ICON = { repair: ICONS.wrench, sla: ICONS.history, return: ICONS.history, renewal: ICONS.diamond, low: ICONS.hdd };

function fmtRel(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

export function BellDropdown({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);
  useFocusTrap(popRef, open);
  const { data } = useNotifications();
  const items = data?.items || [];

  // Read-state: persist which notification ids the user has already seen. Badge counts only
  // unread ones, so once the dropdown is opened the count clears — but a NEW alert (new id)
  // re-triggers it. Stored per-user in prefs.
  const { data: seenIds } = usePref("notifsSeen");
  const setSeen = useSetPref("notifsSeen");
  const seen = new Set(seenIds || []);
  const unread = items.filter((n) => !seen.has(n.id));
  const count = unread.length;

  // On open, mark everything currently shown as read (storing exactly the current ids also
  // prunes stale ones that no longer fire).
  useEffect(() => {
    if (!open || items.length === 0) return;
    const ids = items.map((n) => n.id);
    const cur = new Set(seenIds || []);
    const changed = ids.length !== cur.size || ids.some((id) => !cur.has(id));
    if (changed) setSeen.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const openAlerts = () => { setOpen(false); onNavigate && onNavigate("Alerts"); };

  return (
    <div className="bell-wrap" ref={ref}>
      <button type="button" className="topbar-util bell-btn" onClick={() => setOpen((v) => !v)} aria-label="Notifications" aria-expanded={open}>
        <Icon d={ICONS.bell} size={17} />
        {count > 0 ? <span className="bell-badge">{count > 9 ? "9+" : count}</span> : null}
      </button>
      {open ? (
        <div className="bell-pop" role="menu" aria-label="Notifications" ref={popRef}>
          <div className="bell-head">
            <div className="bell-title">Notifications</div>
            <span className="bell-count">{items.length}</span>
          </div>
          <div className="bell-list">
            {items.length === 0 ? (
              <div className="bell-empty">
                <Icon d={ICONS.check} size={20} />
                <div>All clear — no alerts.</div>
              </div>
            ) : items.map((n) => (
              <div key={n.id} className="bell-item" data-tone={n.tone || "warn"}>
                <span className="bell-item-ico"><Icon d={KIND_ICON[n.kind] || ICONS.bell} size={14} /></span>
                <div className="bell-item-body">
                  <div className="bell-item-title">{n.title}</div>
                  {n.sub ? <div className="bell-item-sub">{n.sub}</div> : null}
                </div>
                {n.time ? <div className="bell-item-time">{fmtRel(n.time)}</div> : null}
              </div>
            ))}
          </div>
          <div className="bell-foot">
            <button type="button" className="bell-foot-link" onClick={openAlerts}>View all alerts →</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
