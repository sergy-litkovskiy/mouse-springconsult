import { z } from 'zod';

/** A value that is the same on every machine belongs in `config`; `env` takes only the rest. */

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const config = {
  http: {
    host: '0.0.0.0',
    port: 3000,
    /** Auth request bodies are tiny; large files go through the separate media route. */
    bodyLimitBytes: 256 * 1024,
    requestTimeoutMs: 15_000,
  },

  session: {
    cookieName: 'mouse_session',
    /** Regular sign-in: the cookie has no Max-Age and dies with the browser. */
    ttlSeconds: 72 * HOUR_SECONDS,
    /** "Remember me": the cookie gets a Max-Age and the token lives just as long. */
    rememberMeTtlSeconds: 30 * DAY_SECONDS,
    issuer: 'mouse.springconsult.com.ua',
    audience: 'mouse-admin',
    /** HS256: one process signs and verifies, so asymmetry would buy nothing here. */
    algorithm: 'HS256',
    cookiePath: '/',
  },

  password: {
    /** argon2id, OWASP profile: 19 MiB of memory, 2 iterations, parallelism 1. */
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  },

  rateLimit: {
    /** Password guessing limit. Keyed by IP, sliding window. */
    login: { max: 10, timeWindowMs: 5 * 60 * 1000 },
    global: { max: 300, timeWindowMs: 60 * 1000 },
  },

  db: {
    poolSize: 10,
    connectTimeoutMs: 10_000,
    synchronize: false,
  },
} as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Signing secret of the session JWT. 32+ bytes is the minimum for HS256. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Read by the migration process alone; the password is never stored in the repository. */
  ADMIN_BOOTSTRAP_EMAIL: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .default('admin@mouse.springconsult.com.ua'),
  ADMIN_BOOTSTRAP_NAME: z.string().trim().min(1).default('Адміністратор'),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
