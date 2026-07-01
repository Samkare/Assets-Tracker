// In-app help — a "?" in the top bar opens this guide. Plain-language tour of every
// feature, role-aware (Viewer reads; IT-Manager edits; Admin also manages users).
import React, { useRef, useEffect } from "react";
import { Icon, ICONS } from "./components.jsx";
import { useFocusTrap } from "./useFocusTrap.js";

const SECTIONS = [
  {
    icon: ICONS.dashboard, title: "Getting started",
    body: "This is your IT asset register — who has which machine, what stock you hold, and what needs attention. Use the left sidebar to move between sections and the search box up top to jump to any employee or asset.",
    bullets: [
      "Search matches employee name, full name, asset tag, department, CPU or RAM.",
      "Your role decides what you can change: Viewer = read-only · IT-Manager = edit assets/stock/repairs · Admin = also manage users.",
    ],
  },
  {
    icon: ICONS.assets, title: "Assets",
    body: "The full hardware register. Click any row to open its detail card — Specs, History (every change), and Repairs.",
    bullets: [
      "Add Asset — register one machine (manager).",
      "Import — bulk-load from Excel. Hit Template first for a sample file with the right columns + example rows, fill it, then Import (you preview insert/update counts before committing).",
      "Export — download the whole register to Excel.",
      "Full Name column shows the person's real name; search finds a machine by it too.",
      "Tick a peripheral on a machine and — if you keep a stock item with that name — it's auto-issued from inventory (and returned when you untick it). See Stock Operations → Peripherals.",
    ],
  },
  {
    icon: ICONS.employees, title: "Employees",
    body: "Every person and the machine assigned to them. Click to see their asset.",
  },
  {
    icon: ICONS.departments, title: "Departments",
    body: "Fleet broken down by department. Click a card for its stats — assets, people, dual-monitor count, and peripheral coverage %.",
    bullets: [
      "Admins can Add, rename, recolour, or Delete a department right here — new ones appear instantly in every department dropdown.",
      "A department can only be deleted once it holds no assets — reassign them first.",
    ],
  },
  {
    icon: ICONS.hdd, title: "Stock Overview",
    body: "At-a-glance counts of hardware, consumables and licenses. Every KPI tile and every bar row is clickable — it opens a pop-up listing exactly those machines.",
  },
  {
    icon: ICONS.box || ICONS.hdd, title: "Stock Operations",
    body: "Run your store room. Tabs across the top:",
    bullets: [
      "Stock — receive / issue / adjust consumables (cables, etc.). Export current stock or the movement log to Excel from the toolbar.",
      "Spare Hardware — machines in the IT store, ready to deploy.",
      "Defective Items — tick 'Mark as defective' on a Return to log a faulty unit, then hit Record replacement on its row to close it out.",
      "Movements — full in/out history.",
      "Suppliers & Categories — manage your lists.",
      "Peripherals — add your own types (UPS, Docking Station…). They show on every asset, and if a stock item shares the name, assigning one auto-deducts from stock.",
    ],
  },
  {
    icon: ICONS.bell, title: "Alerts",
    body: "One place for things needing action: overdue returns, software renewals due, low stock, and repair tickets open past their SLA. The bell up top mirrors these; opening it marks them read.",
  },
  {
    icon: ICONS.wrench, title: "Repairs",
    body: "Open, track and close repair tickets against an asset, with cost and resolution.",
  },
  {
    icon: ICONS.diamond, title: "Software",
    body: "Licenses and seat usage. Assign seats to employees; the bar turns red when a license is full. Export the list to Excel.",
  },
  {
    icon: ICONS.reports || ICONS.dashboard, title: "Reports",
    body: "Fleet composition, peripheral coverage by department, and equipment gaps. Click any KPI, bar or gap tile to drill into the underlying machines.",
  },
  {
    icon: ICONS.history, title: "Audit Log",
    body: "A time-stamped record of every change — who did what, when. Export it to Excel for records.",
  },
  {
    icon: ICONS.shield, title: "Users (Admin only)",
    body: "Add team members, edit roles, reset passwords, or deactivate accounts. New users are asked to set a fresh password at first sign-in.",
  },
];

export function HelpPanel({ open, onClose, role = "Viewer", onStartTour }) {
  const ref = useRef(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-detail help-panel" role="dialog" aria-modal="true" aria-label="Help & guide" ref={ref}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Help &amp; guide</div>
            <div className="modal-subtitle">Signed in as <b>{role}</b> — what each part does</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close help">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="modal-body help-body">
          {onStartTour ? (
            <button type="button" className="btn btn-primary help-tour-btn" onClick={onStartTour}>
              <Icon d={ICONS.help} size={14} /> Take the 6-step tour
            </button>
          ) : null}
          {SECTIONS.map((s) => (
            <div className="help-section" key={s.title}>
              <div className="help-section-head">
                <span className="help-ico"><Icon d={s.icon} size={16} /></span>
                <h3 className="help-section-title">{s.title}</h3>
              </div>
              <p className="help-section-body">{s.body}</p>
              {s.bullets ? (
                <ul className="help-list">
                  {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
          <div className="help-foot">Tip: press <kbd className="kbd-hint">⌘K</kbd> anywhere to jump to search.</div>
        </div>
      </div>
    </div>
  );
}
