import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/shiftsController';

export const shiftsRouter = new Hono();

shiftsRouter.use('*', authMiddleware);

// Scoped under departments
shiftsRouter.get('/departments/:departmentId/shifts', ctrl.listByDepartment);
shiftsRouter.post('/departments/:departmentId/shifts', ctrl.create);

// Item-level
shiftsRouter.get('/shifts/:shiftId', ctrl.get);
shiftsRouter.patch('/shifts/:shiftId', ctrl.patch);
shiftsRouter.delete('/shifts/:shiftId', ctrl.remove);


