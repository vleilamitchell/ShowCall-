import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import * as ctrl from '../../controllers/inventory/reservationsController';

export const inventoryReservationsRouter = new Hono();

inventoryReservationsRouter.use('*', authMiddleware);

inventoryReservationsRouter.post('/', ctrl.create);
inventoryReservationsRouter.get('/', ctrl.list);
inventoryReservationsRouter.patch('/:resId', ctrl.patch);


