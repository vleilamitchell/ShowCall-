## UI/UX Audit — Inventory

Scope: Inventory landing and Production Inventory flows, including routing, sidebar nav, list/detail views, quick actions, and activity/reconciliation screens.

### Summary
- Inventory landing and Production Inventory structure is coherent, responsive, and matches the current design language (PageHeader, Cards, Buttons, spacing). Navigation via sidebar correctly highlights on nested routes.
- Main issues are information architecture and accessibility. Entry from Inventory → Production is awkward (single button CTA to a sub-area), Production subpages lack strong in-page wayfinding, and there are a11y gaps (labels, tab semantics, nested interactive elements).

### Notable Strengths
- Consistent surface: `PageHeader`, `Card`/`CardContent`, spacing classes, and responsive grids are used consistently.
- Routing is clear and granular for Production flows (items list/detail, transactions, events, reconciliation).
- Tables are horizontally scrollable on small screens (`overflow-x-auto`), preserving usability.

### Issues and Recommendations

0) High — Information architecture: Inventory → Production entry is awkward
- Files: `ui/src/pages/Inventory.tsx`, `ui/src/pages/InventoryProduction.tsx`, `ui/src/features/inventory/production/*`
- Pattern: The Inventory landing shows a single “Open Production Inventory” button. Production then acts as a sub-hub with its own actions.
- Impact: Users may not realize Production is a primary sub-area of Inventory; a single CTA suggests a one-off task, not a hub. Discoverability of subpages (Items, Transactions, Events) depends on clicking the button first.
- Fix options:
  - Promote Production to a visible subtree in the sidebar: Inventory → Production (Items, Transactions, Events, Reconciliation).
  - On `Inventory` landing, replace the single CTA with a grid of cards linking directly to subpages (Items, New Transaction, Events, Reconciliation) to communicate the scope.
  - Consider `Route` nesting and breadcrumbs to reflect hierarchy.

0.1) High — In-page wayfinding, keeping sidebar unchanged
- Files: `ui/src/pages/Inventory.tsx`, `ui/src/pages/InventoryProduction.tsx`, `ProductionItemsTable.tsx`, `ProductionItemDetail.tsx`, `CheckoutWizard.tsx`
- Pattern: Deep screens rely on content buttons and browser back; no breadcrumb/hub anchors.
- Impact: Reduced sense of place without modifying the sidebar.
- Fix (do not change sidebar):
  - Add top-level breadcrumbs (Inventory → Production → [Subpage] → [Detail]) on Production pages.
  - Add a compact secondary nav (tab-like links) within `InventoryProduction` for Items, New Transaction, Events, Reconciliation.
  - Ensure each deep page includes a consistent “Back to Production Inventory” link near the header.

1) High — Nested interactive elements (invalid HTML / a11y)
- Files: `ui/src/features/inventory/production/ProductionInventoryPage.tsx`, `ProductionItemsTable.tsx`, `ProductionItemDetail.tsx`
- Pattern: `<Link to="…"><Button>…</Button></Link>` nests a `<button>` inside an `<a>`.
- Impact: Screen readers and keyboard users may encounter ambiguous focus/activation behavior.
- Fix: Render links as buttons using the button component’s `asChild` prop.
  - Example:
    ```tsx
    <Button asChild><Link to="/inventory/production/items">Items</Link></Button>
    ```

2) High — Unlabeled form inputs (discoverability, a11y)
- Files: `ProductionItemsTable.tsx` (search, type filter), `ActivityTab.tsx` (from/to dates, event types), `CheckoutWizard.tsx` (location, qty, unit, destination location).
- Pattern: Placeholders without a visible label.
- Impact: Placeholders disappear on input; labels are necessary for screen readers and clarity.
- Fix: Add visible `<label>` with `htmlFor`, or provide `aria-label` where a label would be visually redundant. Group related inputs with fieldsets and legends where appropriate.

3) Medium — Hand-rolled tabs lack semantics
- File: `ProductionItemDetail.tsx` (Overview/Activity/Reservations/Maintenance)
- Pattern: Custom buttons drive tab state; no ARIA roles/keyboard support.
- Impact: Keyboard navigation and SR semantics are incomplete.
- Fix: Use shadcn/ui `Tabs` for proper roles/keyboard interactions and consistent styling.

4) Medium — Item detail action clarity
- File: `ProductionItemDetail.tsx`
- Buttons “Checkout” and “Checkin” both link to the same wizard URL with only `itemId`. The wizard determines intent later.
- Impact: Slight ambiguity; users may expect the target screen to reflect chosen intent.
- Fix: Pass an intent param (e.g., `?action=checkout` or `?action=checkin`) and reflect it in the wizard (preselect action or highlight button).

5) Medium — Items list lacks `PageHeader`
- File: `ProductionItemsTable.tsx`
- Impact: Inconsistent page-level context vs other pages that use `PageHeader`.
- Fix: Add a `PageHeader` with title and supporting text (e.g., “Items”). Keep search/filters below.

6) Low/Medium — Per-row summaries limited to first N
- File: `ProductionItemsTable.tsx`
- Pattern: Summaries are fetched for the first 25 items only.
- Impact: Mixed feedback states (some rows show numbers, others show ellipses) can appear broken if not explained.
- Fix: Add helper text (“Showing summaries for first 25 results”) and consider lazy-hydrating on row visibility/hover or add a “Load summaries” control.

7) Low — Breadcrumbs for deep routes
- Files: `ProductionItemsTable.tsx`, `ProductionItemDetail.tsx`, `CheckoutWizard.tsx`
- Impact: Discoverability—users may want a quick path back to Production hub.
- Fix: Add a breadcrumb (Inventory → Production → Items → [Item]) or minimally a consistent “Back to Production Inventory” link near headers.

8) Low — Input affordances for IDs and units
- Files: `CheckoutWizard.tsx`
- Pattern: Free-text `locationId`, `unit`, and `destinationLocationId`.
- Impact: Error-prone. Users may not know valid values.
- Fix: Replace with selects/autocomplete tied to known lists (locations, units). Show validation/help text.

9) Low — Loading/focus states
- Files: `ActivityTab.tsx`, `CheckoutWizard.tsx`
- Impact: Consider focus management on route change (focus `h1`) and inline spinners on “submitting/loading” buttons for clearer feedback.

### Routing Review
Top-level routes correctly declare Inventory and nested Production flows:
```62:69:ui/src/App.tsx
<Route path="/inventory" element={<Inventory />} />
<Route path="/inventory/production" element={<InventoryProduction />} />
<Route path="/inventory/production/items" element={<ProductionItemsTable />} />
<Route path="/inventory/production/items/:itemId" element={<ProductionItemDetail />} />
<Route path="/inventory/production/transactions/new" element={<CheckoutWizard />} />
<Route path="/inventory/production/reconciliation" element={<ReconciliationPage />} />
<Route path="/inventory/production/events" element={<EventConsole />} />
```
Sidebar selection correctly treats descendants as active via `startsWith()` and the indicator updates on navigation and resize.

### Quick Wins Checklist
- Keep sidebar unchanged; add in-page breadcrumbs and a compact Production nav.
- Replace nested Link/Button with `Button asChild` across Inventory files.
- Add labels (or `aria-label`) to all inputs; consider `Fieldset` groupings.
- Convert item detail tabs to shadcn `Tabs`.
- Add `PageHeader` to Items list page.
- Add optional `action` query param and reflect preselected intent in the wizard.
- Add helper text for limited summaries and/or lazy hydration.
- Add breadcrumb or consistent back links to Production hub.

### Conclusion
The Inventory experience is on solid ground visually and structurally. Addressing the listed a11y and navigation clarity issues will materially improve usability and polish without large structural changes.


