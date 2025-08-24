import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/assignmentsController';

export const assignmentsRouter = new Hono();

assignmentsRouter.use('*', authMiddleware);

assignmentsRouter.get('/departments/:departmentId/assignments', ctrl.listByDepartment);
assignmentsRouter.post('/departments/:departmentId/assignments', ctrl.create);
assignmentsRouter.patch('/assignments/:assignmentId', ctrl.patch);
assignmentsRouter.delete('/assignments/:assignmentId', ctrl.remove);


