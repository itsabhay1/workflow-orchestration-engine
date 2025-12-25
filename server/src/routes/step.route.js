import express from 'express';
import { completeStep } from '../controllers/step.controller.js';

const router = express.Router();

router.post('/:runId/steps/:stepId/complete', completeStep);

export default router;