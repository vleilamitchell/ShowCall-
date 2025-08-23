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
// Inventory modules
import { attributeSchema, items as inventoryItems, assetSpecs, locations, inventoryTxn, reservations, policies, unitConversions } from './inventory/items';

export { users, events, departments, employees, positions, employeePositions, schedules, shifts, assignments };
export {
  attributeSchema,
  inventoryItems,
  assetSpecs,
  locations,
  inventoryTxn,
  reservations,
  policies,
  unitConversions,
};


