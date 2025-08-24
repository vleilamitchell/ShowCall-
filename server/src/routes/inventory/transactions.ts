import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import * as ctrl from '../../controllers/inventory/transactionsController';

export const inventoryTransactionsRouter = new Hono();

inventoryTransactionsRouter.use('*', authMiddleware);

inventoryTransactionsRouter.post('/', ctrl.post);
inventoryTransactionsRouter.get('/', ctrl.list);


