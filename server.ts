import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { timelineRouter } from './src/api/timelineRouter.ts';
import { initDatabase } from './src/db/database.ts';
import { initDiscordBot, getDiscordStatus } from './src/bot/discordClient.ts';
import { handleTimelineCommand } from './src/bot/commands.ts';
import { seedDemoData } from './src/services/seedService.ts';
import { query } from './src/db/database.ts';

dotenv.config();

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize Database and schema
  try {
    await initDatabase();
    // Check if initial database has events, if not seed default builder demo records
    const countCheck = await query<{ count: number }>('SELECT COUNT(*)::int as count FROM timeline_events');
    if ((countCheck.rows[0]?.count || 0) === 0) {
      console.log('🌱 Seeding initial Jobless Empire proof-of-work timeline data...');
      await seedDemoData();
    }
  } catch (dbErr) {
    console.error('Database initialization warning:', dbErr);
  }

  // Initialize Discord client in background
  initDiscordBot().catch((err) => console.error('Discord bot startup error:', err));

  // Health and Readiness Check endpoints
  const healthHandler = async (req: express.Request, res: express.Response) => {
    try {
      const dbCheck = await query('SELECT 1 as alive');
      res.json({
        status: 'ok',
        service: 'jobless-empire-timeline-bot',
        timestamp: new Date().toISOString(),
        database: dbCheck.rows.length > 0 ? 'connected' : 'error',
        discord: getDiscordStatus(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'degraded',
        error: err?.message || 'Database unavailable',
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.get('/ready', (req, res) => {
    res.json({ ready: true, version: '1.0.0' });
  });

  // REST API Routes
  app.use('/api/v1/timeline', timelineRouter);

  // Simulated Discord Bot interaction endpoint (for browser testing of buttons and commands)
  app.post('/api/v1/bot/simulate-command', async (req, res) => {
    try {
      const { subcommand, args = {}, context = {} } = req.body;
      const ctx = {
        userId: context.userId || 'demo_user_014',
        userHandle: context.userHandle || 'builder.jemp',
        isAdmin: context.isAdmin ?? true,
      };

      const result = await handleTimelineCommand(subcommand, args, ctx);
      res.json(result);
    } catch (err: any) {
      console.error('Command simulation failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/v1/bot/status', (req, res) => {
    res.json(getDiscordStatus());
  });

  // Vite integration for development vs production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`⚔️ Jobless Empire Timeline Bot service listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
