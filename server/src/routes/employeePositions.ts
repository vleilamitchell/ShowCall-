import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/employeePositionsController';

export const employeePositionsRouter = new Hono();

employeePositionsRouter.use('*', authMiddleware);

employeePositionsRouter.post('/employee-positions', ctrl.create);


