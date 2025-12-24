import express from 'express';
import { createWorkflow, listWorkflows, runWorkflow } from '../controllers/workflow.controller.js';

const router = express.Router();

router.post('/', createWorkflow);
router.get('/', listWorkflows);
router.post('/:id/run', runWorkflow);


export default router;
