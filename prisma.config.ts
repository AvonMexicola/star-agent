import { defineConfig } from 'prisma/config';

// Generation needs no running database or environment/credential files.
// Versioned SQL migrations remain under server/migrations; use npm run db:migrate.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://localhost/star_agent' },
});
