#!/usr/bin/env node
/**
 * Legacy parent/student dry-run importer (READ-ONLY by default).
 *
 * Default behavior is DRY-RUN: parses the legacy MariaDB dump, checks the
 * live PostgreSQL target with SELECT-only queries, and prints the import
 * plan. NOTHING is written unless --commit is passed explicitly.
 *
 * Usage:
 *   node scripts/legacy-parent-student-dryrun.mjs [--commit] [--batch ID]
 *
 * Scope: personne -> Person, parent -> Parent, student -> Student
 * (school_id = 3). NO accounting. NO mapping tables yet.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import rulesPkg from "./legacy-migration-rules.cjs";

const {
  s,
  blank,
  normEmail,
  NATIONALITY,
  GOVERNORATE,
  REGION,
  backendUsername,
  resolveStudentLegacyParentId,
  deriveStudentLastName,
  classifyGenderValue,
  buildBackendUsername,
  findExistingMapping,
  validateMappedTarget,
  parseImporterArgs,
  requiresMappingInfrastructure,
  nullishText,
  nullableDate,
  resolveLookupIds,
  buildPersonCreate,
} = rulesPkg;

export {
  resolveStudentLegacyParentId,
  deriveStudentLastName,
  classifyGenderValue,
  buildBackendUsername,
  findExistingMapping,
  validateMappedTarget,
  parseImporterArgs,
  requiresMappingInfrastructure,
  nullishText,
  nullableDate,
};

dotenv.config({ quiet: true });

const COMMIT = process.argv.includes("--commit");
const DUMP = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../legacy/myschoolboard_makarem_preparatory_school.sql",
);
const SCHOOL_ID = 3;

// ---------------------------------------------------------------- parsing
function splitTuples(vals) {
  const rows = [];
  let cur = [],
    i = 0;
  const n = vals.length;
  let inStr = false,
    esc = false,
    depth = 0;
  while (i < n) {
    const ch = vals[i];
    if (inStr) {
      cur.push(ch);
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "'") inStr = false;
    } else if (ch === "'") {
      inStr = true;
      cur.push(ch);
    } else if (ch === "(") {
      if (depth === 0) cur = [];
      else cur.push(ch);
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) rows.push(cur.join(""));
      else cur.push(ch);
    } else if (depth > 0) {
      cur.push(ch);
    }
    i++;
  }
  return rows;
}

function splitFields(row) {
  const fields = [];
  let cur = [],
    inStr = false,
    esc = false;
  for (const ch of row) {
    if (inStr) {
      cur.push(ch);
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "'") inStr = false;
    } else if (ch === "'") {
      inStr = true;
      cur.push(ch);
    } else if (ch === ",") {
      fields.push(cur.join("").trim());
      cur = [];
    } else {
      cur.push(ch);
    }
  }
  fields.push(cur.join("").trim());
  return fields;
}

function unquote(v) {
  if (v === "NULL") return null;
  if (v.length >= 2 && v[0] === "'" && v[v.length - 1] === "'")
    return v
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

function loadTable(sql, name) {
  const cols = [];
  const rows = [];
  const pat = new RegExp(
    "INSERT INTO `" + name + "` \\(([^)]+)\\) VALUES\\n?(.*?);",
    "gs",
  );
  let m;
  let colNames = null;
  while ((m = pat.exec(sql)) !== null) {
    if (!colNames)
      colNames = m[1].split(",").map((c) => c.trim().replace(/`/g, ""));
    for (const tup of splitTuples(m[2])) {
      const vals = splitFields(tup).map(unquote);
      if (vals.length !== colNames.length) continue;
      rows.push(Object.fromEntries(colNames.map((c, i) => [c, vals[i]])));
    }
  }
  return rows;
}

// ---------------------------------------------------------------- helpers
// Pure rules live in ./legacy-migration-rules.cjs (single source of truth).




async function main() {
  const sql = fs.readFileSync(DUMP, "utf8");
  const personne = loadTable(sql, "personne");
  const parent = loadTable(sql, "parent");
  const student = load_table_student(sql);
  const nationalities = loadTable(sql, "nationality");
  const governorates = loadTable(sql, "governorate");
  const regions = loadTable(sql, "region");
  const villages = loadTable(sql, "village");

  function load_table_student(sqlText) {
    return loadTable(sqlText, "student");
  }

  const natById = Object.fromEntries(nationalities.map((r) => [r.id, r.title]));
  const govById = Object.fromEntries(governorates.map((r) => [r.id, r.title]));
  const regById = Object.fromEntries(regions.map((r) => [r.id, r.title]));
  const vilById = Object.fromEntries(villages.map((r) => [r.id, r.title]));

  const perById = new Map(personne.map((p) => [p.ID, p]));
  const parById = new Map(parent.map((p) => [p.ID, p]));
  const parByPerson = new Map(parent.map((p) => [p.person_id, p.ID]));

  // ---- target read-only state ----
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const q = (text, params) => pool.query(text, params);
  const before = {};
  try {
    before.persons = Number(
      (await q("SELECT COUNT(*) AS n FROM persons WHERE school_id=$1", [SCHOOL_ID])).rows[0].n,
    );
    before.parents = Number(
      (
        await q(
          "SELECT COUNT(*) AS n FROM parents p WHERE EXISTS (SELECT 1 FROM persons per WHERE per.id=p.person_id AND per.school_id=$1) OR EXISTS (SELECT 1 FROM students s JOIN persons per ON per.id=s.person_id WHERE s.parent_id=p.id AND per.school_id=$1)",
          [SCHOOL_ID],
        )
      ).rows[0].n,
    );
    before.students = Number(
      (
        await q(
          "SELECT COUNT(*) AS n FROM students s JOIN persons per ON per.id=s.person_id WHERE per.school_id=$1",
          [SCHOOL_ID],
        )
      ).rows[0].n,
    );
    before.accounts = Number(
      (await q("SELECT COUNT(*) AS n FROM accounts WHERE school_id=$1", [SCHOOL_ID])).rows[0].n,
    );
    var targetEmails = new Set(
      (await q("SELECT lower(email) AS e FROM persons WHERE email IS NOT NULL")).rows.map((r) => r.e),
    );
    var targetIdentities = new Set(
      (await q("SELECT identity_number AS v FROM persons WHERE identity_number IS NOT NULL")).rows.map(
        (r) => r.v,
      ),
    );
    var targetUsernames = new Set(
      (await q("SELECT username AS u FROM persons WHERE school_id=$1", [SCHOOL_ID])).rows.map((r) => r.u),
    );
    var targetGovNames = new Set(
      (await q("SELECT name FROM governorates")).rows.map((r) => r.name),
    );
    var targetRegNames = new Set((await q("SELECT name FROM regions")).rows.map((r) => r.name));
    var targetNatNames = new Set(
      (await q("SELECT name FROM nationalities")).rows.map((r) => r.name),
    );
    var govIdByName = Object.fromEntries(
      (await q("SELECT id, name FROM governorates")).rows.map((r) => [r.name, r.id]),
    );
    var regIdByName = Object.fromEntries(
      (await q("SELECT id, name FROM regions")).rows.map((r) => [r.name, r.id]),
    );
  } finally {
    await pool.end();
  }
  const lookupCtx = {
    natById,
    govById,
    regById,
    vilById,
    NATIONALITY,
    GOVERNORATE,
    REGION,
    govIdByName,
    regIdByName,
  };

  // ---- plan ----
  const report = {
    mode: COMMIT ? "COMMIT (NOT EXECUTED IN DRY-RUN CONTEXT)" : "DRY-RUN",
    legacy: { parents: parent.length, students: student.length, personne: personne.length },
    parents: { CREATE: [], SKIP: [], COLLISION: [], REVIEW: [], INVALID: [] },
    students: { CREATE: [], SKIP: [], COLLISION: [], REVIEW: [], INVALID: [] },
    links: { planned: 0, source: 0 },
    stats: {
      generatedUsernames: 0,
      generatedUsernameCollisions: 0,
      preservedUsernames: 0,
      emailCollisionsTarget: 0,
      emailCollisionsBatch: 0,
      identityCollisionsTarget: 0,
      identityCollisionsBatch: 0,
      usernameCollisionsTarget: 0,
      lookups: {},
      motherPhonesPreserved: 0,
      motherPhonesUnmapped: 0,
      bcryptRequired: 0,
    },
  };
  const batchEmails = new Set();
  const batchIdentities = new Set();
  const batchUsernames = new Set(targetUsernames);
  const newParentByLegacy = new Map(); // legacy parent.ID -> plan ref
  const newPersonByLegacy = new Map(); // legacy personne.ID -> plan ref

  function checkContacts(email, identity) {
    const issues = [];
    if (email) {
      if (targetEmails.has(email)) {
        report.stats.emailCollisionsTarget++;
        issues.push("email-target-collision");
      } else if (batchEmails.has(email)) {
        report.stats.emailCollisionsBatch++;
        issues.push("email-batch-duplicate");
      } else batchEmails.add(email);
    }
    if (identity) {
      if (targetIdentities.has(identity)) {
        report.stats.identityCollisionsTarget++;
        issues.push("identity-target-collision");
      } else if (batchIdentities.has(identity)) {
        report.stats.identityCollisionsBatch++;
        issues.push("identity-batch-duplicate");
      } else batchIdentities.add(identity);
    }
    return issues;
  }

  function lookupReport(cat, status) {
    report.stats.lookups[cat] = report.stats.lookups[cat] || { mapped: 0, null: 0, review: 0 };
    report.stats.lookups[cat][status]++;
  }

  function mapLookups(per) {
    const out = { review: [] };
    // nationality
    const natTitle = natById[per.nationality_id];
    if (per.nationality_id && NATIONALITY[natTitle] !== undefined) {
      out.nationalityId = NATIONALITY[natTitle];
      lookupReport("nationality", "mapped");
    } else if (!per.nationality_id) {
      out.nationalityId = null;
      lookupReport("nationality", "null");
    } else {
      out.nationalityId = null;
      out.review.push(`nationality:${natTitle}`);
      lookupReport("nationality", "review");
    }
    // governorate
    const govTitle = govById[per.governorate_id];
    if (per.governorate_id && GOVERNORATE[govTitle] !== undefined && targetGovNames.has(GOVERNORATE[govTitle])) {
      out.governorateName = GOVERNORATE[govTitle];
      lookupReport("governorate", "mapped");
    } else if (!per.governorate_id) {
      out.governorateName = null;
      lookupReport("governorate", "null");
    } else {
      out.governorateName = null;
      out.review.push(`governorate:${govTitle}`);
      lookupReport("governorate", "review");
    }
    // region
    const regTitle = regById[per.region_id];
    if (per.region_id && REGION[regTitle] !== undefined && targetRegNames.has(REGION[regTitle])) {
      out.regionName = REGION[regTitle];
      lookupReport("region", "mapped");
    } else if (!per.region_id) {
      out.regionName = null;
      lookupReport("region", "null");
    } else {
      out.regionName = null;
      out.review.push(`region:${regTitle}`);
      lookupReport("region", "review");
    }
    // village free text
    const vilTitle = vilById[per.village_id];
    if (per.village_id && vilTitle) {
      out.village = String(vilTitle).trim() || null;
      lookupReport("village", out.village ? "mapped" : "null");
    } else {
      out.village = null;
      lookupReport("village", "null");
    }
    // gender: unproven -> NULL + REVIEW (only when nonzero to limit noise)
    out.gender = null;
    if (per.gender_id) {
      out.review.push(`gender_id:${per.gender_id}`);
      lookupReport("gender", "review");
    } else lookupReport("gender", "null");
    // blood / identity type: no usable source
    out.bloodTypeId = null;
    lookupReport("blood_type", "null");
    out.identityTypeId = null;
    if (per.identity_type) {
      out.review.push(`identity_type:${per.identity_type}`);
      lookupReport("identity_type", "review");
    } else lookupReport("identity_type", "null");
    return out;
  }

  // ---- parents ----
  for (const p of parent) {
    const per = perById.get(p.person_id);
    if (!per) {
      report.parents.SKIP.push({ legacy_parent_id: p.ID, reason: "orphan-missing-personne" });
      continue;
    }
    const first = s(p.first_name).trim();
    const last = s(p.family).trim();
    if (!first || !last) {
      report.parents.INVALID.push({ legacy_parent_id: p.ID, reason: "missing-name" });
      continue;
    }
    const email = normEmail(per.email);
    const identity = blank(per.identity_number) ? null : s(per.identity_number).trim();
    const issues = checkContacts(email, identity);
    // username
    const legacyU = s(per.username).trim();
    let username, preserved = false, genCollision = false;
    if (legacyU && !batchUsernames.has(legacyU)) {
      username = legacyU;
      preserved = true;
      report.stats.preservedUsernames++;
    } else {
      const g = backendUsername(first, last, per.phone, batchUsernames);
      username = g.username;
      genCollision = g.generated;
      report.stats.generatedUsernames++;
      if (g.generated) report.stats.generatedUsernameCollisions++;
      if (batchUsernames.has(username) && preserved) report.stats.usernameCollisionsTarget++;
    }
    batchUsernames.add(username);
    const lookups = mapLookups(per);
    report.stats.bcryptRequired++;
    const personLookups = resolveLookupIds(per, lookupCtx);
    const entry = {
      legacy_parent_id: p.ID,
      legacy_personne_id: per.ID,
      username,
      usernamePreserved: preserved,
      email: email ? "(present)" : null,
      review: [...issues, ...lookups.review],
      createPerson: buildPersonCreate(
        first,
        s(p.middle_name).trim(),
        last,
        per,
        personLookups,
        username,
        email,
        identity,
      ),
      createParent: { currentJobId: null, description: null },
      audit: {
        legacyGender: per.gender_id ?? null,
        legacyIdentityType: per.identity_type ?? null,
      },
    };
    newParentByLegacy.set(p.ID, entry);
    newPersonByLegacy.set(per.ID, { kind: "parent", username });
    if (issues.length) report.parents.COLLISION.push(entry);
    else if (lookups.review.length) report.parents.REVIEW.push(entry);
    else report.parents.CREATE.push(entry);
  }

  // ---- students ----
  for (const st of student) {
    const sper = perById.get(st.person_id);
    if (!sper) {
      report.students.SKIP.push({ legacy_student_id: st.ID, reason: "missing-personne" });
      continue;
    }
    const legacyParentId = parByPerson.get(st.parent_id);
    if (legacyParentId === undefined) {
      report.students.SKIP.push({ legacy_student_id: st.ID, reason: "broken-parent-link" });
      continue;
    }
    const newPar = newParentByLegacy.get(legacyParentId);
    if (!newPar || !report.parents.CREATE.includes(newPar) && !report.parents.REVIEW.includes(newPar) && !report.parents.COLLISION.includes(newPar)) {
      report.students.SKIP.push({ legacy_student_id: st.ID, reason: "parent-not-planned" });
      continue;
    }
    const parRow = parById.get(legacyParentId);
    const first = s(st.first_name).trim();
    if (!first) {
      report.students.INVALID.push({ legacy_student_id: st.ID, reason: "missing-name" });
      continue;
    }
    const last = s(parRow.family).trim(); // approved TRANSFORM
    const email = normEmail(sper.email);
    const identity = blank(sper.identity_number) ? null : s(sper.identity_number).trim();
    const issues = checkContacts(email, identity);
    const legacyU = s(sper.username).trim();
    let username, preserved = false;
    if (legacyU && !batchUsernames.has(legacyU)) {
      username = legacyU;
      preserved = true;
      report.stats.preservedUsernames++;
    } else {
      const g = backendUsername(first, last, sper.phone, batchUsernames);
      username = g.username;
      report.stats.generatedUsernames++;
      if (g.generated) report.stats.generatedUsernameCollisions++;
    }
    batchUsernames.add(username);
    const lookups = mapLookups(sper);
    report.stats.bcryptRequired++;
    const mphoneRaw = s(st.mother_phone).trim();
    const mphone = mphoneRaw && mphoneRaw !== "0" ? mphoneRaw : "";
    if (mphone) report.stats.motherPhonesPreserved++;
    const studentLookups = resolveLookupIds(sper, lookupCtx);
    const entry = {
      legacy_student_id: st.ID,
      legacy_personne_id: sper.ID,
      legacy_parent_id: legacyParentId,
      username,
      usernamePreserved: preserved,
      lastNameSource: "parent.family",
      motherPhone: mphone ? "(present)" : null,
      review: [...issues, ...lookups.review],
      createPerson: buildPersonCreate(
        first,
        "",
        last,
        sper,
        studentLookups,
        username,
        email,
        identity,
      ),
      createStudent: {
        motherName: nullishText(st.mother_name),
        motherFamily: nullishText(st.mother_family),
        motherPhone: mphone || null,
      },
      audit: {
        legacyGender: sper.gender_id ?? null,
        legacyIdentityType: sper.identity_type ?? null,
      },
    };
    newPersonByLegacy.set(sper.ID, { kind: "student", username });
    report.links.planned++;
    if (issues.length) report.students.COLLISION.push(entry);
    else if (lookups.review.length) report.students.REVIEW.push(entry);
    else report.students.CREATE.push(entry);
  }
  report.links.source = 350;

  // ---- output (IDs + counts only) ----
  const summarize = (arr) => arr.map((e) => e.legacy_parent_id ?? e.legacy_student_id);
  console.log("=== DRY-RUN REPORT (no writes performed) ===");
  console.log("LEGACY_PARENTS", parent.length, "LEGACY_STUDENTS", student.length);
  console.log(
    "PARENT_PLAN",
    JSON.stringify({
      CREATE: report.parents.CREATE.length,
      COLLISION: report.parents.COLLISION.length,
      REVIEW: report.parents.REVIEW.length,
      SKIP: report.parents.SKIP.length,
      INVALID: report.parents.INVALID.length,
      skipIds: summarize(report.parents.SKIP),
    }),
  );
  console.log(
    "STUDENT_PLAN",
    JSON.stringify({
      CREATE: report.students.CREATE.length,
      COLLISION: report.students.COLLISION.length,
      REVIEW: report.students.REVIEW.length,
      SKIP: report.students.SKIP.length,
      INVALID: report.students.INVALID.length,
      skipIds: summarize(report.students.SKIP),
    }),
  );
  console.log("LINKS", JSON.stringify({ source: report.links.source, planned: report.links.planned }));
  console.log("STATS", JSON.stringify(report.stats));
  console.log(
    "MAPPING_SAMPLE",
    JSON.stringify(
      report.parents.CREATE.slice(0, 3).map((e) => ({
        legacy_parent_id: e.legacy_parent_id,
        legacy_personne_id: e.legacy_personne_id,
        username: e.username,
        usernamePreserved: e.usernamePreserved,
      })),
    ),
  );
  console.log("BEFORE_COUNTS", JSON.stringify(before));

  if (COMMIT) {
    const { batch: batchTag } = parseImporterArgs(process.argv);
    if (!batchTag) {
      console.error("COMMIT requires --batch <source-tag>. Aborting without writes.");
      process.exit(2);
    }
    await runCommitMode(report, batchTag);
    return;
  }
  console.log("DRY-RUN COMPLETE. Zero writes performed.");
}

async function runCommitMode(report, batchTag) {
  const { randomBytes } = await import("node:crypto");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@prisma/client");
  const { default: bcryptLib } = await import("bcrypt");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    // 1. Identify/create batch safely.
    let batch = await prisma.legacyMigrationBatch.findFirst({
      where: { source: batchTag, schoolId: SCHOOL_ID },
      orderBy: { id: "desc" },
    });
    if (batch && batch.status === "COMPLETED") {
      console.error(`Batch ${batch.id} already COMPLETED. Refusing rerun.`);
      process.exit(3);
    }
    if (!batch) {
      batch = await prisma.legacyMigrationBatch.create({
        data: { source: batchTag, schoolId: SCHOOL_ID, status: "IN_PROGRESS", startedAt: new Date() },
      });
    } else if (batch.status !== "IN_PROGRESS") {
      batch = await prisma.legacyMigrationBatch.update({
        where: { id: batch.id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    }
    const existingMaps = await prisma.legacyMigrationMap.findMany({
      where: { batchId: batch.id },
    });

    const plannedParents = [
      ...report.parents.CREATE,
      ...report.parents.REVIEW,
      ...report.parents.COLLISION,
    ];
    const plannedStudents = [
      ...report.students.CREATE,
      ...report.students.REVIEW,
      ...report.students.COLLISION,
    ];
    const studentsByParent = new Map();
    for (const st of plannedStudents) {
      if (!studentsByParent.has(st.legacy_parent_id)) studentsByParent.set(st.legacy_parent_id, []);
      studentsByParent.get(st.legacy_parent_id).push(st);
    }

    let importedParents = 0;
    let importedStudents = 0;

    async function ensureMappedPerson(tx, maps, legacyPersonneId, personData) {
      const existing = findExistingMapping(maps, "PERSON", legacyPersonneId);
      if (existing) {
        const row = await tx.person.findUnique({ where: { id: existing.newId } });
        const check = validateMappedTarget(existing, row && { schoolId: row.schoolId }, SCHOOL_ID);
        if (!check.ok) throw new Error(`BLOCK: PERSON mapping legacy=${legacyPersonneId} points at missing/foreign target ${existing.newId}`);
        return existing.newId;
      }
      // Re-resolve collisions immediately before writes.
      if (personData.email) {
        const clash = await tx.person.findFirst({ where: { email: { equals: personData.email, mode: "insensitive" } }, select: { id: true } });
        if (clash) throw new Error(`BLOCK: email collision for legacy personne ${legacyPersonneId}`);
      }
      if (personData.identityNumber) {
        const clash = await tx.person.findFirst({ where: { identityNumber: personData.identityNumber }, select: { id: true } });
        if (clash) throw new Error(`BLOCK: identity collision for legacy personne ${legacyPersonneId}`);
      }
      const tempPassword = randomBytes(32).toString("base64url");
      const passwordHash = await bcryptLib.hash(tempPassword, 10);
      const created = await tx.person.create({ data: { ...personData, password: passwordHash }, select: { id: true } });
      const map = await tx.legacyMigrationMap.create({
        data: { batchId: batch.id, entityType: "PERSON", legacyId: legacyPersonneId, newId: created.id, status: "IMPORTED" },
      });
      maps.push(map);
      return created.id;
    }

    // Family-chunked transactions: one family per transaction.
    for (const pentry of plannedParents) {
      await prisma.$transaction(async (tx) => {
        const personId = await ensureMappedPerson(tx, existingMaps, pentry.legacy_personne_id, pentry.createPerson);
        let parentMap = findExistingMapping(existingMaps, "PARENT", pentry.legacy_parent_id);
        let parentId;
        if (parentMap) {
          const prow = await tx.parent.findUnique({ where: { id: parentMap.newId }, select: { id: true, personId: true } });
          if (!prow) throw new Error(`BLOCK: PARENT mapping legacy=${pentry.legacy_parent_id} target missing`);
          const pperson = await tx.person.findUnique({ where: { id: prow.personId }, select: { schoolId: true } });
          if (!pperson || pperson.schoolId !== SCHOOL_ID) throw new Error(`BLOCK: PARENT mapping legacy=${pentry.legacy_parent_id} inconsistent target`);
          parentId = parentMap.newId;
        } else {
          const created = await tx.parent.create({
            data: { personId, currentJobId: null, description: null },
            select: { id: true },
          });
          parentId = created.id;
          const map = await tx.legacyMigrationMap.create({
            data: {
              batchId: batch.id,
              entityType: "PARENT",
              legacyId: pentry.legacy_parent_id,
              newId: parentId,
              status: "IMPORTED",
              reviewReason: pentry.review.length ? pentry.review.join("; ") : null,
              sourceMetadata: { legacyGender: pentry.audit.legacyGender, legacyIdentityType: pentry.audit.legacyIdentityType },
            },
          });
          existingMaps.push(map);
        }
        importedParents++;
        for (const st of studentsByParent.get(pentry.legacy_parent_id) || []) {
          const spersonId = await ensureMappedPerson(tx, existingMaps, st.legacy_personne_id, st.createPerson);
          let smap = findExistingMapping(existingMaps, "STUDENT", st.legacy_student_id);
          if (smap) {
            const srow = await tx.student.findUnique({ where: { id: smap.newId }, select: { id: true, parentId: true, personId: true } });
            if (!srow || srow.parentId !== parentId) throw new Error(`BLOCK: STUDENT mapping legacy=${st.legacy_student_id} inconsistent target`);
          } else {
            // Resolve parent strictly through the PARENT mapping, never the legacy ID.
            const pmap = findExistingMapping(existingMaps, "PARENT", st.legacy_parent_id);
            if (!pmap || pmap.newId !== parentId) throw new Error(`BLOCK: parent mapping missing for student legacy=${st.legacy_student_id}`);
            const created = await tx.student.create({
              data: {
                personId: spersonId,
                parentId: pmap.newId,
                motherName: null,
                motherFamily: null,
                motherPhone: st.createStudent.motherPhone,
              },
              select: { id: true },
            });
            const map = await tx.legacyMigrationMap.create({
              data: {
                batchId: batch.id,
                entityType: "STUDENT",
                legacyId: st.legacy_student_id,
                newId: created.id,
                status: "IMPORTED",
                reviewReason: st.review.length ? st.review.join("; ") : null,
                sourceMetadata: { legacyGender: st.audit.legacyGender, legacyIdentityType: st.audit.legacyIdentityType },
              },
            });
            existingMaps.push(map);
          }
          importedStudents++;
        }
      });
    }

    // Reconcile before marking complete.
    const expParents = plannedParents.length;
    const expStudents = plannedStudents.length;
    if (importedParents !== expParents || importedStudents !== expStudents) {
      throw new Error(`Reconciliation failed: parents ${importedParents}/${expParents}, students ${importedStudents}/${expStudents}`);
    }
    await prisma.legacyMigrationBatch.update({
      where: { id: batch.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    console.log(`COMMIT COMPLETE batch=${batch.id} parents=${importedParents} students=${importedStudents}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((e) => {
    console.error("FATAL", e.message);
    process.exit(1);
  });
}
