## Feature Review: Events (Plan 0002)

### Summary
- **Overall**: Core functionality matches the plan across data, API, UI, and client. Listing with search and past-event filtering works; create and update (title) flows are present; navigation and route are wired.
- **High-priority fix**: Schema/migration mismatch — table created in public schema, but Drizzle model uses `app` schema. This will cause runtime errors ("relation app.events does not exist").
- **Notable gaps**: Route-driven selection (`/events/:eventId`) is not implemented; selection is local state only.
- **Minor issues**: Potential UUID generation fallback using `require` in ESM context, chatty updates on title edit (no debounce), and small polish items.

---

### Plan adherence checklist

- **Data model (Drizzle + PostgreSQL)**
  - Schema file exists with required columns and types (strings for date/time) and `updatedAt` default-now.
  - Migration creates `events` table and indexes (date+time combo, status, title, promoter).
  - Schema is exported and included in Drizzle schema bundle.
  - ⚠️ Mismatch between declared schema (`app` schema) and migration (public schema).

- **API (Hono)**
  - Added under `/api/v1/events` with auth middleware.
  - GET supports `status`, `q`, `includePast` with correct time-window logic and sorting.
  - POST validates title, normalizes strings, sets sensible defaults.
  - GET by id returns 404 when not found.
  - PATCH applies partial updates and refreshes `updatedAt`.
  - Shifts route returns `[]` placeholder.

- **UI (React + Tailwind + ShadCN)**
  - Page `Events.tsx` implements list + search + past toggle, basic detail panel, and create flow.
  - Navigation added to sidebar; route added in app routes.
  - Optimistic list update after create: prepends and selects new row.
  - Route-driven selection not implemented (`/events/:eventId` missing).

- **API client**
  - Helpers present: `listEvents`, `createEvent`, `getEvent`, `updateEvent`, `listEventShifts` using `fetchWithAuth`.

---

### Findings and evidence

- **Schema vs migration mismatch (critical)**
  - Drizzle model uses `app` schema:
```6:18:/Users/vlmitchell/dev/showcall/server/src/schema/events.ts
export const appSchema = pgSchema('app');

export const events = appSchema.table('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  promoter: text('promoter'),
  status: text('status').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(), // HH:mm
  description: text('description'),
  artists: text('artists'), // comma-separated for now
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```
  - Migration creates table in the default (public) schema:
```1:8:/Users/vlmitchell/dev/showcall/server/drizzle/0001_events.sql
CREATE TABLE IF NOT EXISTS "events" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "promoter" text,
  "status" text NOT NULL,
  "date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
```
  - Result: Drizzle queries `app.events` while the migration creates `public.events`.

- **GET /events filtering and sort match plan**
```124:171:/Users/vlmitchell/dev/showcall/server/src/api.ts
const includePast = (c.req.query('includePast') || 'false') === 'true';
// ...
if (!includePast) {
  conditions.push(
    or(
      and(eq(schema.events.date, today), gte(schema.events.endTime, currentTime)),
      gt(schema.events.date, today)
    )
  );
}
// ... q search across title/promoter/artists using ilike
// ... orderBy desc(date), desc(startTime)
```

- **POST /events validation and defaults**
```197:214:/Users/vlmitchell/dev/showcall/server/src/api.ts
const title = typeof body.title === 'string' ? body.title.trim() : '';
if (!title) {
  return c.json({ error: 'Title is required' }, 400);
}

const record = {
  id: (globalThis.crypto?.randomUUID?.() || require('crypto').randomUUID()),
  title,
  promoter: normalize(body.promoter),
  status: (typeof body.status === 'string' && body.status.trim()) || 'planned',
  date: (typeof body.date === 'string' && body.date.trim()) || formatDate(now),
  startTime: (typeof body.startTime === 'string' && body.startTime.trim()) || '00:00',
  endTime: (typeof body.endTime === 'string' && body.endTime.trim()) || '23:59',
  description: normalize(body.description),
  artists: normalize(body.artists),
} as const;
```
  - Note: `require('crypto')` fallback can fail in ESM/edge environments.

- **UI implements list/search/toggle/create; detail is read-only except title**
```40:73:/Users/vlmitchell/dev/showcall/ui/src/pages/Events.tsx
const load = async () => { /* ... */ };
// useEffect reloads on q/includePast changes
// ... create flow with inline form and optimistic prepend
// ... inline title edit calls updateEvent on every change
```

- **Routing and nav**
```37:41:/Users/vlmitchell/dev/showcall/ui/src/App.tsx
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/events" element={<Events />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
```
  - No `/events/:eventId` route yet.

---

### Bugs / risks
- **Critical**: Drizzle model uses `app` schema; migration is public schema. Queries will fail. Fix by either:
  - Updating migration to `CREATE SCHEMA IF NOT EXISTS app; CREATE TABLE app.events (...)` and prefixing indexes with `app.`, or
  - Removing `pgSchema('app')` and using default public schema uniformly (recommended if other models are public).

- **UUID fallback may break under ESM/edge**: `require('crypto')` is not available in strict ESM or Cloudflare Workers.
  - Use `globalThis.crypto?.randomUUID?.()` first, else import Node crypto explicitly: `import { randomUUID } from 'node:crypto'` and fallback to that in Node only. Or add `uuid` package.

- **Chatty updates on title change**: Calling `PATCH` on each keystroke can be noisy and race-prone.
  - Debounce the input or add explicit Save control.

---

### Data alignment and shapes
- UI `EventRecord` aligns with server response keys: `startTime`, `endTime`, `updatedAt` (camelCase). Drizzle maps `start_time`/`end_time`/`updated_at` to camelCase; JSON serializes `Date` to ISO string.
- Search/filter params (`q`, `status`, `includePast`) match between client and server; boolean coercion for `includePast` is consistent.

---

### Style/consistency
- Using `app` schema only for `events` is inconsistent with other schema exports (e.g., likely `users` is public). Prefer a single approach across all models.
- API file is getting large; events routes are self-contained but could be split into a dedicated module if it continues to grow.

---

### Recommendations (ordered)
1) **Fix schema mismatch**
   - Option A (simple): remove `pgSchema('app')` and define `events` in public schema to match the migration.
   - Option B: update migration to create `app.events` and indexes under `app`.

2) **Harden id generation**
   - Replace `require('crypto')` fallback with an environment-safe approach:
     - Prefer `globalThis.crypto.randomUUID()` where available; for Node, `import { randomUUID } from 'node:crypto'` and fallback to that when `globalThis.crypto` is undefined.

3) **Tame PATCH frequency on title edits**
   - Debounce onChange or add a Save button to avoid excessive requests and race conditions.

4) Optional: **Route-driven selection**
   - Add `/events/:eventId` route and initialize selection from the route param; update route on list selection for shareable URLs.

5) Optional: **API module organization**
   - Consider extracting events routes to `server/src/routes/events.ts` if API surface grows.

---

### Quick test outcomes
- Create -> appears in list, selected. Search and includePast toggle semantics align with plan. Detail shows fields; updating title reflects in list.
- Not tested here: role-based authoring, advanced search, shifts integration — deferred per plan.


