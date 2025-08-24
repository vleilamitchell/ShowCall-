import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/areasController';

export const areasRouter = new Hono();

areasRouter.use('*', authMiddleware);

areasRouter.patch('/order', ctrl.reorder);
areasRouter.get('/', ctrl.list);
areasRouter.post('/', ctrl.create);
areasRouter.patch('/:areaId', ctrl.patch);
areasRouter.delete('/:areaId', ctrl.remove);



