import express, { type Request, type Response } from 'express';
import { PORT } from './config/server.config.js';

const app = express();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
