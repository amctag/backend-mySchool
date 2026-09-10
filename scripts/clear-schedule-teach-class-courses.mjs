import 'dotenv/config';
import pg from 'pg';

const FLAG = 'CLEAR_SCHEDULE_TEACH_CLASS_COURSES';
const confirmed =
  process.env[FLAG] === 'true' || process.argv.includes('--confirm');

if (!confirmed) {
  console.error(
    `Refusing to wipe teaching data. Set ${FLAG}=true (EasyPanel deploy) or pass --confirm.`,
  );
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new pg.Pool({ connectionString });

const countsSql = `
  SELECT
    (SELECT count(*) FROM weekly_schedules)::int AS weekly_schedules,
    (SELECT count(*) FROM weekly_schedule_details)::int AS weekly_schedule_details,
    (SELECT count(*) FROM class_courses)::int AS class_courses,
    (SELECT count(*) FROM teach)::int AS teach
`;

try {
  const before = await pool.query(countsSql);
  console.log(`[${FLAG}] BEFORE`, JSON.stringify(before.rows[0]));

  await pool.query(`
    TRUNCATE TABLE
      weekly_schedule_details,
      weekly_schedules,
      teach,
      class_courses
    RESTART IDENTITY CASCADE
  `);

  const after = await pool.query(countsSql);
  console.log(`[${FLAG}] AFTER`, JSON.stringify(after.rows[0]));
  console.log(
    `[${FLAG}] Wiped weekly schedules, class-courses, and teach. Remove ${FLAG} from EasyPanel so the next restart does not wipe again.`,
  );
} finally {
  await pool.end();
}
