import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from './firebase';

// Normalize API base URL: ensure scheme and no trailing slash
const resolveApiBaseUrl = (): string => {
  const raw = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:8787';
  let url = String(raw).trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
};

export const API_BASE_URL = resolveApiBaseUrl();

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function getAuthToken(): Promise<string | null> {
  const auth = getAuth(app);
  let user = auth.currentUser;
  if (!user) {
    // Wait briefly for Firebase to initialize the current user
    user = await new Promise<any>((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(u);
      });
    });
  }
  if (!user) {
    if ((import.meta as any)?.env?.DEV) {
      console.warn('No Firebase user; Authorization header will be omitted');
    }
    return null;
  }
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (import.meta && (import.meta as any).env && (import.meta as any).env.DEV) {
      console.warn('API request failed', {
        url: `${API_BASE_URL}${endpoint}`,
        status: response.status,
        statusText: response.statusText,
        method: options.method || 'GET'
      });
    }
    let details: string | undefined;
    try {
      const data = await response.clone().json();
      if (data && typeof data.error === 'string') details = data.error;
    } catch {}
    const message = details ? `${response.statusText} - ${details}` : response.statusText;
    throw new APIError(response.status, `API request failed: ${message}`);
  }

  return response;
}

// API endpoints
export async function getCurrentUser() {
  const response = await fetchWithAuth('/api/v1/protected/me');
  return response.json();
}

// Events API helpers
export type EventRecord = {
  id: string;
  title: string;
  promoter?: string | null;
  status: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  eventType?: string | null;
  priority?: number | null;
  description?: string | null;
  ticketUrl?: string | null;
  eventPageUrl?: string | null;
  promoAssetsUrl?: string | null;
  seriesId?: string | null;
  updatedAt?: string;
};

export async function listEvents(params?: { q?: string; status?: string; includePast?: boolean; from?: string; to?: string; areaId?: string | string[] }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.status) query.set('status', params.status);
  if (params?.includePast != null) query.set('includePast', params.includePast ? 'true' : 'false');
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.areaId) {
    const v = Array.isArray(params.areaId) ? params.areaId.join(',') : params.areaId;
    query.set('areaId', v);
  }
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/events${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<EventRecord[]>;
}

// Bootstrap API
export type EventsBootstrapResponse = {
  events: EventRecord[];
  areasActive: Area[];
  areasByEvent: Record<string, Area[]>;
  departments: DepartmentRecord[];
  selected?: { event: EventRecord; shifts: ShiftRecord[] } | undefined;
};

export async function bootstrapEvents(params?: { q?: string; status?: string; includePast?: boolean; from?: string; to?: string; selectedId?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.status) query.set('status', params.status);
  if (params?.includePast != null) query.set('includePast', params.includePast ? 'true' : 'false');
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.selectedId) query.set('selectedId', params.selectedId);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/bootstrap/events${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<EventsBootstrapResponse>;
}

export type EventDetailBootstrapResponse = {
  event: EventRecord;
  areas: Area[];
  shifts: ShiftRecord[];
};

export async function bootstrapEventDetail(eventId: string) {
  const response = await fetchWithAuth(`/api/v1/bootstrap/event-detail?eventId=${encodeURIComponent(eventId)}`);
  return response.json() as Promise<EventDetailBootstrapResponse>;
}

export async function createEvent(payload: Partial<EventRecord> & { title: string }) {
  const response = await fetchWithAuth('/api/v1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<EventRecord>;
}

export async function getEvent(eventId: string) {
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}`);
  return response.json() as Promise<EventRecord>;
}

export async function updateEvent(eventId: string, patch: Partial<EventRecord>) {
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return response.json() as Promise<EventRecord>;
}

export async function deleteEvent(eventId: string) {
  await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
}

export async function listShiftsForEvent(eventId: string) {
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}/shifts`);
  return response.json() as Promise<ShiftRecord[]>;
}

export async function listEventShifts(eventId: string, params?: { departmentId?: string }) {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set('departmentId', params.departmentId);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}/shifts${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<any[]>;
}

export const api: {
  getCurrentUser: typeof getCurrentUser;
  listEvents: typeof listEvents;
  createEvent: typeof createEvent;
  getEvent: typeof getEvent;
  updateEvent: typeof updateEvent;
  listEventShifts: typeof listEventShifts;
  // Event Series
  listEventSeries?: typeof listEventSeries;
  createEventSeries?: typeof createEventSeries;
  getEventSeries?: typeof getEventSeries;
  updateEventSeries?: typeof updateEventSeries;
  deleteEventSeries?: typeof deleteEventSeries;
  getEventSeriesAreas?: typeof getEventSeriesAreas;
  putEventSeriesAreas?: typeof putEventSeriesAreas;
  addEventSeriesArea?: typeof addEventSeriesArea;
  removeEventSeriesArea?: typeof removeEventSeriesArea;
  previewEventSeries?: typeof previewEventSeries;
  generateEventSeries?: typeof generateEventSeries;
  getEventSeriesRule?: typeof getEventSeriesRule;
  updateEventSeriesRule?: typeof updateEventSeriesRule;
  // Scheduling
  listSchedules?: typeof listSchedules;
  createSchedule?: typeof createSchedule;
  getSchedule?: typeof getSchedule;
  updateSchedule?: typeof updateSchedule;
  publishSchedule?: typeof publishSchedule;
  unpublishSchedule?: typeof unpublishSchedule;
  listShifts?: typeof listShifts;
  listAllShifts?: typeof listAllShifts;
  createShift?: typeof createShift;
  getShift?: typeof getShift;
  updateShift?: typeof updateShift;
  deleteShift?: typeof deleteShift;
  listAssignments?: typeof listAssignments;
  createAssignment?: typeof createAssignment;
  updateAssignment?: typeof updateAssignment;
  deleteAssignment?: typeof deleteAssignment;
  // Generation
  generateShiftsForSchedule?: (scheduleId: string, payload: { departmentId: string; regenerate?: boolean }) => Promise<{ created: number; skipped: number; shifts: ShiftRecord[] }>;
  listDepartments?: typeof listDepartments;
  getDepartment?: typeof getDepartment;
  createDepartment?: typeof createDepartment;
  updateDepartment?: typeof updateDepartment;
  // Employees (assigned after declaration)
  listEmployees?: (departmentId: string) => Promise<any[]>;
  createEmployee?: (departmentId: string, payload: any) => Promise<any>;
  updateEmployee?: (employeeId: string, patch: any) => Promise<any>;
  deleteEmployee?: (employeeId: string) => Promise<void>;
  // Positions
  listPositions?: (departmentId: string, params?: { q?: string }) => Promise<PositionRecord[]>;
  createPosition?: (departmentId: string, payload: { name: string }) => Promise<PositionRecord>;
  updatePosition?: (positionId: string, patch: Partial<PositionRecord>) => Promise<PositionRecord>;
  deletePosition?: (positionId: string) => Promise<void>;
  // EmployeePositions
  listEmployeePositions?: (departmentId: string) => Promise<EmployeePositionRecord[]>;
  createEmployeePosition?: (payload: CreateEmployeePositionPayload) => Promise<EmployeePositionRecord>;
  updateEmployeePosition?: (id: string, patch: Partial<EmployeePositionRecord>) => Promise<EmployeePositionRecord>;
  deleteEmployeePosition?: (id: string) => Promise<void>;
  // Batch update priorities
  updateEmployeePositionsBatch?: (positionId: string, items: Array<{ id: string; priority: number; isLead?: boolean }>) => Promise<EmployeePositionRecord[]>;
  // Eligibility
  listEligibleEmployeesForPosition?: (departmentId: string, positionId: string) => Promise<EligibleEmployee[]>;
  // Inventory
  listInventoryItems?: typeof listInventoryItems;
  createInventoryItem?: typeof createInventoryItem;
  getInventoryItem?: typeof getInventoryItem;
  patchInventoryItem?: typeof patchInventoryItem;
  postInventoryTransaction?: typeof postInventoryTransaction;
  listInventoryTransactions?: typeof listInventoryTransactions;
  getInventoryItemSummary?: typeof getInventoryItemSummary;
  listReservations?: typeof listReservations;
  createReservation?: typeof createReservation;
  updateReservation?: typeof updateReservation;
  listInventoryLocations?: typeof listInventoryLocations;
  listInventorySchemas?: typeof listInventorySchemas;
  // Areas
  listAreas?: typeof listAreas;
  createArea?: typeof createArea;
  updateArea?: typeof updateArea;
  deleteArea?: typeof deleteArea;
  getAreasForEvents?: typeof getAreasForEvents;
  getEventAreas?: typeof getEventAreas;
  replaceEventAreas?: typeof replaceEventAreas;
  addEventArea?: typeof addEventArea;
  removeEventArea?: typeof removeEventArea;
  reorderAreas?: typeof reorderAreas;
  bootstrapEvents?: typeof bootstrapEvents;
  bootstrapEventDetail?: typeof bootstrapEventDetail;
  // Contacts
  listContacts?: typeof listContacts;
  createContact?: typeof createContact;
  getContact?: typeof getContact;
  updateContact?: typeof updateContact;
  deleteContact?: typeof deleteContact;
} = {
  getCurrentUser,
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  listEventShifts,
}; 

// Departments API helpers
export type DepartmentRecord = {
  id: string;
  name: string;
  description?: string | null;
  updatedAt?: string;
};

export async function listDepartments(params?: { q?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/departments${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<DepartmentRecord[]>;
}

export async function getDepartment(id: string) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(id)}`);
  return response.json() as Promise<DepartmentRecord>;
}

export async function createDepartment(payload: { name: string; description?: string | null }) {
  const response = await fetchWithAuth('/api/v1/departments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<DepartmentRecord>; 
}

export async function updateDepartment(id: string, patch: Partial<DepartmentRecord>) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  return response.json() as Promise<DepartmentRecord>;
}

api.listDepartments = listDepartments;
api.getDepartment = getDepartment;
api.createDepartment = createDepartment;
api.updateDepartment = updateDepartment;

// Employees API helpers
export type EmployeeRecord = {
  id: string;
  departmentId: string;
  name: string;
  priority?: number | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  postalCode4?: string | null;
  primaryPhone?: string | null;
  email?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  fullName?: string;
};

export async function listEmployees(departmentId: string) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/employees`);
  return response.json() as Promise<EmployeeRecord[]>;
}

export async function createEmployee(departmentId: string, payload: Partial<EmployeeRecord> & { name?: string }) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<EmployeeRecord>;
}

export async function updateEmployee(employeeId: string, patch: Partial<EmployeeRecord>) {
  const response = await fetchWithAuth(`/api/v1/employees/${encodeURIComponent(employeeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return response.json() as Promise<EmployeeRecord>;
}

export async function deleteEmployee(employeeId: string) {
  await fetchWithAuth(`/api/v1/employees/${encodeURIComponent(employeeId)}`, { method: 'DELETE' });
}

api.listEmployees = listEmployees as any;
api.createEmployee = createEmployee as any;
api.updateEmployee = updateEmployee as any;
api.deleteEmployee = deleteEmployee as any;

// Positions API helpers
export type PositionRecord = {
  id: string;
  departmentId: string;
  name: string;
  updatedAt?: string;
};

export async function listPositions(departmentId: string, params?: { q?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/positions${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<PositionRecord[]>;
}

export async function createPosition(departmentId: string, payload: { name: string }) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/positions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<PositionRecord>;
}

export async function updatePosition(positionId: string, patch: Partial<PositionRecord>) {
  const response = await fetchWithAuth(`/api/v1/positions/${encodeURIComponent(positionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return response.json() as Promise<PositionRecord>;
}

export async function deletePosition(positionId: string) {
  await fetchWithAuth(`/api/v1/positions/${encodeURIComponent(positionId)}`, { method: 'DELETE' });
}

api.listPositions = listPositions as any;
api.createPosition = createPosition as any;
api.updatePosition = updatePosition as any;
api.deletePosition = deletePosition as any;

// EmployeePositions API helpers
export type EmployeePositionRecord = {
  id: string;
  departmentId: string;
  employeeId: string;
  positionId: string;
  priority?: number | null;
  isLead: boolean;
  updatedAt?: string;
};

export type CreateEmployeePositionPayload = {
  departmentId: string;
  employeeId: string;
  positionId: string;
  priority?: number | null;
  isLead?: boolean;
};

export async function listEmployeePositions(departmentId: string) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/employee-positions`);
  return response.json() as Promise<EmployeePositionRecord[]>;
}

export async function createEmployeePosition(payload: CreateEmployeePositionPayload) {
  const response = await fetchWithAuth('/api/v1/employee-positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<EmployeePositionRecord>;
}

export async function updateEmployeePosition(id: string, patch: Partial<EmployeePositionRecord>) {
  const response = await fetchWithAuth(`/api/v1/employee-positions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return response.json() as Promise<EmployeePositionRecord>;
}

export async function deleteEmployeePosition(id: string) {
  await fetchWithAuth(`/api/v1/employee-positions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

api.listEmployeePositions = listEmployeePositions as any;
api.createEmployeePosition = createEmployeePosition as any;
api.updateEmployeePosition = updateEmployeePosition as any;
api.deleteEmployeePosition = deleteEmployeePosition as any;

// Event Series API helpers
export type EventSeries = {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  defaultStatus: string;
  defaultStartTime: string;
  defaultEndTime: string;
  titleTemplate?: string | null;
  promoterTemplate?: string | null;
  templateJson?: any;
  updatedAt?: string;
};

export type EventSeriesRule = {
  id: string;
  seriesId: string;
  frequency: 'WEEKLY';
  interval: number;
  byWeekdayMask: number;
  updatedAt?: string;
};

export async function listEventSeries(params?: { q?: string; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/event-series${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<EventSeries[]>;
}

export async function createEventSeries(payload: Partial<EventSeries> & { name: string; rule?: { frequency?: 'WEEKLY'; interval?: number; byWeekdayMask?: number } }) {
  const response = await fetchWithAuth('/api/v1/event-series', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<EventSeries>;
}

export async function getEventSeries(seriesId: string) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}`);
  return response.json() as Promise<EventSeries>;
}

export async function updateEventSeries(seriesId: string, patch: Partial<EventSeries>) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<EventSeries>;
}

export async function deleteEventSeries(seriesId: string) {
  await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}`, { method: 'DELETE' });
}

export async function getEventSeriesAreas(seriesId: string) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/areas`);
  return response.json() as Promise<Area[]>;
}

export async function putEventSeriesAreas(seriesId: string, areaIds: string[]) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/areas`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaIds }),
  });
  return response.json() as Promise<Area[]>;
}

export async function addEventSeriesArea(seriesId: string, areaId: string) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/areas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaId }),
  });
  return response.json() as Promise<Area[]>;
}

export async function removeEventSeriesArea(seriesId: string, areaId: string) {
  await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/areas/${encodeURIComponent(areaId)}`, { method: 'DELETE' });
}

export async function previewEventSeries(seriesId: string, payload: { fromDate?: string; untilDate: string }) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<{ dates: string[]; template: Partial<EventRecord> }>
}

export async function generateEventSeries(seriesId: string, payload: { fromDate?: string; untilDate: string; overwriteExisting?: boolean; setAreasMode?: 'replace' | 'skip' }) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<{ created: number; updated: number; skipped: number; eventIds: string[] }>;
}

export async function getEventSeriesRule(seriesId: string) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/rule`);
  return response.json() as Promise<EventSeriesRule>;
}

export async function updateEventSeriesRule(seriesId: string, patch: Partial<Pick<EventSeriesRule, 'frequency' | 'interval' | 'byWeekdayMask'>>) {
  const response = await fetchWithAuth(`/api/v1/event-series/${encodeURIComponent(seriesId)}/rule`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<EventSeriesRule>;
}

api.listEventSeries = listEventSeries as any;
api.createEventSeries = createEventSeries as any;
api.getEventSeries = getEventSeries as any;
api.updateEventSeries = updateEventSeries as any;
api.deleteEventSeries = deleteEventSeries as any;
api.getEventSeriesAreas = getEventSeriesAreas as any;
api.putEventSeriesAreas = putEventSeriesAreas as any;
api.addEventSeriesArea = addEventSeriesArea as any;
api.removeEventSeriesArea = removeEventSeriesArea as any;
api.previewEventSeries = previewEventSeries as any;
api.generateEventSeries = generateEventSeries as any;
api.getEventSeriesRule = getEventSeriesRule as any;
api.updateEventSeriesRule = updateEventSeriesRule as any;

// Eligibility API helper
export type EligibleEmployee = { id: string; name: string; priority: number | null };

export async function listEligibleEmployeesForPosition(departmentId: string, positionId: string) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/positions/${encodeURIComponent(positionId)}/eligible`);
  return response.json() as Promise<EligibleEmployee[]>;
}

api.listEligibleEmployeesForPosition = listEligibleEmployeesForPosition as any;

// Batch priorities update
export async function updateEmployeePositionsBatch(positionId: string, items: Array<{ id: string; priority: number; isLead?: boolean }>) {
  const response = await fetchWithAuth(`/api/v1/positions/${encodeURIComponent(positionId)}/employee-positions`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return response.json() as Promise<EmployeePositionRecord[]>;
}

api.updateEmployeePositionsBatch = updateEmployeePositionsBatch as any;

// Scheduling API helpers
export type ScheduleRecord = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
};

export async function listSchedules(params?: { q?: string; isPublished?: boolean; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.isPublished != null) query.set('isPublished', params.isPublished ? 'true' : 'false');
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/schedules${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<ScheduleRecord[]>;
}

export async function createSchedule(payload: { name: string; startDate: string; endDate: string }) {
  const response = await fetchWithAuth('/api/v1/schedules', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<ScheduleRecord>;
}

export async function getSchedule(id: string) {
  const response = await fetchWithAuth(`/api/v1/schedules/${encodeURIComponent(id)}`);
  return response.json() as Promise<ScheduleRecord>;
}

export async function updateSchedule(id: string, patch: Partial<ScheduleRecord>) {
  const response = await fetchWithAuth(`/api/v1/schedules/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<ScheduleRecord>;
}

export async function deleteSchedule(id: string) {
  await fetchWithAuth(`/api/v1/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function publishSchedule(id: string) {
  const response = await fetchWithAuth(`/api/v1/schedules/${encodeURIComponent(id)}/publish`, { method: 'POST' });
  return response.json() as Promise<ScheduleRecord>;
}

export async function unpublishSchedule(id: string) {
  const response = await fetchWithAuth(`/api/v1/schedules/${encodeURIComponent(id)}/unpublish`, { method: 'POST' });
  return response.json() as Promise<ScheduleRecord>;
}

export type ShiftRecord = {
  id: string;
  departmentId: string;
  scheduleId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  title?: string | null;
  notes?: string | null;
  eventId?: string | null;
  updatedAt?: string;
  derivedPublished?: boolean;
};

export async function listShifts(departmentId: string, params?: { q?: string; scheduleId?: string; from?: string; to?: string; published?: boolean }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.scheduleId) query.set('scheduleId', params.scheduleId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.published != null) query.set('published', params.published ? 'true' : 'false');
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/shifts${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<ShiftRecord[]>;
}

export async function listAllShifts(params?: { departmentId?: string; q?: string; scheduleId?: string; from?: string; to?: string; published?: boolean }) {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set('departmentId', params.departmentId);
  if (params?.q) query.set('q', params.q);
  if (params?.scheduleId) query.set('scheduleId', params.scheduleId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.published != null) query.set('published', params.published ? 'true' : 'false');
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/shifts${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<ShiftRecord[]>;
}

// Generate shifts for a schedule
export async function generateShiftsForSchedule(scheduleId: string, payload: { departmentId: string; regenerate?: boolean }) {
  const response = await fetchWithAuth(`/api/v1/schedules/${encodeURIComponent(scheduleId)}/generate-shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json() as Promise<{ created: number; skipped: number; shifts: ShiftRecord[] }>;
}

export async function createShift(departmentId: string, payload: Partial<ShiftRecord> & { date: string; startTime: string; endTime: string }) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/shifts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<ShiftRecord & { warnings?: string[] }>;
}

export async function getShift(id: string) {
  const response = await fetchWithAuth(`/api/v1/shifts/${encodeURIComponent(id)}`);
  return response.json() as Promise<ShiftRecord>;
}

export async function updateShift(id: string, patch: Partial<ShiftRecord>) {
  const response = await fetchWithAuth(`/api/v1/shifts/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<ShiftRecord>;
}

export async function deleteShift(id: string) {
  await fetchWithAuth(`/api/v1/shifts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type AssignmentRecord = {
  id: string;
  departmentId: string;
  shiftId: string;
  requiredPositionId: string;
  assigneeEmployeeId?: string | null;
  areaId?: string | null;
  updatedAt?: string;
};

export async function listAssignments(departmentId: string, shiftId?: string) {
  const query = new URLSearchParams();
  if (shiftId) query.set('shiftId', shiftId);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/assignments${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<AssignmentRecord[]>;
}

export async function createAssignment(departmentId: string, payload: { shiftId: string; requiredPositionId: string; assigneeEmployeeId?: string | null; areaId?: string | null }) {
  const response = await fetchWithAuth(`/api/v1/departments/${encodeURIComponent(departmentId)}/assignments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<AssignmentRecord>;
}

export async function updateAssignment(id: string, patch: Partial<AssignmentRecord>) {
  const response = await fetchWithAuth(`/api/v1/assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<AssignmentRecord>;
}

export async function deleteAssignment(id: string) {
  await fetchWithAuth(`/api/v1/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

api.listSchedules = listSchedules;
api.createSchedule = createSchedule;
api.getSchedule = getSchedule;
api.updateSchedule = updateSchedule;
api.publishSchedule = publishSchedule;
api.unpublishSchedule = unpublishSchedule;
api.deleteSchedule = deleteSchedule as any;
api.listShifts = listShifts as any;
api.listAllShifts = listAllShifts as any;
api.generateShiftsForSchedule = generateShiftsForSchedule as any;
api.createShift = createShift as any;
api.getShift = getShift as any;
api.updateShift = updateShift as any;
api.deleteShift = deleteShift as any;
api.listAssignments = listAssignments as any;
api.createAssignment = createAssignment as any;
api.updateAssignment = updateAssignment as any;
api.deleteAssignment = deleteAssignment as any;

// Inventory API helpers
export type InventoryItemRecord = {
  itemId: string;
  sku: string;
  name: string;
  itemType: string;
  baseUnit: string;
  categoryId?: string | null;
  schemaId: string;
  attributes: any;
  active: boolean;
};

export async function listInventoryItems(params?: { q?: string; itemType?: string; active?: boolean }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.itemType) query.set('item_type', params.itemType);
  if (params?.active != null) query.set('active', params.active ? 'true' : 'false');
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/inventory/items${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<InventoryItemRecord[]>;
}

export async function createInventoryItem(payload: Omit<InventoryItemRecord, 'itemId' | 'active'> & { active?: boolean }) {
  const response = await fetchWithAuth('/api/v1/inventory/items', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<InventoryItemRecord>;
}

export async function getInventoryItem(id: string) {
  const response = await fetchWithAuth(`/api/v1/inventory/items/${encodeURIComponent(id)}`);
  return response.json() as Promise<InventoryItemRecord>;
}

export async function patchInventoryItem(id: string, patch: Partial<InventoryItemRecord>) {
  const response = await fetchWithAuth(`/api/v1/inventory/items/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<InventoryItemRecord>;
}

export type InventoryTxnInput = {
  itemId: string;
  locationId: string;
  eventType: string;
  qtyBase?: number;
  qty?: number;
  unit?: string;
  lotId?: string | null;
  serialNo?: string | null;
  costPerBase?: number | null;
  sourceDoc?: any;
  postedBy: string;
  transfer?: { destinationLocationId: string } | null;
};

export async function postInventoryTransaction(payload: InventoryTxnInput) {
  const response = await fetchWithAuth('/api/v1/inventory/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<any[]>;
}

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

export type ReservationRecord = {
  resId: string;
  itemId: string;
  locationId: string;
  eventId: string;
  qtyBase: number;
  startTs: string;
  endTs: string;
  status: 'HELD' | 'RELEASED' | 'FULFILLED';
};

export async function listReservations(params?: { itemId?: string; eventId?: string }) {
  const query = new URLSearchParams();
  if (params?.itemId) query.set('itemId', params.itemId);
  if (params?.eventId) query.set('eventId', params.eventId);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/inventory/reservations${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<ReservationRecord[]>;
}

export async function createReservation(payload: Omit<ReservationRecord, 'resId' | 'status'>) {
  const response = await fetchWithAuth('/api/v1/inventory/reservations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<ReservationRecord>;
}

export async function updateReservation(resId: string, action: 'RELEASE' | 'FULFILL') {
  const response = await fetchWithAuth(`/api/v1/inventory/reservations/${encodeURIComponent(resId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
  });
  return response.json() as Promise<ReservationRecord>;
}

export type InventoryLocationRecord = { locationId: string; name: string; departmentId: string };

export async function listInventoryLocations(params?: { departmentId?: string }) {
  const query = new URLSearchParams();
  if (params?.departmentId) query.set('department_id', params.departmentId);
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/inventory/locations${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<InventoryLocationRecord[]>;
}

export async function listInventorySchemas() {
  const response = await fetchWithAuth('/api/v1/inventory/schemas');
  return response.json() as Promise<Array<{ schemaId: string; itemType: string; departmentId?: string | null; version: number; jsonSchema: any }>>;
}

api.listInventoryItems = listInventoryItems as any;
api.createInventoryItem = createInventoryItem as any;
api.getInventoryItem = getInventoryItem as any;
api.patchInventoryItem = patchInventoryItem as any;
api.postInventoryTransaction = postInventoryTransaction as any;
api.listInventoryTransactions = listInventoryTransactions as any;
api.getInventoryItemSummary = getInventoryItemSummary as any;
api.listReservations = listReservations as any;
api.createReservation = createReservation as any;
api.updateReservation = updateReservation as any;
api.listInventoryLocations = listInventoryLocations as any;
api.listInventorySchemas = listInventorySchemas as any;

// Areas API helpers
export type Area = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  active: boolean;
  updatedAt?: string;
};

export async function listAreas(params?: { q?: string; active?: boolean }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.active != null) query.set('active', params.active ? 'true' : 'false');
  const qs = query.toString();
  const response = await fetchWithAuth(`/api/v1/areas${qs ? `?${qs}` : ''}`);
  return response.json() as Promise<Area[]>;
}

export async function reorderAreas(ids: string[]) {
  const response = await fetchWithAuth('/api/v1/areas/order', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return response.json() as Promise<Area[]>;
}

export async function createArea(payload: { name: string; description?: string | null; color?: string | null; active?: boolean }) {
  const response = await fetchWithAuth('/api/v1/areas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<Area>;
}

export async function updateArea(areaId: string, patch: Partial<Area>) {
  const response = await fetchWithAuth(`/api/v1/areas/${encodeURIComponent(areaId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<Area>;
}

export async function deleteArea(areaId: string) {
  const response = await fetchWithAuth(`/api/v1/areas/${encodeURIComponent(areaId)}`, { method: 'DELETE' });
  if (response.status === 204) return;
  // If not 204, let the caller see the error body
  const data = await response.json().catch(() => null);
  if (data && (data as any).error) {
    throw new APIError(response.status, (data as any).error);
  }
}

export async function getEventAreas(eventId: string) {
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}/areas`);
  return response.json() as Promise<Area[]>;
}

export async function getAreasForEvents(eventIds: string[]) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return {} as Record<string, Area[]>;
  const ids = eventIds.join(',');
  const response = await fetchWithAuth(`/api/v1/events/_bulk/areas?ids=${encodeURIComponent(ids)}`);
  return response.json() as Promise<Record<string, Area[]>>;
}

export async function replaceEventAreas(eventId: string, areaIds: string[]) {
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}/areas`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaIds }),
  });
  return response.json() as Promise<Area[]>;
}

export async function addEventArea(eventId: string, areaId: string) {
  const response = await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}/areas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ areaId }),
  });
  return response.json() as Promise<Area[]>;
}

export async function removeEventArea(eventId: string, areaId: string) {
  await fetchWithAuth(`/api/v1/events/${encodeURIComponent(eventId)}/areas/${encodeURIComponent(areaId)}`, { method: 'DELETE' });
}

api.listAreas = listAreas as any;
api.createArea = createArea as any;
api.updateArea = updateArea as any;
api.deleteArea = deleteArea as any;
api.replaceEventAreas = replaceEventAreas as any;
api.addEventArea = addEventArea as any;
api.removeEventArea = removeEventArea as any;
api.getEventAreas = getEventAreas as any;
api.getAreasForEvents = getAreasForEvents as any;
api.reorderAreas = reorderAreas as any;
api.bootstrapEvents = bootstrapEvents as any;
api.bootstrapEventDetail = bootstrapEventDetail as any;
api.getEventAreas = getEventAreas as any;
api.replaceEventAreas = replaceEventAreas as any;
api.addEventArea = addEventArea as any;
api.removeEventArea = removeEventArea as any;

// Contacts API helpers
export type ContactRecord = {
  id: string;
  prefix?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  email?: string | null;
  paymentDetails?: string | null;
  contactNumber?: string | null;
  organization?: string | null;
  updatedAt?: string;
};

export async function listContacts() {
  const response = await fetchWithAuth('/api/v1/contacts');
  return response.json() as Promise<ContactRecord[]>;
}

export async function createContact(payload: Partial<ContactRecord>) {
  const response = await fetchWithAuth('/api/v1/contacts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return response.json() as Promise<ContactRecord>;
}

export async function getContact(id: string) {
  const response = await fetchWithAuth(`/api/v1/contacts/${encodeURIComponent(id)}`);
  return response.json() as Promise<ContactRecord>;
}

export async function updateContact(id: string, patch: Partial<ContactRecord>) {
  const response = await fetchWithAuth(`/api/v1/contacts/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
  return response.json() as Promise<ContactRecord>;
}

export async function deleteContact(id: string) {
  await fetchWithAuth(`/api/v1/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

api.listContacts = listContacts as any;
api.createContact = createContact as any;
api.getContact = getContact as any;
api.updateContact = updateContact as any;
api.deleteContact = deleteContact as any;