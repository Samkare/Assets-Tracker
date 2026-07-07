// react-query hooks — replace the prototype's window.ASSETS / AUDIT_SEED / USERS globals.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client.js";

const qs = (params = {}) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "" && v !== "All") u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
};

export function useAssets(params = {}, enabled = true) {
  return useQuery({ queryKey: ["assets", params], queryFn: () => api.get(`/assets${qs(params)}`), enabled });
}
export function useDepartments(enabled = true) {
  return useQuery({ queryKey: ["departments"], queryFn: () => api.get("/departments"), enabled });
}
function useDeptMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      opts?.onSuccess?.(...a);
    },
    onError: opts?.onError
  });
}
export const useCreateDepartment = (o) => useDeptMutation((b) => api.post("/departments", b), o);
export const useUpdateDepartment = (o) => useDeptMutation(({ id, input }) => api.put(`/departments/${id}`, input), o);
export const useDeleteDepartment = (o) => useDeptMutation((id) => api.del(`/departments/${id}`), o);
export function useEmployees(enabled = true) {
  return useQuery({ queryKey: ["employees"], queryFn: () => api.get("/employees"), enabled });
}
export function useAudit(params = {}, enabled = true) {
  return useQuery({ queryKey: ["audit", params], queryFn: () => api.get(`/audit${qs(params)}`), enabled });
}
export function useReportSummary(enabled = true) {
  return useQuery({ queryKey: ["reports", "summary"], queryFn: () => api.get("/reports/summary"), enabled });
}
export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: () => api.get("/users"), enabled });
}

// Admin user management (create / edit / reset password / deactivate).
function useUserMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["users"] }); opts?.onSuccess?.(...a); },
    onError: opts?.onError
  });
}
export const useCreateUser      = (o) => useUserMutation((b) => api.post("/users", b), o);
export const useUpdateUser      = (o) => useUserMutation(({ id, input }) => api.put(`/users/${id}`, input), o);
export const useDeleteUser      = (o) => useUserMutation((id) => api.del(`/users/${id}`), o);
export const useSetUserPassword = (o) => useUserMutation(({ id, password }) => api.post(`/users/${id}/password`, { password }), o);

// Mutations invalidate assets + audit (+ reports/departments) so the UI reflects server truth.
function useAssetMutation(fn, { onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      // peripheral↔stock linkage: a saved asset may have moved consumable stock
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["consumables"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      onSuccess && onSuccess(data, vars);
    }
  });
}

export const useCreateAsset = (opts) => useAssetMutation((input) => api.post("/assets", input), opts);
export const useUpdateAsset = (opts) => useAssetMutation(({ id, input }) => api.put(`/assets/${id}`, input), opts);
export const useRemoveAsset = (opts) => useAssetMutation((id) => api.del(`/assets/${id}`), opts);
export const useRepairAsset = (opts) => useAssetMutation(({ id, repair }) => api.post(`/assets/${id}/repair`, { repair }), opts);

// --- asset history ---
export function useAssetHistory(id, enabled = true) {
  return useQuery({ queryKey: ["assets", id, "history"], queryFn: () => api.get(`/assets/${id}/history`), enabled: enabled && !!id });
}

// --- Asset Assignment tab: stock items issued to the person on this machine ---
export function useAssignedItems(assetId, enabled = true) {
  return useQuery({ queryKey: ["assets", assetId, "items"], queryFn: () => api.get(`/assets/${assetId}/items`), enabled: enabled && !!assetId });
}
function useAssignmentMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      // ["assets"] prefix also covers the per-asset ["assets", id, "items"] list
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });   // stock qty changed
      qc.invalidateQueries({ queryKey: ["consumables"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });      // may cross a reorder threshold
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      opts?.onSuccess?.(data, vars);
    },
    onError: opts?.onError
  });
}
export const useAssignItem   = (o) => useAssignmentMutation(({ id, itemId, qty, note }) => api.post(`/assets/${id}/assign-item`, { itemId, qty, note }), o);
export const useUnassignItem = (o) => useAssignmentMutation(({ id, itemId, qty, destination, reason }) => api.post(`/assets/${id}/unassign-item`, { itemId, qty, destination, reason }), o);

// --- repairs ---
export function useRepairs(params = {}, enabled = true) {
  return useQuery({ queryKey: ["repairs", params], queryFn: () => api.get(`/repairs${qs(params)}`), enabled });
}
function useRepairMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      opts?.onSuccess?.(...a);
    }
  });
}
export const useOpenRepair = (opts) => useRepairMutation((b) => api.post("/repairs", b), opts);
export const useUpdateRepair = (opts) => useRepairMutation(({ id, input }) => api.put(`/repairs/${id}`, input), opts);

// --- software ---
export function useSoftware(enabled = true) {
  return useQuery({ queryKey: ["software"], queryFn: () => api.get("/software"), enabled });
}
function useSoftwareMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["software"] }); qc.invalidateQueries({ queryKey: ["reports"] }); opts?.onSuccess?.(...a); }
  });
}
// --- alerts ---
export function useAlerts(enabled = true) {
  return useQuery({ queryKey: ["alerts"], queryFn: () => api.get("/alerts"), enabled, refetchInterval: 5 * 60 * 1000 });
}

// --- trends ---
export function useTrends(enabled = true) {
  return useQuery({ queryKey: ["reports", "trends"], queryFn: () => api.get("/reports/trends"), enabled });
}

// --- bulk asset ops ---
export function useBulkAssets(opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action, payload }) => api.post("/assets/bulk", { ids, action, payload }),
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      opts?.onSuccess?.(...a);
    }
  });
}

// --- consumables ---
export function useConsumables(enabled = true) {
  return useQuery({ queryKey: ["consumables"], queryFn: () => api.get("/consumables"), enabled });
}
// Consumable WRITES intentionally removed — all stock mutations go through the /inventory
// hooks (useCreateItem/useReceiveStock/etc.) so every change is logged in stock_movements.
// /consumables is read-only now (useConsumables above) and Stock Overview reads from it.

export const useCreateSoftware = (opts) => useSoftwareMutation((b) => api.post("/software", b), opts);
export const useUpdateSoftware = (opts) => useSoftwareMutation(({ id, input }) => api.put(`/software/${id}`, input), opts);
export const useDeleteSoftware = (opts) => useSoftwareMutation((id) => api.del(`/software/${id}`), opts);
export const useAssignSoftware = (opts) => useSoftwareMutation(({ id, input }) => api.post(`/software/${id}/assignments`, input), opts);
export const useUnassignSoftware = (opts) => useSoftwareMutation(({ id, aid }) => api.del(`/software/${id}/assignments/${aid}`), opts);

// ===== Inventory Management =====
export function useInventory(params = {}, enabled = true) {
  return useQuery({ queryKey: ["inventory", params], queryFn: () => api.get(`/inventory${qs(params)}`), enabled });
}
export function useInventoryItem(id, enabled = true) {
  return useQuery({ queryKey: ["inventory", "item", id], queryFn: () => api.get(`/inventory/${id}`), enabled: enabled && !!id });
}
export function useInventoryValuation(enabled = true) {
  return useQuery({ queryKey: ["inventory", "valuation"], queryFn: () => api.get("/inventory/valuation"), enabled });
}
export function useStockMovements(params = {}, enabled = true) {
  return useQuery({ queryKey: ["inventory", "movements", params], queryFn: () => api.get(`/inventory/movements${qs(params)}`), enabled });
}
export function useDefective(params = {}, enabled = true) {
  return useQuery({ queryKey: ["inventory", "defective", params], queryFn: () => api.get(`/inventory/defective${qs(params)}`), enabled });
}
function useInvMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      opts?.onSuccess?.(...a);
    }
  });
}
export const useCreateItem  = (o) => useInvMutation((b) => api.post("/inventory", b), o);
export const useUpdateItem  = (o) => useInvMutation(({ id, input }) => api.put(`/inventory/${id}`, input), o);
export const useDeleteItem  = (o) => useInvMutation((id) => api.del(`/inventory/${id}`), o);
// Optimistic stock mutation: bump qty immediately, rollback on error.
function useStockMutation(deltaFn, urlPath, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => api.post(`/inventory/${id}/${urlPath}`, input),
    onMutate: async ({ id, input }) => {
      const delta = deltaFn(input);
      await qc.cancelQueries({ queryKey: ["inventory"] });
      const snapshot = qc.getQueryData(["inventory", "item", id]);
      qc.setQueryData(["inventory", "item", id], (old) => old ? { ...old, qty: Math.max(0, (old.qty || 0) + delta) } : old);
      // also bump lists — HIGH-18: clamp qty floor at 0 BEFORE computing `low` so a negative
      // optimistic value can't read as "in stock".
      qc.setQueriesData({ queryKey: ["inventory"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((it) => {
          if (it.id !== id) return it;
          const nextQty = Math.max(0, (it.qty || 0) + delta);
          return { ...it, qty: nextQty, low: nextQty <= (it.reorderLevel || 0) };
        });
      });
      return { snapshot, id };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.snapshot && ctx.id) qc.setQueryData(["inventory", "item", ctx.id], ctx.snapshot);
      qc.invalidateQueries({ queryKey: ["inventory"] });
      opts?.onError?.(err, vars, ctx);
    },
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      opts?.onSuccess?.(...a);
    }
  });
}
export const useReceiveStock = (o) => useStockMutation((i) => Number(i.qty) || 0, "receive", o);
export const useIssueStock   = (o) => useStockMutation((i) => -(Number(i.qty) || 0), "issue", o);
export const useReturnStock  = (o) => useStockMutation((i) => Number(i.qty) || 0, "return", o);
export const useAdjustItem   = (o) => useStockMutation((i) => Number(i.delta) || 0, "adjust", o);

// suppliers
export function useSuppliers(enabled = true) {
  return useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers"), enabled });
}
function useSupMutation(fn, o) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["inventory"] }); o?.onSuccess?.(...a); } });
}
export const useCreateSupplier = (o) => useSupMutation((b) => api.post("/suppliers", b), o);
export const useUpdateSupplier = (o) => useSupMutation(({ id, input }) => api.put(`/suppliers/${id}`, input), o);
export const useDeleteSupplier = (o) => useSupMutation((id) => api.del(`/suppliers/${id}`), o);

// categories
export function useCategories(enabled = true) {
  return useQuery({ queryKey: ["categories"], queryFn: () => api.get("/categories"), enabled });
}
function useCatMutation(fn, o) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["inventory"] }); o?.onSuccess?.(...a); } });
}
export const useCreateCategory = (o) => useCatMutation((b) => api.post("/categories", b), o);
export const useUpdateCategory = (o) => useCatMutation(({ id, input }) => api.put(`/categories/${id}`, input), o);
export const useDeleteCategory = (o) => useCatMutation((id) => api.del(`/categories/${id}`), o);

// spare hardware (bridge to assets)
export function useSpares(enabled = true) {
  return useQuery({ queryKey: ["spares"], queryFn: () => api.get("/assets/spares"), enabled });
}
function useSpareMutation(fn, o) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["spares"] }); qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["reports"] }); o?.onSuccess?.(...a); } });
}
export const useSetInStock = (o) => useSpareMutation(({ id, inStock }) => api.put(`/assets/${id}/in-stock`, { inStock }), o);
export const useIssueSpare = (o) => useSpareMutation(({ id, input }) => api.post(`/assets/${id}/issue-spare`, input), o);

// === F1 Notifications (bell) ===
export function useNotifications(enabled = true) {
  return useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications"), enabled, refetchInterval: 60_000 });
}

// === Purchase Requests (PR module) ===
export function usePurchaseRequests(params = {}, enabled = true) {
  return useQuery({ queryKey: ["purchase-requests", params], queryFn: () => api.get(`/purchase-requests${qs(params)}`), enabled });
}
function usePRMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["purchase-requests"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      opts?.onSuccess?.(...a);
    },
    onError: opts?.onError
  });
}
export const useCreatePurchaseRequest = (o) => usePRMutation((b) => api.post("/purchase-requests", b), o);
export const useUpdatePurchaseRequest = (o) => usePRMutation(({ id, input }) => api.put(`/purchase-requests/${id}`, input), o);
export const useSetPRStatus           = (o) => usePRMutation(({ id, status }) => api.patch(`/purchase-requests/${id}/status`, { status }), o);
export const useDeletePurchaseRequest = (o) => usePRMutation((id) => api.del(`/purchase-requests/${id}`), o);

// === Purchase Orders (PO module) ===
export function usePurchaseOrders(params = {}, enabled = true) {
  return useQuery({ queryKey: ["purchase-orders", params], queryFn: () => api.get(`/purchase-orders${qs(params)}`), enabled });
}
function usePOMutation(fn, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-requests"] }); // a PR's "has active PO" state may change
      qc.invalidateQueries({ queryKey: ["audit"] });
      opts?.onSuccess?.(...a);
    },
    onError: opts?.onError
  });
}
export const useGeneratePO  = (o) => usePOMutation((b) => api.post("/purchase-orders", b), o);
export const useUpdatePO    = (o) => usePOMutation(({ id, input }) => api.put(`/purchase-orders/${id}`, input), o);
export const useSetPOStatus = (o) => usePOMutation(({ id, status }) => api.patch(`/purchase-orders/${id}/status`, { status }), o);
export const useDeletePO    = (o) => usePOMutation((id) => api.del(`/purchase-orders/${id}`), o);

// Full PO detail (line items + computed totals + attachments). Fetched when a PO modal opens.
export function usePurchaseOrder(id, enabled = true) {
  return useQuery({ queryKey: ["purchase-orders", "detail", id], queryFn: () => api.get(`/purchase-orders/${id}`), enabled: enabled && !!id });
}
export function useUploadPOAttachment(poId, opts) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => api.upload(`/purchase-orders/${poId}/attachments`, file),
    onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); opts?.onSuccess?.(...a); },
    onError: opts?.onError
  });
}
export const useDeletePOAttachment = (o) => usePOMutation((aid) => api.del(`/purchase-orders/attachments/${aid}`), o);

// === F2 User preferences ===
export function usePref(key, enabled = true) {
  return useQuery({ queryKey: ["pref", key], queryFn: () => api.get(`/prefs/${key}`).then((r) => r.value), enabled });
}
export function useSetPref(key) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value) => api.put(`/prefs/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pref", key] })
  });
}

// === F3 Asset templates ===
export function useTemplates(enabled = true) {
  return useQuery({ queryKey: ["templates"], queryFn: () => api.get("/templates"), enabled });
}
function useTplMut(fn, o) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["templates"] }); o?.onSuccess?.(...a); } });
}
export const useCreateTemplate = (o) => useTplMut((b) => api.post("/templates", b), o);
export const useUpdateTemplate = (o) => useTplMut(({ id, input }) => api.put(`/templates/${id}`, input), o);
export const useDeleteTemplate = (o) => useTplMut((id) => api.del(`/templates/${id}`), o);

// === Custom peripherals catalog ===
export function usePeripherals(enabled = true) {
  return useQuery({ queryKey: ["peripherals"], queryFn: () => api.get("/peripherals"), enabled });
}
function usePeriphMut(fn, o) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (...a) => { qc.invalidateQueries({ queryKey: ["peripherals"] }); qc.invalidateQueries({ queryKey: ["assets"] }); o?.onSuccess?.(...a); },
    onError: o?.onError
  });
}
export const useCreatePeripheral = (o) => usePeriphMut((b) => api.post("/peripherals", b), o);
export const useUpdatePeripheral = (o) => usePeriphMut(({ id, input }) => api.put(`/peripherals/${id}`, input), o);
export const useDeletePeripheral = (o) => usePeriphMut((id) => api.del(`/peripherals/${id}`), o);

// === F5 Tech performance, F6 Supplier performance ===
export function useTechPerformance(enabled = true) {
  return useQuery({ queryKey: ["reports", "tech-perf"], queryFn: () => api.get("/reports/tech-performance"), enabled });
}
export function useSupplierPerformance(enabled = true) {
  return useQuery({ queryKey: ["reports", "supplier-perf"], queryFn: () => api.get("/reports/supplier-performance"), enabled });
}

// S3 — restore retired asset (undo)
export function useRestoreAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/assets/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}
