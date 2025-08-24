import { Context } from 'hono';
import { AppError } from '../../errors';
import { createInventoryItem, getInventoryItem, listInventoryItems, patchInventoryItem } from '../../services/inventory/items';

export async function list(c: Context) {
  const q = c.req.query('q') || undefined;
  const itemType = c.req.query('item_type') || undefined;
  const activeParam = c.req.query('active');
  const active = activeParam == null ? undefined : activeParam === 'true';
  try {
    const rows = await listInventoryItems({ q, itemType, active });
    return c.json(rows);
  } catch (err) {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    throw err;
  }
}

export async function create(c: Context) {
  try {
    const body = await c.req.json();
    const rec = await createInventoryItem({
      sku: String(body.sku || '').trim(),
      name: String(body.name || '').trim(),
      // Map open-text type to existing enum bucket for seed schemas
      itemType: String(body.itemType || '').trim() || 'Consumable',
      baseUnit: String(body.baseUnit || '').trim(),
      schemaId: String(body.schemaId || '').trim(),
      attributes: body.attributes ?? {},
      categoryId: body.categoryId ?? null,
    });
    return c.json(rec, 201);
  } catch (error) {
    const msg = (error as any)?.message;
    if (typeof msg === 'string' && msg.startsWith('attributes invalid:')) {
      return c.json({ error: msg }, 400);
    }
    if (error instanceof AppError) return c.json({ error: error.message }, error.status);
    throw error;
  }
}

export async function get(c: Context) {
  const itemId = c.req.param('itemId');
  const item = await getInventoryItem(itemId);
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(item);
}

export async function patch(c: Context) {
  try {
    const itemId = c.req.param('itemId');
    const body = await c.req.json();
    const updated = await patchInventoryItem(itemId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      baseUnit: typeof body.baseUnit === 'string' ? body.baseUnit : undefined,
      attributes: 'attributes' in body ? body.attributes : undefined,
      active: typeof body.active === 'boolean' ? body.active : undefined,
    });
    return c.json(updated);
  } catch (error) {
    const msg = (error as any)?.message;
    if (typeof msg === 'string' && msg.startsWith('attributes invalid:')) {
      return c.json({ error: msg }, 400);
    }
    if (error instanceof AppError) return c.json({ error: error.message }, error.status);
    throw error;
  }
}


