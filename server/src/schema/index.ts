// Consolidated schema exports for Drizzle
import { users } from './users';
import { events } from './events';
import { departments } from './departments';
import { employees } from './employees';
import { positions } from './positions';
import { employeePositions } from './employeePositions';
import { schedules } from './schedules';
import { shifts } from './shifts';
import { assignments } from './assignments';
import { areas } from './areas';
import { eventAreas } from './eventAreas';
import { eventSeries, eventSeriesRules, eventSeriesAreas } from './recurringSeries';
import { contacts } from './contacts';
// Inventory modules
import { attributeSchema, items as inventoryItems, assetSpecs, locations, inventoryTxn, reservations, policies, unitConversions, valuationAvg } from './inventory/items';

export { users, events, departments, employees, positions, employeePositions, schedules, shifts, assignments, areas, eventAreas, eventSeries, eventSeriesRules, eventSeriesAreas, contacts };
export {
  attributeSchema,
  inventoryItems,
  assetSpecs,
  locations,
  inventoryTxn,
  reservations,
  policies,
  unitConversions,
  valuationAvg,
};


