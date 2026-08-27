import { pino, type Logger } from 'pino';
import { env, isProduction } from './config.ts';

/**
 * Technical service: structured JSON logs. Passwords, session tokens and external
 * API keys never reach the log — the redaction list is right below.
 */
const redactPaths = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'password',
  'token',
  '*.password',
  '*.token',
  '*.passwordHash',
  '*.secret',
];

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[redacted]' },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});

export type { Logger };
