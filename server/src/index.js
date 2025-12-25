import express from 'express';
import workflowRoutes from './routes/workflow.route.js';
import runRoutes from './routes/run.route.js';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({status: 'OK'});
});

app.use('/workflows', workflowRoutes);
app.use('/runs', runRoutes);


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})