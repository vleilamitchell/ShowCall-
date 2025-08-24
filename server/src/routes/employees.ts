import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/employeesController';

export const employeesRouter = new Hono();

employeesRouter.use('*', authMiddleware);

// Scoped under departments
employeesRouter.get('/departments/:departmentId/employees', ctrl.listByDepartment);
employeesRouter.post('/departments/:departmentId/employees', ctrl.create);

// Item-level
employeesRouter.patch('/employees/:employeeId', ctrl.patch);
employeesRouter.delete('/employees/:employeeId', ctrl.remove);


