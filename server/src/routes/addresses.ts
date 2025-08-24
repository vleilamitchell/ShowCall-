import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/addressesController';

export const addressesRouter = new Hono();

// Protected routes
addressesRouter.use('*', authMiddleware);

addressesRouter.get('/', ctrl.list);
addressesRouter.post('/', ctrl.create);
addressesRouter.get('/:addressId', ctrl.get);
addressesRouter.patch('/:addressId', ctrl.patch);
addressesRouter.delete('/:addressId', ctrl.remove);


