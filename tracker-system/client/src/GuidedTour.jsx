// First-login guided tour — spotlights real UI elements with a Next/Back popover.
// No library: dims the page with a box-shadow "hole" over each target. Runs once
// (persisted via the `tourSeen` pref) and can be re-launched from the Help panel.
import React, { useState, useEffect, useCallback } from "react";
import { Icon, ICONS } from "./components.jsx";

// First-login / whole-app tour (global elements).
export const GLOBAL_TOUR = [
  { sel: ".sidebar-nav", title: "Find your way around", body: "Every section lives in this sidebar — Assets, Stock, Reports, Users and more.", place: "right" },
  { sel: ".topbar-search", title: "Search anything", body: "Jump to any employee or asset by name, full name, tag, CPU or RAM. Press ⌘K from anywhere.", place: "bottom" },
  { sel: ".bell-wrap", title: "Stay on top of alerts", body: "Overdue returns, license renewals, low stock and SLA breaches surface here.", place: "bottom" },
  { sel: ".topbar-help", title: "Help, always one click away", body: "The ? opens a full plain-language guide to every feature for your role.", place: "bottom" },
  { sel: ".page-guide-btn", title: "Per-page guide", body: "Every page has its own ? — click it for a short tour of just that screen.", place: "bottom" },
  { sel: ".stats", title: "Your dashboard", body: "The headline numbers. Click any tile to drill into the exact machines behind it.", place: "top" },
  { sel: ".topbar-cta", title: "Add & assign assets", body: "Register or assign a machine here. On the Assets page you can also Import from Excel (grab the Template first).", place: "bottom" },
];

// Per-page tours — each targets elements on that page. Steps whose target is absent are skipped.
export const PAGE_TOURS = {
  Dashboard: [
    { sel: ".stats", title: "Key metrics", body: "Your headline numbers — Low Stock, Renewals, Utilization and more. Click any tile to see the machines behind it.", place: "top" },
    { sel: ".table-card", title: "Asset register preview", body: "A quick look at recent machines. Use the sidebar → Assets for the full list.", place: "top" },
  ],
  Assets: [
    { sel: ".table-toolbar", title: "Filter & sort", body: "Narrow by department or type, and click any column header to sort.", place: "bottom" },
    { sel: ".io-toolbar", title: "Import / Export / Template", body: "Bulk-load from Excel. Download the Template first, fill it, then Import (you'll preview before committing). Export pulls the whole register.", place: "bottom" },
    { sel: ".data-table", title: "Open any machine", body: "Click a row for its detail card — Specs, full change History, and Repairs.", place: "top" },
  ],
  Employees: [
    { sel: ".emp-grid", title: "Who has what", body: "Every person and the machine assigned to them. Click a card to open the asset.", place: "top" },
  ],
  Departments: [
    { sel: ".dept-grid", title: "Fleet by department", body: "Each department's machine count. Click a card for its stats — people, dual-monitor count, and peripheral coverage %.", place: "top" },
    { sel: ".dept-card-actions", title: "Manage departments", body: "Admins Edit (rename/recolour) or Delete a department here, and Add one up top — new ones appear in every dropdown instantly. A department must be empty before it can be deleted.", place: "top" },
  ],
  "Stock Overview": [
    { sel: ".stats", title: "What you hold", body: "Counts of machines, spares, consumables and more. Every tile is clickable.", place: "top" },
    { sel: ".inv-grid", title: "Breakdowns", body: "By processor, memory, storage, department… click any bar to list those exact machines.", place: "top" },
  ],
  "Stock Operations": [
    { sel: ".drawer-tabs", title: "Store-room tabs", body: "Stock, Spare Hardware, Defective Items (log faults → Record replacement to close them), Movements, Suppliers, Categories — and Peripherals, where you add your own types.", place: "bottom" },
    { sel: ".table-card", title: "Receive, issue, adjust", body: "Manage stock levels and reorder points here. Every change is logged under Movements. If a stock item is named like a peripheral, assigning that peripheral to a machine auto-deducts it.", place: "top" },
  ],
  Alerts: [
    { sel: ".alert-section", title: "Things needing action", body: "Overdue returns, renewals due, low stock and SLA-breached repairs — grouped so nothing slips.", place: "top" },
  ],
  Repairs: [
    { sel: ".repair-list", title: "Repair tickets", body: "Open, track and close repairs against an asset, with cost and resolution.", place: "top" },
  ],
  Software: [
    { sel: ".sw-grid", title: "Licenses & seats", body: "Each license shows seats used vs total (red when full). Assign seats to people; Export the list to Excel.", place: "top" },
  ],
  Reports: [
    { sel: ".report-kpis", title: "Fleet at a glance", body: "Totals, dual-monitor count, average coverage. Click any KPI to drill into the machines.", place: "bottom" },
    { sel: ".report-grid", title: "Composition", body: "Processor, memory and peripheral coverage by department — every bar is clickable.", place: "top" },
    { sel: ".gap-grid", title: "Equipment gaps", body: "Where kits are incomplete. Click a gap to see exactly which machines to fix.", place: "top" },
  ],
  "Audit Log": [
    { sel: ".audit-filters", title: "Filter the history", body: "Narrow the activity feed by what you're after.", place: "bottom" },
    { sel: ".audit-feed", title: "Who did what, when", body: "A time-stamped record of every change. Export it to Excel for your records.", place: "top" },
  ],
  Users: [
    { sel: ".users-grid", title: "Team accounts", body: "Everyone with access and their role.", place: "top" },
    { sel: ".user-card", title: "Manage a user", body: "Admins can Edit, reset Password, or Deactivate. New users set a fresh password at first sign-in.", place: "top" },
  ],
};

export function GuidedTour({ open, onClose, steps: stepSet = GLOBAL_TOUR }) {
  const [steps, setSteps] = useState([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  // when opened, keep only steps whose target is actually on screen
  useEffect(() => {
    if (!open) return;
    setSteps((stepSet || GLOBAL_TOUR).filter((s) => document.querySelector(s.sel)));
    setI(0);
  }, [open, stepSet]);

  const measure = useCallback(() => {
    const s = steps[i];
    const el = s && document.querySelector(s.sel);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps, i]);

  useEffect(() => {
    if (!open || !steps.length) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, steps, i, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, steps.length, onClose]);

  if (!open || !steps.length) return null;
  const step = steps[i];
  const last = i === steps.length - 1;
  const pad = 6;

  // popover placement relative to the highlighted rect, clamped to the viewport
  let pop = { top: 0, left: 0 };
  if (rect) {
    const W = 300, vw = window.innerWidth, vh = window.innerHeight;
    const place = step.place || "bottom";
    if (place === "right") { pop = { top: rect.top, left: Math.min(rect.left + rect.width + 14, vw - W - 12) }; }
    else if (place === "top") { pop = { top: Math.max(rect.top - 150, 12), left: rect.left }; }
    else { pop = { top: Math.min(rect.top + rect.height + 14, vh - 170), left: rect.left }; }
    pop.left = Math.max(12, Math.min(pop.left, vw - W - 12));
  }

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-label="Guided tour">
      {rect ? (
        <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : <div className="tour-dim" onClick={onClose} />}
      <div className="tour-pop" style={{ top: pop.top, left: pop.left }}>
        <div className="tour-pop-head">
          <span className="tour-step-count">{i + 1} / {steps.length}</span>
          <button type="button" className="tour-skip" onClick={onClose}>Skip</button>
        </div>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>
        <div className="tour-foot">
          <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => setI((x) => Math.max(x - 1, 0))}>
            Back
          </button>
          {last ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              <Icon d={ICONS.check} size={13} /> Done
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setI((x) => Math.min(x + 1, steps.length - 1))}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
