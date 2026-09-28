/**
 * Pure legacy-migration rules (no I/O, no secrets).
 * Shared by scripts/legacy-parent-student-dryrun.mjs and jest specs.
 */
const s = (v) => (v === null || v === undefined ? "" : String(v));
const blank = (v) => s(v).trim() === "" || s(v).trim() === "0";
const normEmail = (v) => {
  const t = s(v).trim().toLowerCase();
  return t && t !== "0" ? t : null;
};

// Proven semantic lookup maps (anything else -> NULL + REVIEW).
const NATIONALITY = { لبنان: 1, سوري: 2, اردني: 3 };
const GOVERNORATE = { بيروت: "Beirut", الشمال: "North" };
const REGION = {
  بيروت: "Beirut",
  طرابلس: "Tripoli",
  الكورة: "Koura",
  "زغرتاXالزاوية": "Zgharta",
  البترون: "Batroun",
  بشري: "Bsharri",
  عكار: "Akkar",
  صيدا: "Sidon",
  صور: "Tyre",
  الشوف: "Chouf",
  مرجعيون: "Marjeyoun",
  الضنية: "Miniyeh-Danniyeh",
};

function backendUsername(first, last, phone, taken) {
  const slug = `${s(first)}.${s(last)}`
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "")
    .replace(/^\.+|\.+$/g, "");
  const digits = s(phone).replace(/\D/g, "").slice(-6);
  let base = (slug || "parent") + (digits ? `.${digits}` : "");
  if (base.length > 90) base = base.slice(0, 90);
  if (!taken.has(base)) return { username: base, generated: false };
  let i = 1;
  while (taken.has(`${base}.dup${i}`.slice(0, 100))) i++;
  return { username: `${base}.dup${i}`.slice(0, 100), generated: true };
}

function resolveStudentLegacyParentId(studentParentId, parByPersonId) {
  // Approved: student.parent_id -> parent.person_id -> parent.ID.
  // Never use student.parent_id directly as parents.id.
  return parByPersonId.get(studentParentId);
}

function deriveStudentLastName(parentFamily) {
  const last = s(parentFamily).trim();
  return last || null; // null => INVALID, never invent
}

function classifyGenderValue(genderId) {
  // Polarity unproven: always NULL + REVIEW when a nonzero value exists.
  if (!genderId) return { value: null, review: false };
  return { value: null, review: true };
}

function buildBackendUsername(first, last, phone, takenArray) {
  return backendUsername(first, last, phone, new Set(takenArray));
}

function findExistingMapping(mappings, entityType, legacyId) {
  return mappings.find(
    (m) => m.entityType === entityType && m.legacyId === legacyId,
  );
}

function validateMappedTarget(mapping, targetRow, schoolId) {
  // Rerun safety: mapping must resolve to an existing school row,
  // otherwise BLOCK instead of silently creating a duplicate.
  if (!mapping) return { ok: true, action: "create" };
  if (!targetRow || targetRow.schoolId !== schoolId)
    return { ok: false, action: "block" };
  return { ok: true, action: "reuse" };
}

function parseImporterArgs(argv) {
  const commit = argv.includes("--commit");
  const batchIdx = argv.indexOf("--batch");
  return { commit, batch: batchIdx >= 0 ? argv[batchIdx + 1] : null };
}

function requiresMappingInfrastructure() {
  return true;
}

function nullishText(v) {
  const t = s(v).trim();
  return t && t !== "0" ? t : null;
}

function nullableDate(v) {
  const t = s(v).trim();
  if (!t || t === "0000-00-00" || t === "0000-00-00 00:00:00") return null;
  return new Date(`${t}T00:00:00`);
}

function resolveLookupIds(per, ctx) {
  const natTitle = ctx.natById[per.nationality_id];
  const nationalityId =
    per.nationality_id && ctx.NATIONALITY[natTitle] !== undefined
      ? ctx.NATIONALITY[natTitle]
      : null;
  const govTitle = ctx.govById[per.governorate_id];
  const govName = per.governorate_id ? ctx.GOVERNORATE[govTitle] : null;
  const governorateId =
    govName && ctx.govIdByName[govName] !== undefined
      ? ctx.govIdByName[govName]
      : null;
  const regTitle = ctx.regById[per.region_id];
  const regName = per.region_id ? ctx.REGION[regTitle] : null;
  const regionId =
    regName && ctx.regIdByName[regName] !== undefined
      ? ctx.regIdByName[regName]
      : null;
  const vilTitle = ctx.vilById[per.village_id];
  return {
    nationalityId,
    governorateId,
    regionId,
    village:
      per.village_id && vilTitle ? String(vilTitle).trim() || null : null,
  };
}

function buildPersonCreate(
  first,
  middle,
  last,
  per,
  lookups,
  username,
  email,
  identity,
) {
  return {
    schoolId: 3,
    username,
    firstName: first,
    middleName: middle,
    lastName: last,
    email,
    phoneNumber: nullishText(per.phone),
    urgentNumber: nullishText(per.urgent_number),
    landline: nullishText(per.telephone),
    address: nullishText(per.address),
    birthday: nullableDate(per.birthday),
    gender: null, // unproven polarity: always NULL
    nationalityId: lookups.nationalityId,
    governorateId: lookups.governorateId,
    regionId: lookups.regionId,
    village: lookups.village,
    placeOfBirth: nullishText(per.place_of_birth),
    identityNumber: identity,
    bloodTypeId: null,
    identityTypeId: null, // unverified target mapping
    status: per.status === 1,
    paid: per.paid === 1,
    // password set separately as bcrypt hash of a random temp value.
    // account_id/user_id intentionally ignored in this phase.
  };
}

module.exports = {
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
};
