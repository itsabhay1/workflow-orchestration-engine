import express from 'express';
import { runContainer } from '../executor/docker.executor.js';

const router = express.Router();

router.post('/', async (req, res) => {
    const {
        stepRunId,
        image,
        command,
        timeout,
        resources,
        tenantId
    } = req.body;

    if (!stepRunId || !image || !command) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
        const result = await runContainer({
            stepRunId,
            image,
            command,
            timeout,
            resources,
            tenantId
        });

        res.json({
            status: 'COMPLETED',
            ...result
        });

    } catch (err) {
        res.json({
            status: 'FAILED',
            exitCode: err.exitCode,
            oom: err.oom || false,
            logs: err.logs || '',
            error: err.message
        });
    }
});

export default router;
