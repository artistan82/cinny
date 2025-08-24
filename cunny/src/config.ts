import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (cunny/) if present
dotenv.config({ path: path.join(process.cwd(), '.env') });

function numEnv(name: string, fallback: number) {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

export const CONFIG = {
  PORT: process.env.PORT || '3000',
  EXPRESS_BODY_LIMIT: process.env.EXPRESS_BODY_LIMIT || '16kb',
  PUSH_PAYLOAD_MAX_BYTES: numEnv('PUSH_PAYLOAD_MAX_BYTES', 4096),
  MAX_DEVICES_PER_NOTIFY: numEnv('MAX_DEVICES_PER_NOTIFY', 200),

  RATE_LIMIT_WINDOW_MS: numEnv('RATE_LIMIT_WINDOW_MS', 60 * 1000),
  RATE_LIMIT_MAX: numEnv('RATE_LIMIT_MAX', 300),

  ADMIN_RATE_LIMIT_MAX: numEnv('ADMIN_RATE_LIMIT_MAX', 30),
  ADMIN_RATE_LIMIT_WINDOW_MS: numEnv('ADMIN_RATE_LIMIT_WINDOW_MS', 60 * 1000),

  SUBSCRIBE_RATE_LIMIT_MAX: numEnv('SUBSCRIBE_RATE_LIMIT_MAX', 60),
  SUBSCRIBE_RATE_LIMIT_WINDOW_MS: numEnv('SUBSCRIBE_RATE_LIMIT_WINDOW_MS', 60 * 1000),
};
