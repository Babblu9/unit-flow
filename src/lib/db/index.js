import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

// Lazy-initialised connection: avoids crashing during Next.js build
// when DATABASE_URL is not available (Vercel build phase).
let _db = null;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set \u2014 cannot connect to the database');
    }
    const sql = neon(url);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Proxy that forwards every property access to the lazily-created drizzle
// instance. Consumers can do `import { db } from './index.js'` and use
// `db.select(...)` etc. \u2014 the real connection is only established on the
// first actual database call at runtime, never during the build.
export const db = new Proxy({}, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = real[prop];
    if (typeof value === 'function') {
      return value.bind(real);
    }
    return value;
  },
});
