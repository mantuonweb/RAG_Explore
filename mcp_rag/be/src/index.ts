import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import config from './config/env';
import documentRoutes from './routes/documentRoutes';
import mcpRoutes from './routes/mcpRoutes';

const app = express();

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.use('/api/documents', documentRoutes);
app.use('/api/mcp', mcpRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global JSON error handler — catches anything controllers let bubble up
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled error]', err);
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: 'Internal server error', detail: message });
});

app.listen(config.server.port, () => {
  console.log(`Server running on http://localhost:${config.server.port}`);
});
