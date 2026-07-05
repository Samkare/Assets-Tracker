// Task Source — IT Asset Tracker · main app (wired to the API instead of window globals)
import React, { useState, useRef, useMemo, useEffect, Suspense, lazy } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import { useConfirm } from "./confirm.jsx";
import { useToast } from "./toasts.jsx";
import {
  useAssets, useAudit, useUsers, useReportSummary, useAlerts, useDepartments,
  useCreateAsset, useUpdateAsset, useRemoveAsset, useRestoreAsset, usePref, useSetPref
} from "./api/hooks.js";
import { api } from "./api/client.js";
import { ASSET_TYPES, DEPARTMENTS } from "@its/shared/constants";
import { Icon, ICONS, Sidebar, StatCard, FilterDropdown, useIsMobile } from "./components.jsx";
import {
  DetailDrawer, AssignModal, AssetTable, AssetCardList, EmployeesGrid, VIEW_COLUMNS, EmptyState
} from "./views.jsx";
import {
  coverageOf, DashboardInsights, DepartmentsPage, ReportsPage, AuditLogPage, UsersPage
} from "./pages.jsx";
import { LoginScreen } from "./login.jsx";
import { BellDropdown } from "./BellDropdown.jsx";
import { HelpPanel } from "./HelpPanel.jsx";
import { GuidedTour, GLOBAL_TOUR, PAGE_TOURS } from "./GuidedTour.jsx";
import { PerfPanels } from "./PerfPanels.jsx";
import { SkeletonTable, useDelayedFlag } from "./Skeleton.jsx";
// code-split: these load only when their page opens (smaller initial bundle)
const RepairsPage = lazy(() => import("./pages-repairs.jsx").then((m) => ({ default: m.RepairsPage })));
const SoftwarePage = lazy(() => import("./pages-software.jsx").then((m) => ({ default: m.SoftwarePage })));
const AlertsPage = lazy(() => import("./pages-alerts.jsx").then((m) => ({ default: m.AlertsPage })));
const ConsumablesPage = lazy(() => import("./pages-consumables.jsx").then((m) => ({ default: m.ConsumablesPage })));
const TrendsCharts = lazy(() => import("./pages-trends.jsx").then((m) => ({ default: m.TrendsCharts })));
const InventoryPage = lazy(() => import("./pages-inventory.jsx").then((m) => ({ default: m.InventoryPage })));
const PurchaseRequestsPage = lazy(() => import("./pages-purchase-requests.jsx").then((m) => ({ default: m.PurchaseRequestsPage })));
const PurchaseOrdersPage = lazy(() => import("./pages-purchase-orders.jsx").then((m) => ({ default: m.PurchaseOrdersPage })));
import {
  TweaksPanel, TweakSection, TweakColor, TweakToggle, useTweaks
} from "./tweaks-panel.jsx";
import { ImportExportBar } from "./io-panel.jsx";
import { ForceReset } from "./force-reset.jsx";

// tilt3d on — but only DISPLAY cards keep the `tilt-3d` class (stat/report/dept/user/emp).
// Forms, modals, drawers, and cards with inner buttons stay flat so clicks never miss.
const TWEAK_DEFAULTS = { accent: "#475569", zebra: true, tilt3d: true };

function sortVal(a, key) {
  if (key === "monitors") return { "Dual": 0, "Single": 1, "—": 2 }[a.monitors];
  if (key === "pseudo") return a.shared ? "￿" : (a.pseudo || "").toLowerCase();
  const v = a[key];
  if (v == null || v === "") return "￿";
  return v.toString().toLowerCase();
}

// pin/unpin dashboard tiles per user
function PinnableTiles({ stats, summary, totalInventory, assets, onOpenDept, onNav }) {
  const lowStock   = summary.lowStockCount ?? 0;
  const renewals   = summary.softwareRenewals ?? 0;
  const util       = summary.utilization ?? 0;
  // attach the right "good direction" to each metric's Δ-vs-last-week (from summary.trends)
  const tr = summary.trends || {};
  const trend = (key, good) => (tr[key] ? { ...tr[key], good } : undefined);
  // procurement metrics
  const pendingPRs = summary.pendingPRs ?? 0;
  const openPOs = summary.openPOs ?? 0;
  const fmtINR = (v) => {
    const n = Number(v) || 0;
    if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + "Cr";
    if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + "L";
    return "₹" + n.toLocaleString("en-IN");
  };

  // Tiles are ordered most-actionable first. Each "ops" tile turns red (tone:danger) only
  // when its number is non-zero — a green/neutral board means nothing needs attention.
  const tiles = [
    { id: "lowStock",      props: { label: "Low Stock", value: lowStock, sub: lowStock ? "items to reorder" : "all above reorder level", icon: ICONS.hdd, ring: 168, tone: lowStock ? "danger" : undefined, trend: trend("lowStock", false), onClick: () => onNav("Stock Overview") } },
    { id: "renewals",      props: { label: "Software Renewals", value: renewals, sub: "due in 60 days", icon: ICONS.diamond, ring: 272, tone: renewals ? "warn" : undefined, trend: trend("softwareRenewals", false), onClick: () => onNav("Software") } },
    { id: "spares",        props: { label: "Spares in Store", value: summary.spares ?? 0, sub: "ready to deploy", icon: ICONS.assets, ring: 240, trend: trend("spares", true), onClick: () => onNav("Assets") } },
    { id: "utilization",   props: { label: "Fleet Utilization", value: util + "%", sub: `${stats.assigned} of ${totalInventory} assigned`, accent: true, icon: ICONS.departments, ring: 168, trend: trend("utilization", true) } },
    // procurement tiles
    { id: "pendingPRs",    props: { label: "Pending PR Approvals", value: pendingPRs, sub: pendingPRs ? "awaiting a decision" : "all cleared", icon: ICONS.template, ring: 272, tone: pendingPRs ? "warn" : undefined, onClick: () => onNav("Purchase Requests", "Pending") } },
    { id: "openPOs",       props: { label: "Open POs", value: openPOs, sub: "draft or sent to vendor", icon: ICONS.mail, ring: 210, onClick: () => onNav("Purchase Orders", "Open") } },
    { id: "monthSpend",    props: { label: "This Month's Spend", value: fmtINR(summary.monthPOSpend ?? 0), sub: "PO grand totals", icon: ICONS.reports, ring: 140, onClick: () => onNav("Purchase Orders") } },
    // context tiles — org snapshot, not action triggers
    { id: "assets",        props: { label: "Total Assets Assigned", value: stats.assigned, sub: `of ${totalInventory} in inventory`, icon: ICONS.assets, ring: 240, onClick: () => onNav("Assets") } },
    { id: "employees",     props: { label: "Total Employees", value: stats.employees, sub: "with a machine", icon: ICONS.employees, ring: 168, onClick: () => onNav("Employees") } },
    { id: "departments",   props: { label: "Departments", value: stats.depts, sub: "across the org", icon: ICONS.departments, ring: 28, onClick: () => onNav("Departments") } }
  ];
  return (
    <React.Fragment>
      <div className="stats">
        {tiles.map((t) => <StatCard key={t.id} {...t.props} />)}
      </div>
      <DashboardInsights assets={assets} onOpenDept={onOpenDept} />
    </React.Fragment>
  );
}

export default function App() {
  const { user: currentUser, loading: authLoading, login, logout, can } = useAuth();
  const confirm = useConfirm();
  const canManage = can && can("IT-Manager");

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const isMobile = useIsMobile(860);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSteps, setTourSteps] = useState(GLOBAL_TOUR);
  const tourPrompted = useRef(false);
  const searchRef = useRef(null);

  // S2 — URL routing: map page <-> path slug
  const PAGE_TO_SLUG = {
    "Dashboard": "/", "Employees": "/employees", "Assets": "/assets", "Departments": "/departments",
    "Stock Overview": "/stock-overview", "Stock Operations": "/stock-operations",
    "Alerts": "/alerts", "Repairs": "/repairs", "Software": "/software",
    "Purchase Requests": "/purchase-requests",
    "Purchase Orders": "/purchase-orders",
    "Reports": "/reports", "Audit Log": "/audit-log", "Users": "/users"
  };
  const SLUG_TO_PAGE = Object.fromEntries(Object.entries(PAGE_TO_SLUG).map(([k, v]) => [v, k]));
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(() => SLUG_TO_PAGE[location.pathname] || "Dashboard");
  useEffect(() => {
    const p = SLUG_TO_PAGE[location.pathname];
    if (p && p !== page) setPage(p);
  }, [location.pathname]);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sort, setSort] = useState({ key: "pseudo", dir: 1 });
  const [selected, setSelected] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("assign");
  const [editing, setEditing] = useState(null);
  const { showToast, push: pushToast } = useToast();

  // --- data ---
  const assetsQ = useAssets({}, !!currentUser);
  const auditQ = useAudit({}, !!currentUser);
  const usersQ = useUsers(!!currentUser && can && can("Admin"));
  const summaryQ = useReportSummary(!!currentUser);
  const summary = summaryQ.data || {};
  const alertsQ = useAlerts(!!currentUser);
  const alertCount = alertsQ.data?.count || 0;
  const deptsQ = useDepartments(!!currentUser);
  // live department names for dropdowns/filters (fall back to the seed list while loading)
  const deptNames = (deptsQ.data && deptsQ.data.length) ? deptsQ.data.map((d) => d.name) : DEPARTMENTS;

  const assets = assetsQ.data || [];
  const log = auditQ.data || [];
  const users = usersQ.data || [];

  const createM = useCreateAsset({ onSuccess: () => {} });
  const updateM = useUpdateAsset();
  const removeM = useRemoveAsset();
  const restoreM = useRestoreAsset();

  // First-login guided tour — auto-run once, then remember via the tourSeen pref.
  const tourSeenQ = usePref("tourSeen", !!currentUser);
  const setTourSeen = useSetPref("tourSeen");
  useEffect(() => {
    if (currentUser && tourSeenQ.isSuccess && !tourSeenQ.data && !tourPrompted.current) {
      tourPrompted.current = true;
      const t = setTimeout(() => { setTourSteps(GLOBAL_TOUR); setTourOpen(true); }, 700); // let the dashboard paint first
      return () => clearTimeout(t);
    }
  }, [currentUser, tourSeenQ.isSuccess, tourSeenQ.data]);
  const endTour = () => { setTourOpen(false); setTourSeen.mutate(true); };
  const startTour = (steps) => { setHelpOpen(false); tourPrompted.current = true; setTourSteps(steps || GLOBAL_TOUR); setTourOpen(true); };

  // ⌘K focus search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); searchRef.current && searchRef.current.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 3D card tilt
  useEffect(() => {
    if (!t.tilt3d) return;
    // S3 — skip tilt on touch devices + reduced-motion (CSS already honors it, this skips the JS work too)
    if (typeof window.matchMedia === "function") {
      if (window.matchMedia("(pointer: coarse)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    }
    let current = null;
    const reset = (el) => { if (el) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); el.style.removeProperty("--tz"); el.style.removeProperty("--gx"); el.style.removeProperty("--gy"); el.classList.remove("tilt-live"); } };
    const onMove = (e) => {
      const card = e.target.closest && e.target.closest(".tilt-3d");
      if (card !== current) { reset(current); current = card; if (card) card.classList.add("tilt-live"); }
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      const max = 11;
      card.style.setProperty("--rx", (px * max).toFixed(2) + "deg");
      card.style.setProperty("--ry", (-py * max).toFixed(2) + "deg");
      card.style.setProperty("--tz", "22px");
      card.style.setProperty("--gx", ((px + 0.5) * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", ((py + 0.5) * 100).toFixed(1) + "%");
    };
    const onLeaveDoc = () => { reset(current); current = null; };
    document.addEventListener("pointermove", onMove);
    window.addEventListener("blur", onLeaveDoc);
    return () => { reset(current); document.removeEventListener("pointermove", onMove); window.removeEventListener("blur", onLeaveDoc); };
  }, [t.tilt3d, page]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = assets.filter((a) => {
      if (deptFilter !== "All" && a.dept !== deptFilter) return false;
      if (typeFilter !== "All" && a.type !== typeFilter) return false;
      if (q) {
        const hay = [a.pseudo, a.fullName, a.id, a.dept, a.cpu, a.ram].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows.sort((x, y) => {
      const a = sortVal(x, sort.key), b = sortVal(y, sort.key);
      if (a < b) return -1 * sort.dir;
      if (a > b) return 1 * sort.dir;
      return 0;
    });
    return rows;
  }, [assets, query, deptFilter, typeFilter, sort]);

  const stats = useMemo(() => {
    const assigned = assets.filter((a) => !a.shared).length;
    const employees = new Set(assets.filter((a) => !a.shared).map((a) => a.pseudo)).size;
    const depts = new Set(assets.map((a) => a.dept)).size;
    const coverage = coverageOf(assets);
    return { assigned, employees, depts, coverage };
  }, [assets]);

  const totalInventory = assets.length;
  const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 });
  const clearAll = () => { setQuery(""); setDeptFilter("All"); setTypeFilter("All"); };
  const anyFilter = query.trim() || deptFilter !== "All" || typeFilter !== "All";

  // optional filter carried to a procurement page (e.g. dashboard "Pending PR Approvals" tile).
  // Cleared on any navigation without an explicit filter, so sidebar nav always lands on "All".
  const [procFilter, setProcFilter] = useState(null);
  const navTo = (p, filter) => {
    setProcFilter(filter ?? null);
    setPage(p);
    const slug = PAGE_TO_SLUG[p];
    if (slug && slug !== location.pathname) navigate(slug);
    if (p === "Assets") setSort({ key: "id", dir: 1 });
    else if (p === "Employees" || p === "Dashboard") setSort({ key: "pseudo", dir: 1 });
  };

  const handleSelect = (a, i) => { setSelected(a); setSelectedKey(a.id + "-" + i); };
  const closeDrawer = () => { setSelected(null); setSelectedKey(null); };

  const openCreate = (mode) => { if (!canManage) return showToast("Read-only — ask an IT Manager"); setEditing(null); setModalMode(mode); setModalOpen(true); };
  const openEdit = (a) => { if (!canManage) return showToast("Read-only — ask an IT Manager"); setEditing(a); setModalMode("edit"); setModalOpen(true); closeDrawer(); };

  // form -> API input (server recomputes shared/monitors + writes audit)
  const formToInput = (form) => ({
    id: (form.id || "").trim(),
    pseudo: (form.pseudo || "").trim(),
    fullName: (form.fullName || "").trim() || null,
    dept: form.dept, type: form.type,
    cpu: form.cpu, ram: form.ram, hdd: form.hdd,
    mon1: form.mon1, mon2: form.mon2,
    whatsapp: form.whatsapp, nextiva: form.nextiva,
    returnDue: (form.returnDue || "").trim() || null,
    headphone: !!form.headphone, speaker: !!form.speaker, ipPhone: !!form.ipPhone,
    webcam: !!form.webcam, mobileStand: !!form.mobileStand,
    keyboard: !!form.keyboard, mouse: !!form.mouse,
    customPeripherals: Array.isArray(form.customPeripherals) ? form.customPeripherals : []
  });

  const handleSubmit = (form) => {
    const input = formToInput(form);
    if (editing) {
      updateM.mutate({ id: editing.id, input }, {
        onSuccess: (a) => { setModalOpen(false); setEditing(null); showToast(`${a.id} updated`, "success"); },
        onError: (e) => showToast(e.message, "error")
      });
    } else {
      createM.mutate(input, {
        onSuccess: (a) => { setModalOpen(false); showToast(`${a.id} ${a.shared ? "added" : "assigned to " + a.pseudo}`, "success"); },
        onError: (e) => showToast(e.message, "error")
      });
    }
  };

  const handleRemove = async (a) => {
    if (!canManage) return showToast("Read-only — ask an IT Manager");
    const ok = await confirm({
      title: `Retire ${a.id}?`,
      body: `${a.shared ? "This machine" : a.pseudo + "'s machine"} will be retired (archived). History is kept and it can be restored later.`,
      confirmLabel: "Retire"
    });
    if (!ok) return;
    removeM.mutate(a.id, {
      onSuccess: () => {
        closeDrawer();
        pushToast({
          title: `${a.id} retired`,
          body: a.pseudo ? `from ${a.pseudo}` : "removed from register",
          tone: "success", ttl: 8000,
          action: { label: "Undo", onClick: () => restoreM.mutate(a.id) }
        });
      },
      onError: (e) => showToast(e.message, "error")
    });
  };

  const openDeptFilter = (d) => { setDeptFilter(d); navTo("Assets"); };
  const previewRows = filtered.slice(0, 7);

  // --- gates ---
  if (authLoading) {
    return <div className="app" style={{ "--accent": TWEAK_DEFAULTS.accent }}><div style={{ padding: 40 }}>Loading…</div></div>;
  }
  if (!currentUser) {
    return (
      <div className="app" style={{ "--accent": t.accent }}>
        <LoginScreen onLogin={async ({ email, password }) => { await login(email, password); }} />
      </div>);
  }

  return (
    <div className={"app" + (t.zebra ? " zebra" : "") + (t.tilt3d ? " tilt-on" : "")} style={{ "--accent": t.accent }}>
      {currentUser.mustReset ? <ForceReset onDone={() => window.location.reload()} /> : null}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="topbar">
        <button type="button" className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Icon d={ICONS.menu} size={18} />
        </button>
        <div className="topbar-title"><img className="topbar-logo" src="/logo.png" alt="Task Source — IT Asset Tracker" /></div>
        <div className="topbar-search">
          <Icon d={ICONS.search} size={15} />
          <input ref={searchRef} className="search-input" placeholder="Search by employee or asset tag…"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
          {query ?
            <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon d={ICONS.close} size={12} />
            </button> :
            <kbd className="kbd-hint">⌘K</kbd>}
        </div>
        <div className="topbar-actions">
          <button type="button" className="topbar-util topbar-help" onClick={() => setHelpOpen(true)} aria-label="Help &amp; guide" title="Help &amp; guide">
            <Icon d={ICONS.help} size={17} />
          </button>
          <BellDropdown onNavigate={navTo} />
          <span className="topbar-div"></span>
          {canManage ?
            <button type="button" className="btn btn-primary topbar-cta" onClick={() => openCreate("assign")}>
              <Icon d={ICONS.plus} size={14} />
              <span className="topbar-cta-text">Assign Asset</span>
            </button> : null}
        </div>
      </header>

      <div className="shell">
        <Sidebar active={page} onNavigate={navTo} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          counts={{
            Employees: stats.employees, Assets: assets.length, Departments: stats.depts,
            "Audit Log": log.length, Users: users.length, Alerts: alertCount,
            Repairs: summary.openRepairs || 0,
            Software: summary.softwareRenewals || 0,
            "Stock Overview": summary.lowStockCount || 0
          }}
          user={currentUser} onLogout={logout} />

        <main className="main" id="main-content" data-screen-label={page}>
          {PAGE_TOURS[page] ? (
            <button type="button" className="page-guide-btn" title={`Guide for ${page}`} aria-label={`Guide for ${page}`}
              onClick={() => startTour(PAGE_TOURS[page])}>
              <Icon d={ICONS.help} size={16} />
            </button>
          ) : null}
          <div className="page-enter" key={page}>
            <Suspense fallback={<div style={{ padding: 32, color: "var(--text-3)" }}>Loading…</div>}>
            {page === "Departments" ?
              <DepartmentsPage assets={assets} canAdmin={can && can("Admin")} onOpenDept={openDeptFilter}
                onSelectAsset={(a) => { setSelected(a); setSelectedKey(a.id + "-dept"); }} /> :
              page === "Reports" ?
                <React.Fragment><ReportsPage assets={assets} departments={deptNames} /><PerfPanels /><TrendsCharts /></React.Fragment> :
                page === "Audit Log" ?
                  <AuditLogPage log={log} query={query} /> :
                  page === "Users" ?
                    <UsersPage users={users} log={log} canAdmin={can && can("Admin")} /> :
                  page === "Repairs" ?
                    <RepairsPage canManage={canManage} /> :
                  page === "Software" ?
                    <SoftwarePage canManage={canManage} /> :
                  page === "Alerts" ?
                    <AlertsPage /> :
                  page === "Stock Operations" ?
                    <ConsumablesPage canManage={canManage} /> :
                  page === "Stock Overview" ?
                    <InventoryPage /> :
                  page === "Purchase Requests" ?
                    <PurchaseRequestsPage canManage={canManage} canAdmin={can && can("Admin")} initialFilter={procFilter} /> :
                  page === "Purchase Orders" ?
                    <PurchaseOrdersPage canManage={canManage} canAdmin={can && can("Admin")} initialFilter={procFilter} /> :
                    <React.Fragment>
                      <div className="page-head">
                        <h1 className="page-title">{page}</h1>
                        <p className="page-caption">
                          {page === "Dashboard" ? "Equipment assignments across Task Source" :
                            page === "Employees" ? "Every employee and their assigned machine" :
                              "Full hardware register — specs and assignment"}
                        </p>
                      </div>

                      {page === "Dashboard" ?
                        <PinnableTiles stats={stats} summary={summary} totalInventory={totalInventory}
                          assets={assets} onOpenDept={openDeptFilter} onNav={navTo} /> : null}

                      <div className="table-card">
                        <div className="table-toolbar">
                          <div className="table-toolbar-title">
                            {page === "Dashboard" ? "Asset register" : page}
                            <span className="count-chip">{filtered.length}</span>
                            <span className="count-total">of {totalInventory} assets</span>
                          </div>
                          <div className="table-filters">
                            {page === "Dashboard" ?
                              <button type="button" className="view-all-link" onClick={() => navTo("Assets")}>
                                View all assets <Icon d={ICONS.chevDown} size={13} style={{ transform: "rotate(-90deg)" }} />
                              </button> :
                              <React.Fragment>
                                <FilterDropdown label="Department" value={deptFilter} options={deptNames} onChange={setDeptFilter} />
                                <FilterDropdown label="Type" value={typeFilter} options={ASSET_TYPES} onChange={setTypeFilter} />
                                {anyFilter ? <button type="button" className="clear-link" onClick={clearAll}>Clear</button> : null}
                                {page === "Assets" ? <ImportExportBar canManage={canManage} onToast={showToast} /> : null}
                                {canManage ?
                                  <button type="button" className="table-add-btn" onClick={() => openCreate(page === "Employees" ? "addEmployee" : "addAsset")}>
                                    <Icon d={ICONS.plus} size={13} />
                                    {page === "Employees" ? "Add Employee" : "Add Asset"}
                                  </button> : null}
                              </React.Fragment>}
                          </div>
                        </div>
                        {assetsQ.isLoading ? <div style={{ padding: "var(--sp-16)" }}><SkeletonTable rows={6} cols={6} /></div> :
                          assetsQ.isError ? (
                            <div className="empty-state">
                              <div className="empty-icon"><Icon d={ICONS.alert || ICONS.bell} size={20} /></div>
                              <div className="empty-title">Couldn’t load assets</div>
                              <div className="empty-sub">The server didn’t respond. Check your connection and try again.</div>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => assetsQ.refetch()} style={{ marginTop: "var(--sp-10)" }}>Retry</button>
                            </div>
                          ) :
                          filtered.length === 0 ? <EmptyState onClear={clearAll} /> :
                            page === "Employees" ? <EmployeesGrid rows={filtered} onSelect={handleSelect} /> :
                              isMobile ? <AssetCardList rows={page === "Dashboard" ? previewRows : filtered} onSelect={handleSelect} /> :
                                <AssetTable rows={page === "Dashboard" ? previewRows : filtered}
                                  cols={VIEW_COLUMNS[page]} sort={sort} onSort={toggleSort}
                                  onSelect={handleSelect} selectedId={selectedKey} />}
                        {page === "Dashboard" && filtered.length > previewRows.length ?
                          <button type="button" className="table-foot-link" onClick={() => navTo("Assets")}>
                            View all {filtered.length} assets →
                          </button> : null}
                      </div>
                    </React.Fragment>}
            </Suspense>
          </div>
        </main>
      </div>

      <DetailDrawer asset={selected} onClose={closeDrawer} canManage={canManage}
        onEdit={canManage ? openEdit : undefined} onRemove={canManage ? handleRemove : undefined}
        isPending={removeM.isPending} />
      <AssignModal open={modalOpen} mode={modalMode} initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }} onSubmit={handleSubmit}
        departments={deptNames} types={ASSET_TYPES} assets={assets}
        isPending={createM.isPending || updateM.isPending} />

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} role={currentUser?.role || "Viewer"} onStartTour={() => startTour(GLOBAL_TOUR)} />
      <GuidedTour open={tourOpen} onClose={endTour} steps={tourSteps} />

      {/* toast region rendered by ToastProvider */}

      {import.meta.env.DEV ?
        <TweaksPanel>
          <TweakSection label="Theme" />
          <TweakColor label="Accent" value={t.accent}
            options={["#475569", "#6E56CF", "#0E7490", "#4F46E5"]}
            onChange={(v) => setTweak("accent", v)} />
          <TweakSection label="Table" />
          <TweakToggle label="Zebra striping" value={t.zebra} onChange={(v) => setTweak("zebra", v)} />
          <TweakToggle label="3D card tilt" value={t.tilt3d} onChange={(v) => setTweak("tilt3d", v)} />
        </TweaksPanel> : null}
    </div>);
}
