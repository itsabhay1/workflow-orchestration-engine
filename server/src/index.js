import express from 'express';
import workflowRoutes from './routes/workflow.route.js';
import runRoutes from './routes/run.route.js';
import stepRoutes from './routes/step.route.js';
import engineRoutes from './routes/engine.route.js';
import { startEngineWorker } from './worker/engine.worker.js';
import { recoverStuckSteps } from './services/recovery.service.js';
import { initShutdown } from './utils/shutdown.utils.js';
import { getRunningStepRunIds, stopAllContainers } from './services/dockerExecutor.service.js';
import { revertRunningStepsToPending } from './services/shutdownRecovery.service.js';
import 'dotenv/config';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({status: 'OK'});
});

app.use('/workflows', workflowRoutes);
app.use('/runs', runRoutes);
app.use('/runs', stepRoutes);
app.use('/runs', engineRoutes);


const server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await recoverStuckSteps();
    startEngineWorker();
});

initShutdown(async () => {
  console.log('Stopping engine...');

  console.log('Closing HTTP server...');
  await new Promise(res => server.close(res));

  const runningSteps = getRunningStepRunIds();    // capture before killing

  console.log('Stopping containers...');
  await stopAllContainers();

  await revertRunningStepsToPending(runningSteps);
});