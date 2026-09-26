import { execSync } from 'node:child_process';

/**
 * Production previously failed on these migrations.
 * Mark them rolled back so migrate deploy can re-run the now-idempotent SQL.
 */
const FAILED_MIGRATIONS_TO_RETRY = [
  '20260812160000_exam_schedule_detail_start_time',
  '20260903140000_grade_form_average_int',
  '20260916110000_person_paid',
  '20260921140000_teacher_supervisors_class',
  '20260926120000_add_accounting_phase_1',
  '20260926120000_agenda_draft_saved_status', // renamed → 20260926160000
  '20260926150000_account_school_scope',
  '20260926160000_agenda_draft_saved_status',
];

function run(command, { inherit = false } = {}) {
  try {
    return execSync(command, {
      stdio: inherit ? 'inherit' : 'pipe',
      encoding: 'utf8',
    });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? error?.stdout;
    const stderr = error?.stderr?.toString?.() ?? error?.stderr;
    if (stdout) {
      console.error(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }
    if (!stdout && !stderr && error?.message) {
      console.error(error.message);
    }
    throw error;
  }
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

if (process.env.CLEAR_SCHEDULE_TEACH_CLASS_COURSES === 'true') {
  console.log(
    'CLEAR_SCHEDULE_TEACH_CLASS_COURSES=true — wiping weekly schedules, class-courses, and teach...',
  );
  run('node scripts/clear-schedule-teach-class-courses.mjs --confirm', {
    inherit: true,
  });
}
