import express from 'express';
import { tickRun } from '../controllers/engine.controller.js';

const router = express.Router();

router.post('/:runId/tick', tickRun);

export default router;
