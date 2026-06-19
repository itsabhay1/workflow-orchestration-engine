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

    console.log('[MCP_DEBUG] Incoming /execute request', {
        stepRunId,
        image,
        command,
        timeout
    });

    if (!stepRunId || !image || !command) {
        console.log('[MCP_DEBUG] Invalid /execute payload', {
            stepRunId,
            image,
            command,
            timeout
        });
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

        console.log('[MCP_DEBUG] /execute completed', {
            stepRunId,
            exitCode: result.exitCode
        });

        res.json({
            status: 'COMPLETED',
            ...result
        });

    } catch (err) {
        console.log('[MCP_DEBUG] /execute failed', {
            stepRunId,
            exitCode: err.exitCode,
            error: err.message
        });
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
