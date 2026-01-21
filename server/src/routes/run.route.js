import express from 'express';
import { getRunnableStepsHandler, getRunStatus } from '../controllers/run.controller.js';

const router = express.Router();

router.get('/:runId/runnable-steps', getRunnableStepsHandler);
router.get('/:runId', getRunStatus);

export default router;
