import express from 'express';
import { getRunnableStepsHandler } from '../controllers/run.controller.js';

const router = express.Router();

router.get('/:runId/runnable-steps', getRunnableStepsHandler);

export default router;
