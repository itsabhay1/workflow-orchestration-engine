import express from 'express';
import workflowRoutes from './routes/workflow.route.js';
import runRoutes from './routes/run.route.js';
import stepRoutes from './routes/step.route.js';
import engineRoutes from './routes/engine.route.js';
import { startEngineWorker } from './worker/engine.worker.js';

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


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startEngineWorker();
})