import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

const schema = env('PRISMA_SCHEMA');
const schemaDir = path.dirname(schema);

export default defineConfig({
  schema,
  migrations: {
    path: path.join(schemaDir, 'migrations')
  },
  datasource: {
    url: env('DATABASE_URL')
  }
});
