import pino from 'pino';
import path from 'path';
import { logger_level } from './server.config.js';
const logger = pino(
  {
    level: `${logger_level}`,
  },
  pino.transport({
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard', // adds readable timestamp
          ignore: 'pid,hostname', // removes noise
        },
      },
      {
        target: 'pino-pretty',
        options: {
          destination: path.join(process.cwd(), 'app.log'),
          colorize: false,
          ignore: 'pid,hostname',
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l o',
        },
      },
    ],
  })
);
export { logger };
