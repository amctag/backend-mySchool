import { execSync } from 'node:child_process';

/**
 * Production previously failed on these migrations.
 * Mark them rolled back so migrate deploy can re-run the now-idempotent SQL.
 */
const FAILED_MIGRATIONS_TO_RETRY = [
  '20260812160000_exam_schedule_detail_start_time',
  '20260903140000_grade_form_average_int',
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

for (const name of FAILED_MIGRATIONS_TO_RETRY) {
  tryResolve(name, '--rolled-back');
}

console.log('Running prisma migrate deploy...');
run('npx prisma migrate deploy', { inherit: true });
