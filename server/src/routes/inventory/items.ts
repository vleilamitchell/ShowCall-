import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import * as ctrl from '../../controllers/inventory/itemsController';
import { getItemSummary } from '../../services/inventory/projections';

export const inventoryItemsRouter = new Hono();

inventoryItemsRouter.use('*', authMiddleware);

inventoryItemsRouter.get('/', ctrl.list);
inventoryItemsRouter.post('/', ctrl.create);
inventoryItemsRouter.get('/:itemId', ctrl.get);
inventoryItemsRouter.patch('/:itemId', ctrl.patch);

// Item summary endpoint parity
inventoryItemsRouter.get('/:itemId/summary', async (c) => {
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const summary = await getItemSummary(c.req.param('itemId'), { from, to });
  return c.json(summary);
});


