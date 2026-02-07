import express from 'express';
import executeRoute from './routes/execute.route.js';

const app = express();
app.use(express.json());

app.use('/execute', executeRoute);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`MCP running on port ${PORT}`);
});
