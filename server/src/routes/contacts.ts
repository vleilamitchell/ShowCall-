import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/contactsController';

export const contactsRouter = new Hono();

contactsRouter.use('*', authMiddleware);

contactsRouter.get('/contacts', ctrl.list);
contactsRouter.post('/contacts', ctrl.create);
contactsRouter.get('/contacts/:contactId', ctrl.get);
contactsRouter.patch('/contacts/:contactId', ctrl.patch);
contactsRouter.delete('/contacts/:contactId', ctrl.remove);


