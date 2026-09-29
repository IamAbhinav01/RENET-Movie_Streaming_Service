import express, { type Request, type Response } from 'express';
import cors from 'cors';
import path from 'path';
import { PORT } from './config/server.config.js';
import apiRouter from './routes/index.js';
import { logger } from './config/logger.config.js';

const app = express();

app.use(cors());
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
