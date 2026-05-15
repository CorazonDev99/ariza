import pino from 'pino';
import { config } from '../config';

const isDev = config.nodeEnv !== 'production';

export const logger = pino({
  level: config.logLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: { service: 'raport-bot' },
});

export type Logger = typeof logger;
