import { Context } from 'hono';
import { AppError } from '../../errors';
import { createReservation, listReservations, updateReservation } from '../../services/inventory/reservations';

export async function create(c: Context) {
  const body = await c.req.json();
  try {
    const res = await createReservation({
      itemId: String(body.itemId || '').trim(),
      locationId: String(body.locationId || '').trim(),
      eventId: String(body.eventId || '').trim(),
      qtyBase: Number(body.qtyBase),
      startTs: String(body.startTs),
      endTs: String(body.endTs),
    });
    return c.json(res, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function list(c: Context) {
  const rows = await listReservations({
    itemId: c.req.query('itemId') || undefined,
    eventId: c.req.query('eventId') || undefined,
  });
  return c.json(rows);
}

export async function patch(c: Context) {
  const body = await c.req.json();
  const action = String(body.action || '').trim();
  if (!['RELEASE', 'FULFILL'].includes(action)) return c.json({ error: 'action must be RELEASE or FULFILL' }, 400);
  const resId = c.req.param('resId');
  try {
    const updated = await updateReservation(resId, action as any);
    return c.json(updated);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}


