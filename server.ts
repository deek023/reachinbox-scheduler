import express from 'express';
import cors from 'cors';
import cookieSession from 'cookie-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Import Bull Board
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

// Import Services & Worker
import { initDatabase } from './src/server/db.ts';
import { initElasticsearch } from './src/server/elasticsearch.ts';
import { emailQueue } from './src/server/queue.ts';
import { emailWorker } from './src/server/worker.ts';
import { apiRouter } from './src/server/routes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session middleware for Google OAuth & authenticated state
  app.use(
    cookieSession({
      name: 'reachinbox_session',
      keys: [process.env.SESSION_SECRET || 'reachinbox_default_secret_key_38741'],
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: isProduction,
      sameSite: 'lax',
    })
  );

  // Initialize PostgreSQL schema and database connection
  await initDatabase();

  // Initialize Elasticsearch index and connection
  await initElasticsearch();

  // ==========================================
  // Real Bull Board Integration at /admin/queues
  // ==========================================
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());
  console.log(`[Bull Board] Dashboard mounted at http://localhost:${PORT}/admin/queues`);

  // Mount API Router
  app.use('/api', apiRouter);

  // Frontend Serving (Dev vs Production)
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 ReachInbox Scheduler running on http://localhost:${PORT}`);
    console.log(`📊 Bull Board Queue Monitor: http://localhost:${PORT}/admin/queues`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
