import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import { PORT } from './config/server.config.js';
import apiRouter from './routes/index.js';
import { logger } from './config/logger.config.js';

const app = express();

const allowedFrontendOrigins = new Set(
  (
    process.env.FRONTEND_ORIGINS ??
    'http://localhost:5500,http://127.0.0.1:5500'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedFrontendOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['Accept-Ranges', 'Content-Length', 'Content-Range'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve transcoded HLS stream segments (.m3u8, .ts)
app.use('/streams', express.static(path.resolve('src/public/output')));
// Serve raw uploaded videos (e.g. mp4, avi) for direct playback
app.use('/videos', express.static(path.resolve('src/public/data/uploads')));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'renet-streaming' });
});

app.use('/api', apiRouter);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
