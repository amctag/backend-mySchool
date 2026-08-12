import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Migrations removed from the codebase but may still be marked failed/applied
 * in production _prisma_migrations (e.g. after reverting main to album-only).
 */
const ORPHANED_MIGRATION_NAMES = [
  '20260812160000_exam_schedule_detail_start_time',
  '20260812150000_exam_schedules',
];

function run(command, { inherit = false } = {}) {
  execSync(command, {
    stdio: inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
  });
}

function tryResolve(name, flag) {
  try {
    run(`npx prisma migrate resolve ${flag} ${name}`);
    console.log(`Resolved migration ${name} (${flag})`);
    return true;
  } catch {
    return false;
  }
}

for (const name of ORPHANED_MIGRATION_NAMES) {
  if (existsSync(`prisma/migrations/${name}/migration.sql`)) {
    continue;
  }

  // Failed duplicate-column case: column already exists from prior migration.
  if (!tryResolve(name, '--applied')) {
    tryResolve(name, '--rolled-back');
  }
}

console.log('Running prisma migrate deploy...');
run('npx prisma migrate deploy', { inherit: true });
