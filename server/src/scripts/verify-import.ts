import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDatabase } from '../lib/db';

async function main() {
  const db = await getDatabase();
  const runOne = async (q: string) => (db as any).execute(sql.raw(q));

  const employeesTotal = await runOne('select count(*)::int as c from employees');
  const employeesNoDept = await runOne('select count(*)::int as c from employees where department_id is null');
  const empPosTotal = await runOne('select count(*)::int as c from employee_positions');
  const empPosMismatch = await runOne(`
    select count(*)::int as c
    from employee_positions ep
    join employees e on e.id = ep.employee_id
    where ep.department_id <> e.department_id
  `);
  const seriesCount = await runOne('select count(*)::int as c from event_series');
  const seriesRulesCount = await runOne('select count(*)::int as c from event_series_rules');

  const val = (r: any) => (Array.isArray(r.rows) ? r.rows[0]?.c : (r as any)[0]?.c);

  console.log(JSON.stringify({
    employees: { total: val(employeesTotal), withoutDepartment: val(employeesNoDept) },
    employeePositions: { total: val(empPosTotal), departmentMismatch: val(empPosMismatch) },
    recurringSeries: { series: val(seriesCount), rules: val(seriesRulesCount) }
  }, null, 2));
}

main().catch((err) => { console.error('verify-import failed:', err); process.exit(1); });
