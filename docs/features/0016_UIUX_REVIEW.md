### 0016 — Production Inventory UI — UI/UX Review

#### Summary
- **Overall**: Routing and page shells match the plan. Core list/detail and activity views render and use ShadCN/Tailwind consistently. Several production-focused workflows are scaffolded but still placeholders.
- **Meets**: Inventory landing → Production navigation; Production routes; Items list with filters and summary totals; Item detail Overview and Activity; Transaction wizard covering checkout/checkin/transfer/count-adjust.
- **Gaps**: Reservations and Maintenance tabs are placeholders; Production dashboard KPIs show placeholders; Event console and Reconciliation are placeholders; no scan-first operations; no keyboard shortcuts; Overview lacks date range; default theme not forced to dark.

---

#### Navigation and Routing
- `ui/src/App.tsx`: Routes added per plan
  - `/inventory/production`, `/inventory/production/items`, `/inventory/production/items/:itemId`, `/inventory/production/transactions/new`, `/inventory/production/reconciliation`, `/inventory/production/events`, `/inventory/production/events/:eventId`.
  - Behavior: All routes render without errors and integrate with existing `Navbar`, `AppSidebar`, `SidebarInset` containers.
- `ui/src/pages/Inventory.tsx`: Clear CTA button linking to `/inventory/production` as specified.
- Recommendation: Add breadcrumb affordances on item detail for quicker back/forward within Production flows.

#### Production Dashboard (`ProductionInventoryPage`)
- Visual: KPI cards (“On-hand”, “Available”, “Recent Activity”) use consistent card style; spacing aligns with project conventions.
- Data: KPIs currently display placeholders (—). No data wiring yet.
- Actions: Quick links to Items, New Transaction, Event Console, and Reconciliation are present.
- Recommendation: Wire KPIs to `getInventoryItemSummary` (aggregated or scoped) and recent `listInventoryTransactions`; add loading skeletons.

#### Items List (`ProductionItemsTable`)
- Filters: Search (`q`), basic type field, and Active-only toggle present; debounced querying implemented.
- Table: Columns closely match plan (SKU, Name, Type, Active, On-hand, Available, Locations, Actions).
- Totals: On-hand/Available computed by fetching item summaries for first 25 items to avoid API spam — sensible; values show ellipses gracefully while loading.
- UX: Action buttons “View” and “Checkout” align with quick tasks.
- Recommendations:
  - Replace freeform “Type” input with a select for {ReturnableAsset, FixedAsset, Rental, Kit, Consumable}.
  - Add paging (or infinite scroll) and total count. Consider a small “fetch summaries” batch size control or background hydration.
  - Add a column for “Serialized?” when backend supports it; hide until then.

#### Item Detail (`ProductionItemDetail`) and Tabs
- Header: Shows name, SKU, type, base unit; quick actions (Checkout/Checkin) consistent with plan.
- Tabs: Overview and Activity implemented; Reservations and Maintenance are placeholders.
- Recommendation: Use a tab component from ShadCN for consistency and keyboard accessibility.

##### Overview (`OverviewTab`)
- Metrics: On-hand, Reserved, Available rendered as cards; on-hand table lists per-location/lot rows.
- Data: Uses `getInventoryItemSummary(itemId)` and loads locations for name mapping.
- Gaps:
  - Missing date range picker to drive windowed availability (`from/to`).
  - No skeleton/loading placeholders on the table (metrics do show loading state as ellipsis).
- Recommendations:
  - Add date inputs and debounce server calls; ensure window-aware availability reflects plan.
  - Add sorting by qty and optional location filtering (by `departmentId`) when needed.

##### Activity (`ActivityTab`)
- Filters: `from`, `to`, `eventTypes` (comma), “Load more” increases limit by 50; basic count shown.
- Data: Uses `listInventoryTransactions` with `order='desc'`; location name mapping loaded.
- UX: Table is clean; defaults are reasonable.
- Recommendations:
  - Format timestamps (“When”) for locale; add event badges/colors for readability.
  - Provide a fixed “Load more” footer state; consider cursor-based pagination feedback.

#### Transactions (`CheckoutWizard`)
- Coverage: Supports checkout (MOVE_OUT), checkin (MOVE_IN), transfer, and count adjust; allows `{ qtyBase }` or `{ qty, unit }`.
- UX: Inline message area shows success/error; inputs are grouped logically; uses standard components.
- Gaps:
  - Error messaging is generic; no toast feedback or differentiated policy vs. unit-conversion errors.
  - Transfer uses a single `TRANSFER` payload; the plan mentions paired out/in with a shared `sourceDoc`. Validate parity with server API.
- Recommendations:
  - Surface policy violations and conversion errors distinctly (e.g., destructive vs. warning toasts and inline field messages).
  - Add location pickers (with names) and item autocomplete/scan support; prefill from query string more fields where possible.

#### Event Console, Reconciliation, Consumables
- `EventConsole`: Placeholder only — plan calls for issue/return to a selected event and duplication of prior kits.
- `ReconciliationPage`: Placeholder — plan calls for comparing expected vs. scanned and proposing adjustments.
- `ConsumablesCard`: Placeholder — plan calls for low-stock against par levels.
- Recommendations:
  - Stub basic layouts now with empty states and action entry points to clarify intended flow.

#### Scan-first Operations & Shortcuts
- Scan Mode: Not present. Plan calls for a global scan input, focus management, and audible/visual feedback.
- Keyboard: Shortcuts (e.g., g i, g e, /, c, r) not implemented.
- Recommendations:
  - Introduce a `ScanModeToggle` with a globally focused input; show unobtrusive feedback (tone + flash) on success/error.
  - Add accessible keyboard shortcuts with help overlay; ensure conflicts are avoided in inputs.

#### Visual/Theme Consistency
- Components: Uses ShadCN `Card`, `Button`, `Input`; spacing and typography consistent.
- Theme: App `ThemeProvider` defaults to system. Plan requests default dark mode.
- Recommendation: Change default to dark (`defaultTheme="dark"`) and keep system toggle via user settings if desired.

#### Accessibility
- Inputs and labels: Generally adequate; ensure checkbox has an explicit label association.
- Tables: Provide `scope="col"` on headers and consider row hover focus outlines.
- Tabs: Use ARIA roles/keyboard navigation if replacing custom buttons with a Tab component.

#### Performance & Loading
- Debounce: Implemented for query; good.
- Summaries hydration: Batches first 25 — sensible. No pagination yet.
- Loading states: Metrics and tables could benefit from skeletons. Activity “Load more” is simple and effective.

---

### Compliance with Acceptance Criteria (0016)
- Production pages and routes render: **Met**.
- Items list with totals/filters and actions: **Partially Met** (filters OK; totals OK; type should be select; no pagination).
- Item detail Overview with windowed availability + Activity with filters/pagination: **Partially Met** (Overview missing date range; Activity OK with basic pagination).
- Reservations tab and Maintenance tab workflows: **Not Met** (placeholders).
- Transactions (qtyBase or qty/unit) with error handling: **Partially Met** (basic success/error; lacks detailed policy/unit-conversion messaging).
- Scan-first operations: **Not Met**.
- Event workflows (quick issue/return, duplicate previous, partial returns): **Not Met** (placeholder).
- Shortage warnings and alternative locations at post time: **Not Met**.
- Consumables card low-stock view: **Not Met** (placeholder).
- Reconciliation page: **Not Met** (placeholder).
- Usability: dark default, shortcuts, mobile dialogs: **Partially Met** (mobile-friendly cards/tables; default theme not dark; no shortcuts).

---

### Priority Recommendations
1) Add date range picker and debounce to `OverviewTab`; wire windowed availability.
2) Implement typed filter select in Items table; add pagination and skeletons.
3) Enhance `CheckoutWizard` error handling with toasts and inline messages; validate transfer parity with server API; add pickers.
4) Implement global Scan Mode with audible/visual feedback; add keyboard shortcuts and a help overlay.
5) Switch app default theme to dark.
6) Flesh out Reservations and Maintenance tabs (list/create/release; maintenance start/end with notes).
7) Define MVP scopes for Event Console, Reconciliation, and Consumables and implement empty state flows, then iterate.

---

#### Notable Files Reviewed
- `ui/src/App.tsx`
- `ui/src/pages/Inventory.tsx`
- `ui/src/pages/InventoryProduction.tsx`
- `ui/src/features/inventory/production/ProductionInventoryPage.tsx`
- `ui/src/features/inventory/production/ProductionItemsTable.tsx`
- `ui/src/features/inventory/production/ProductionItemDetail.tsx`
- `ui/src/features/inventory/production/tabs/OverviewTab.tsx`
- `ui/src/features/inventory/production/tabs/ActivityTab.tsx`
- `ui/src/features/inventory/production/CheckoutWizard.tsx`
- `ui/src/features/inventory/production/EventConsole.tsx`
- `ui/src/features/inventory/production/ReconciliationPage.tsx`
- `ui/src/features/inventory/production/cards/ConsumablesCard.tsx`
