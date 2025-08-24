import { Context } from 'hono';
import { AppError } from '../../errors';
import { postTransaction } from '../../services/inventory/postTransaction';
import { listTransactions } from '../../services/inventory/transactions';

export async function post(c: Context) {
  const body = await c.req.json();
  try {
    const entries = await postTransaction({
      itemId: String(body.itemId || '').trim(),
      locationId: String(body.locationId || '').trim(),
      eventType: String(body.eventType || '').trim(),
      qtyBase: typeof body.qtyBase === 'number' ? body.qtyBase : undefined,
      qty: typeof body.qty === 'number' ? body.qty : undefined,
      unit: typeof body.unit === 'string' ? body.unit : undefined,
      lotId: body.lotId ?? null,
      serialNo: body.serialNo ?? null,
      costPerBase: body.costPerBase ?? null,
      sourceDoc: body.sourceDoc ?? null,
      postedBy: String(body.postedBy || '').trim(),
      transfer: body.transfer ?? null,
    });
    return c.json(entries, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function list(c: Context) {
  const rows = await listTransactions({
    itemId: c.req.query('itemId') || undefined,
    locationId: c.req.query('locationId') || undefined,
    eventType: c.req.query('eventType') || undefined,
    from: c.req.query('from') || undefined,
    to: c.req.query('to') || undefined,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    order: (c.req.query('order') as any) || undefined,
  });
  return c.json(rows);
}


