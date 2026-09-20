import { z } from 'zod';
import { productConstraints } from './contracts/products-limits.ts';

/** A value that is the same on every machine belongs in `config`; `env` takes only the rest. */

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/**
 * Declared beside `config` rather than inside it: the threshold of a stuck run is derived from
 * these very fields, and a literal cannot read itself while it is still being built.
 */
const preparationJob = {
  name: 'product-preparation',
  /** A failed attempt is retried with a growing pause; past the limit the job stays `failed`. */
  retryLimit: 2,
  retryDelaySeconds: 10,
  retryBackoff: true,
  /** A model call takes tens of seconds; an attempt still active after this is presumed dead. */
  expireInSeconds: 5 * 60,
} as const;

/**
 * A queued job has to start within 5 s (PRD §6). Polling, not LISTEN/NOTIFY, is the floor:
 * one second leaves room for the fetch itself.
 */
const POLLING_INTERVAL_SECONDS = 1;

/** Runs left behind by a dead attempt are a handful, so the sweep looking for them is rare. */
const STUCK_SWEEP_INTERVAL_SECONDS = 60;

export const config = {
  http: {
    host: '0.0.0.0',
    port: 3000,
    /** Auth request bodies are tiny; large files go through the separate media route. */
    bodyLimitBytes: 256 * 1024,
    imageUpload: {
      /**
       * busboy stops reading a file past this many bytes and the route answers `file_too_large`;
       * `MediaService` checks the same number once more on the bytes it is handed.
       */
      maxFileBytes: productConstraints.maxImageBytes,
      maxFiles: 1,
      /**
       * The largest request the proxy lets through to the route. Paired with `request_body
       * max_size` in infra/caddy/Caddyfile — if the proxy stops first, it answers with its own bare
       * 413 and `file_too_large` never runs. Twice the frame rather than the frame plus the
       * multipart wrapper: a file just over the limit has to reach the api to be named as such.
       */
      bodyLimitBytes: 2 * productConstraints.maxImageBytes,
    },
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
    /**
     * Preparation runs are paid calls, so they have their own limit, separate from login (PRD §6.1).
     * Counted per card over every scope, from `product_preparation_runs.created_at` (T24 decision 3).
     */
    preparation: { maxRuns: 20, windowSeconds: 60 * 60 },
  },

  storage: {
    /**
     * The S3 client's own retries are the only ones (sad.md §9): the attempts and the per-attempt
     * timeout together have to fit inside `http.requestTimeoutMs`.
     */
    maxAttempts: 3,
    connectionTimeoutMs: 2_000,
    requestTimeoutMs: 4_000,
    /** DeleteObjects accepts at most this many keys per call. */
    deleteBatchSize: 1_000,
  },

  queue: {
    /** pg-boss keeps its own tables in this schema of the same database as the cards. */
    schema: 'pgboss',
    /** The api only enqueues and the worker takes one job at a time, so a small pool suffices. */
    poolSize: 4,
    pollingIntervalSeconds: POLLING_INTERVAL_SECONDS,
    preparation: {
      ...preparationJob,
      stuckSweepIntervalSeconds: STUCK_SWEEP_INTERVAL_SECONDS,
      /**
       * Past this age a `queued` or `running` run was left behind by an attempt nobody closed: a
       * full series of `retryLimit + 1` attempts of `expireInSeconds` each, the pauses between
       * them (with `retryBackoff` every next pause doubles, so they sum to `retryDelaySeconds ×
       * (2^retryLimit − 1)`), plus one polling interval and one sweep period of slack — ~16 min at
       * the current values. Derived rather than written out, so that retuning the queue cannot
       * drift away from the threshold; turning `retryBackoff` off would only leave it too
       * generous, which errs on the side of the live run.
       */
      stuckAfterSeconds:
        (preparationJob.retryLimit + 1) * preparationJob.expireInSeconds +
        preparationJob.retryDelaySeconds * (2 ** preparationJob.retryLimit - 1) +
        POLLING_INTERVAL_SECONDS +
        STUCK_SWEEP_INTERVAL_SECONDS,
    },
  },

  db: {
    poolSize: 10,
    connectTimeoutMs: 10_000,
    synchronize: false,
  },

  ai: {
    /**
     * One model for every call (ADR 0004): the parameter contract is identical to Opus 5, so
     * raising a single call back to Opus is a constant edit, not a code change. Not an env var —
     * swapping the model changes generation quality, response shape and cost per card, so it goes
     * through a commit and a review, not a container restart.
     */
    model: 'claude-sonnet-5',
    /** Per-call `effort`, so one call can be raised without touching the other two (ADR 0004). */
    effort: {
      texts: 'low',
      price: 'low',
      field: 'low',
    },
    webSearch: {
      maxUses: 2,
      /**
       * `user_location.country: 'UA'` (`ai/CLAUDE.md`'s original choice) is rejected by the
       * search provider with "Country code UA is not supported" — found on T27's live run
       * (2026-09-19). A timezone is the closest still-supported way to localize the search.
       */
      userTimezone: 'Europe/Kyiv',
    },
    /**
     * Deliberate cost reduction, not a model limit — `claude-sonnet-5` accepts up to 2576 px on
     * the longer side (~4784 visual tokens/frame). A product photo does not need that detail; if
     * recognition starts missing, raise this after remeasuring cost with `count_tokens`.
     */
    frameOptimization: {
      maxDimensionPx: 1568,
      jpegQuality: 80,
    },
    /** Additional frames upload without AI; recognition never sees more than this many. */
    maxFramesPerRequest: 3,
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

  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  /** The S3 key pair from the token page, not the `cfut_…` token value itself. */
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET: z.string().min(1, 'R2_BUCKET is required'),
  /**
   * Lives next to the credentials rather than in `config`: one bucket is described in one place,
   * otherwise writes and reads could end up pointing at different buckets (ADR 0007).
   */
  R2_PUBLIC_BASE_URL: z
    .url('R2_PUBLIC_BASE_URL must be the public address of the bucket')
    .refine((value) => !value.endsWith('/'), 'R2_PUBLIC_BASE_URL must not end with a slash')
    .refine(
      // Zod 4 still runs refinements after a failed `url` check, so the parse is guarded.
      (value) =>
        !URL.canParse(value) || !new URL(value).hostname.endsWith('.r2.cloudflarestorage.com'),
      'R2_PUBLIC_BASE_URL must be the public bucket address, not the S3 endpoint',
    ),

  /**
   * Optional on purpose (`ai/CLAUDE.md`): tests and CI never set it, and `AnthropicAdapter` is
   * only ever constructed with a real key by whatever composition root chooses to wire it up. A
   * required schema entry would make every test process load-fail without it.
   */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
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
