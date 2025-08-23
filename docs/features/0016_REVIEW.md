### 0016 — Production Inventory UI — Code Review

#### Scope check vs plan

- Routes added per plan under `/inventory/production` are present:
```62:70:ui/src/App.tsx
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/inventory/production" element={<InventoryProduction />} />
                    <Route path="/inventory/production/items" element={<ProductionItemsTable />} />
                    <Route path="/inventory/production/items/:itemId" element={<ProductionItemDetail />} />
                    <Route path="/inventory/production/transactions/new" element={<CheckoutWizard />} />
                    <Route path="/inventory/production/reconciliation" element={<ReconciliationPage />} />
                    <Route path="/inventory/production/events" element={<EventConsole />} />
                    <Route path="/inventory/production/events/:eventId" element={<EventConsole />} />
```
- Landing page links to Production UI are present.
- Implemented pages/components:
  - `ProductionInventoryPage` with KPI placeholders and quick links.
  - `ProductionItemsTable` with basic search and View/Checkout actions.
  - `ProductionItemDetail` with Overview and Activity tabs.
  - `CheckoutWizard` basic checkout/checkin by qtyBase only.
  - `EventConsole`, `ReconciliationPage`, `ConsumablesCard` placeholders.
- Missing (planned but not implemented): Serials/Reservations/Maintenance tabs, Transfer dialog, Count Adjust dialog, Scan mode, Preset picker, Shortage panel.

#### API client alignment

- Client helpers from 0015 are exposed and used:
```652:676:ui/src/lib/serverComm.ts
export async function listInventoryTransactions(params?: { itemId?: string; locationId?: string; eventType?: string | string[]; from?: string; to?: string; limit?: number; order?: 'asc' | 'desc' }) {
  const query = new URLSearchParams();
  if (params?.itemId) query.set('itemId', params.itemId);
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.eventType) {
    const v = Array.isArray(params.eventType) ? params.eventType.join(',') : params.eventType;
    query.set('eventType', v);
  }
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.order) query.set('order', params.order);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/inventory/transactions${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<any[]>;
}

export async function getInventoryItemSummary(itemId: string, params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/inventory/items/${encodeURIComponent(itemId)}/summary${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<{ onHand: Array<{ locationId: string; lotId?: string | null; qtyBase: number }>; totals: { onHand: number; reserved: number; available: number } }>
}
```
```714:719:ui/src/lib/serverComm.ts
export async function listInventoryLocations(params?: { departmentId?: string }) {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set('department_id', params.departmentId);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/inventory/locations${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<InventoryLocationRecord[]>;
}
```
- Parameter naming matches the plan (`department_id` for locations). Good.

#### UI behavior and data usage

- Items list lacks planned columns and totals (On‑hand, Available, Locations count) and filters (item_type, Active):
```41:58:ui/src/features/inventory/production/ProductionItemsTable.tsx
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Active</th>
                <th className="p-2">Actions</th>
              </tr>
...
                    <Link to={`/inventory/production/items/${it.itemId}`}><Button size="sm">View</Button></Link>
                    <Link to={`/inventory/production/transactions/new?itemId=${encodeURIComponent(it.itemId)}`}><Button size="sm" variant="secondary">Checkout</Button></Link>
```
- Item detail implements Overview and Activity only; Reservations/Maintenance/Serials are not present yet:
```44:51:ui/src/features/inventory/production/ProductionItemDetail.tsx
          <div className="border-b flex gap-1 p-2">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
            <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>Activity</TabButton>
          </div>
          <div className="p-4">
            {activeTab === 'overview' && itemId && (<OverviewTab itemId={itemId} />)}
            {activeTab === 'activity' && itemId && (<ActivityTab itemId={itemId} />)}
```
- Overview uses `getInventoryItemSummary` correctly and renders totals/rows. Consider mapping `locationId` to names for readability.
```13:21:ui/src/features/inventory/production/tabs/OverviewTab.tsx
      try {
        const data = await getInventoryItemSummary(itemId);
        if (!cancelled) {
          setTotals(data.totals);
          setRows(data.onHand);
        }
```
- Activity uses `listInventoryTransactions` with default paging; no filters/pagination UI yet:
```12:16:ui/src/features/inventory/production/tabs/ActivityTab.tsx
      try {
        const data = await listInventoryTransactions({ itemId, limit: 100, order: 'desc' });
        if (!cancelled) setTxns(data);
```
- Event console and Reconciliation are placeholders:
```5:10:ui/src/features/inventory/production/EventConsole.tsx
      <Card>
        <CardContent className="p-4">
          Event-centric checkout/return (placeholder)
        </CardContent>
      </Card>
```

#### Posting flows and validation

- `CheckoutWizard` posts only `{ qtyBase }` and lacks `{ qty, unit }` support, transfers, and count adjust:
```16:23:ui/src/features/inventory/production/CheckoutWizard.tsx
  async function submit(eventType: 'MOVE_OUT' | 'MOVE_IN') {
    setSubmitting(true);
    setMessage(null);
    try {
      await postInventoryTransaction({ itemId, locationId, eventType, qtyBase, postedBy: 'me' } as any);
      setMessage('Posted');
    } catch (e: any) {
      setMessage(e?.message ?? 'Error');
```
- Note: `postedBy: 'me'` is likely incorrect; server should derive the user from auth, or UI should pass the actual userId if required. Hardcoding can misattribute postings.
- Error handling is minimal (inline message). Plan called for clear toasts and surfacing policy/unit conversion errors; not implemented yet.

#### Data alignment concerns

- Query parameter naming aligns with server: `department_id` (snake_case) for locations; others (`itemId`, `eventType`) use camelCase path/query as per server definitions. No nested `{data:{}}` shapes seen.
- Tables show raw identifiers (`locationId`, `lotId`) rather than names. Consider joining with `listInventoryLocations` for display.

#### Style, structure, and over‑engineering

- Components are small and focused. No over‑engineering detected.
- Consistent usage of ShadCN primitives and Tailwind classes.
- Some pages are placeholders; acceptable given phased plan, but acceptance criteria are not met yet.

#### Bugs and usability issues

- "Checkin" quick action on detail page routes to wizard without `itemId` param, resulting in an empty Item ID field. Should pass `?itemId=...` for both checkout and checkin.
- `CheckoutWizard` allows submitting with empty `itemId`/`locationId`/`qtyBase` (0). Should validate before posting and disable buttons accordingly.
- No pagination or "Load more" in Activity; can become heavy with large datasets.
- Lack of keyboard shortcuts and scan mode (planned) reduces production usability.

#### Acceptance criteria coverage

- Production routes render and navigation from Inventory landing exists. ✅
- Items list shows basic info and quick actions; does not show on‑hand/available totals or planned filters. ❌
- Item detail Overview/Activity implemented; no Reservations/Maintenance tabs yet. Partial ✅
- Posting flows: basic checkout/checkin only; no transfers/count adjust; `{ qty, unit }` not supported; minimal error handling. ❌
- Scan‑first operations: not implemented. ❌
- Event workflows, shortages, consumables card (real data), reconciliation: placeholders or missing. ❌

#### Recommendations (next steps)

1) Items list
   - Add columns: On‑hand, Available, Locations count using `getInventoryItemSummary` (batched or per‑row lazy fetch).
   - Add filters for `item_type` and Active.
2) Item detail
   - Add Reservations and Maintenance tabs; hide Serials tab for non‑serialized.
   - Map location IDs to names via `listInventoryLocations`.
3) Transactions
   - Extend wizard to support `{ qty, unit }`, Transfer (paired out/in with shared `sourceDoc`), and Count Adjust delta flow.
   - Replace `postedBy: 'me'` with server‑derived user or actual user ID.
   - Improve error handling with toasts and inline fields; surface server policy/unit conversion messages.
4) Activity
   - Add filters (date range, event types) and pagination ("Load more").
5) Scan‑first and event workflows
   - Implement global Scan Mode, Event Console real flows, and preset issuance.
6) Reconciliation and consumables
   - Wire data and propose `COUNT_ADJUST` deltas; implement low‑stock logic.

#### Overall

Solid start with routing, page shells, and two core data calls hooked up. To meet 0016 acceptance criteria, prioritize wiring totals/availability in list/detail, complete posting flows (including transfers/count adjust and unit conversions), and implement the remaining tabs and operational workflows.


