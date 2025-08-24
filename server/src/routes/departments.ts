import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/departmentsController';

export const departmentsRouter = new Hono();

departmentsRouter.use('*', authMiddleware);

departmentsRouter.get('/', ctrl.list);
departmentsRouter.post('/', ctrl.create);
departmentsRouter.get('/:departmentId', ctrl.get);
departmentsRouter.patch('/:departmentId', ctrl.patch);



