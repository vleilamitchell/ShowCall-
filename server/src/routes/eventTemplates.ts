import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/eventTemplatesController';
import * as applyCtrl from '../controllers/templateApplicationController';

export const eventTemplatesRouter = new Hono();

eventTemplatesRouter.use('*', authMiddleware);

// Templates CRUD
eventTemplatesRouter.get('/event-templates', ctrl.listTemplates);
eventTemplatesRouter.post('/event-templates', ctrl.createTemplate);
eventTemplatesRouter.get('/event-templates/:templateId', ctrl.getTemplate);
eventTemplatesRouter.patch('/event-templates/:templateId', ctrl.patchTemplate);

// Versions + requirements
eventTemplatesRouter.get('/event-templates/:templateId/versions', ctrl.listVersions);
eventTemplatesRouter.post('/event-templates/:templateId/versions', ctrl.createVersion);
eventTemplatesRouter.post('/event-template-versions/:versionId/activate', ctrl.activateVersion);
eventTemplatesRouter.get('/event-template-versions/:versionId/requirements', ctrl.getRequirements);
eventTemplatesRouter.put('/event-template-versions/:versionId/requirements', ctrl.putRequirements);
// Version areas
eventTemplatesRouter.get('/event-template-versions/:versionId/areas', ctrl.getVersionAreas);
eventTemplatesRouter.put('/event-template-versions/:versionId/areas', ctrl.putVersionAreas);

// Apply to event
eventTemplatesRouter.post('/events/:eventId/apply-template', applyCtrl.applyToEvent);


