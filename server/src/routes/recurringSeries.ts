import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/recurringSeriesController';

export const recurringSeriesRouter = new Hono();

recurringSeriesRouter.use('*', authMiddleware);

// Series CRUD
recurringSeriesRouter.get('/', ctrl.list);
recurringSeriesRouter.post('/', ctrl.create);
recurringSeriesRouter.get('/:seriesId', ctrl.get);
recurringSeriesRouter.patch('/:seriesId', ctrl.patch);
recurringSeriesRouter.delete('/:seriesId', ctrl.remove);

// Areas nested under series
recurringSeriesRouter.get('/:seriesId/areas', ctrl.listAreas);
recurringSeriesRouter.put('/:seriesId/areas', ctrl.replaceAreas);
recurringSeriesRouter.post('/:seriesId/areas', ctrl.addArea);
recurringSeriesRouter.delete('/:seriesId/areas/:areaId', ctrl.removeArea);

// Preview and generate
recurringSeriesRouter.post('/:seriesId/preview', ctrl.preview);
recurringSeriesRouter.post('/:seriesId/generate', ctrl.generate);


