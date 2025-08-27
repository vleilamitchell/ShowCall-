import { Hono } from 'hono';
import { legacyRouter } from './legacy';
import { authRouter } from './auth';
import { addressesRouter } from './addresses';
import { inventoryItemsRouter } from './inventory/items';
import { inventoryTransactionsRouter } from './inventory/transactions';
import { inventoryReservationsRouter } from './inventory/reservations';
import { inventoryLocationsRouter } from './inventory/locations';
import { eventsRouter } from './events';
import { eventAreasRouter } from './eventAreas';
import { recurringSeriesRouter } from './recurringSeries';
import { areasRouter } from './areas';
import { departmentsRouter } from './departments';
import { employeesRouter } from './employees';
import { positionsRouter } from './positions';
import { employeePositionsRouter } from './employeePositions';
import { shiftsRouter } from './shifts';
import { assignmentsRouter } from './assignments';
import { schedulesRouter } from './schedules';
import { contactsRouter } from './contacts';
import { bootstrapRouter } from './bootstrap';
import { novuWebhookRouter } from './webhooks/novu';
import { notificationsRouter } from './notifications';
import { usersRouter } from './users';

/**
 * mountV1Routers mounts all v1 domain routers onto the provided API router.
 * During Phase 1, we mount only the legacy router that preserves existing behavior.
 */
export function mountV1Routers(api: Hono) {
  // Mount new modular routers first so they can shadow legacy routes with identical behavior
  api.route('/addresses', addressesRouter);
  // Events domain
  api.route('/events', eventsRouter);
  api.route('/events', eventAreasRouter);
  api.route('/event-series', recurringSeriesRouter);
  api.route('/areas', areasRouter);
  api.route('/departments', departmentsRouter);
  api.route('/', employeesRouter);
  api.route('/', positionsRouter);
  api.route('/', employeePositionsRouter);
  api.route('/', shiftsRouter);
  api.route('/', schedulesRouter);
  api.route('/', assignmentsRouter);
  api.route('/', contactsRouter);
  // Inventory domain
  api.route('/inventory/items', inventoryItemsRouter);
  api.route('/inventory/transactions', inventoryTransactionsRouter);
  api.route('/inventory/reservations', inventoryReservationsRouter);
  api.route('/inventory/locations', inventoryLocationsRouter);
  // Bootstrap aggregate endpoints
  api.route('/bootstrap', bootstrapRouter);
  api.route('/', notificationsRouter);
  api.route('/', novuWebhookRouter);
  api.route('/', usersRouter);
  api.route('/', legacyRouter);
  // Mount new auth router under /protected alongside legacy routes
  api.route('/protected', authRouter);
}


