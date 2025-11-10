import { defineConfig, env } from 'prisma/config';

const schema = env('PRISMA_SCHEMA') ?? 'prisma/schema.sqlite.prisma';
const schemaDir = (() => {
  const normalized = schema.replace(/\\/g, '/');
  const segments = normalized.split('/');
  segments.pop(); // drop schema file
  return segments.join('/') || '.';
})();

export default defineConfig({
  schema,
  migrations: {
    path: `${schemaDir}/migrations`
  },
  engine: env('PRISMA_ENGINE') ?? 'classic',
  datasource: {
    url: env('DATABASE_URL') ?? 'file:./prisma/data/dev.db'
  }
});
