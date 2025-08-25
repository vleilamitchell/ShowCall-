import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/employeePositionsController';

export const employeePositionsRouter = new Hono();

employeePositionsRouter.use('*', authMiddleware);

employeePositionsRouter.post('/employee-positions', ctrl.create);
employeePositionsRouter.get('/departments/:departmentId/employee-positions', ctrl.listByDepartment);
employeePositionsRouter.delete('/employee-positions/:employeePositionId', ctrl.removeById);
employeePositionsRouter.delete('/departments/:departmentId/positions/:positionId/employee-positions/:employeeId', ctrl.removeByComposite);


