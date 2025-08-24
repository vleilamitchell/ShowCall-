import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/positionsController';
import * as ep from '../controllers/employeePositionsController';

export const positionsRouter = new Hono();

positionsRouter.use('*', authMiddleware);

// Scoped under departments
positionsRouter.get('/departments/:departmentId/positions', ctrl.list);
positionsRouter.post('/departments/:departmentId/positions', ctrl.create);
positionsRouter.get('/departments/:departmentId/positions/:positionId/eligible', ep.listEligible);

// Item-level
positionsRouter.patch('/positions/:positionId', ctrl.patch);
positionsRouter.delete('/positions/:positionId', ctrl.remove);
positionsRouter.patch('/positions/:positionId/employee-positions', ep.patch);


