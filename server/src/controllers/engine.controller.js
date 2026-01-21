import { tick } from "../services/engine.service.js";

export async function tickRun(req, res) {
    try{
        const { runId } = req.params;
        const executedSteps = Number(await tick(runId));

        res.json({
            message: 'Engine tick executed',
            stepsExecuted: executedSteps
        });

    } catch(err) {
        res.status(400).json({
            error: err.message
        });
    }
}