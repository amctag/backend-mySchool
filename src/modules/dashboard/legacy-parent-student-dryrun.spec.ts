import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const rules = require("../../../scripts/legacy-migration-rules.cjs") as {
  resolveStudentLegacyParentId(
    studentParentId: number,
    parByPersonId: Map<number, number>,
  ): number | undefined;
  deriveStudentLastName(parentFamily: unknown): string | null;
  classifyGenderValue(genderId: unknown): {
    value: null;
    review: boolean;
  };
  buildBackendUsername(
    first: unknown,
    last: unknown,
    phone: unknown,
    takenArray: string[],
  ): { username: string; generated: boolean };
  findExistingMapping(
    mappings: Array<{ entityType: string; legacyId: number; newId: number }>,
    entityType: string,
    legacyId: number,
  ):
    | { entityType: string; legacyId: number; newId: number }
    | undefined;
  validateMappedTarget(
    mapping: unknown,
    targetRow: { schoolId: number } | null,
    schoolId: number,
  ): { ok: boolean; action: "create" | "reuse" | "block" };
  parseImporterArgs(argv: string[]): {
    commit: boolean;
    batch: string | null;
  };
  requiresMappingInfrastructure(): boolean;
  nullishText(v: unknown): string | null;
  nullableDate(v: unknown): Date | null;
};

const execFileAsync = promisify(execFile);
const SCRIPT = path.resolve(
  __dirname,
  "../../../scripts/legacy-parent-student-dryrun.mjs",
);

describe("legacy parent/student migration rules", () => {
  it("resolves student links through parent.person_id, never parent.ID", () => {
    const parByPerson = new Map([
      [1014, 1],
      [1016, 2],
    ]);
    expect(rules.resolveStudentLegacyParentId(1014, parByPerson)).toBe(1);
    expect(rules.resolveStudentLegacyParentId(1016, parByPerson)).toBe(2);
    // A raw parent.ID used as a personne key must NOT resolve.
    expect(rules.resolveStudentLegacyParentId(1, parByPerson)).toBeUndefined();
    expect(rules.resolveStudentLegacyParentId(9999, parByPerson)).toBeUndefined();
  });

  it("derives student lastName from parent.family and never invents one", () => {
    expect(rules.deriveStudentLastName("Hassan")).toBe("Hassan");
    expect(rules.deriveStudentLastName("  Hassan  ")).toBe("Hassan");
    expect(rules.deriveStudentLastName("")).toBeNull();
    expect(rules.deriveStudentLastName(null)).toBeNull();
  });

  it("maps ambiguous gender to NULL with review, never guesses", () => {
    expect(rules.classifyGenderValue(0)).toEqual({ value: null, review: false });
    expect(rules.classifyGenderValue(null)).toEqual({ value: null, review: false });
    expect(rules.classifyGenderValue(1)).toEqual({ value: null, review: true });
    expect(rules.classifyGenderValue(2)).toEqual({ value: null, review: true });
  });

  it("builds backend-compatible usernames with deterministic dupN suffixes", () => {
    expect(rules.buildBackendUsername("John", "Doe", "+96170123456", [])).toEqual({
      username: "john.doe.123456",
      generated: false,
    });
    // Non-latin names collapse the slug; uniqueness still holds via suffix.
    expect(
      rules.buildBackendUsername("أحمد", "حسن", "", ["parent"]),
    ).toEqual({ username: "parent.dup1", generated: true });
    expect(
      rules.buildBackendUsername("أحمد", "حسن", "", ["parent", "parent.dup1"]),
    ).toEqual({ username: "parent.dup2", generated: true });
  });

  it("reuses mappings on rerun and blocks on inconsistent targets", () => {
    const maps = [{ entityType: "PERSON", legacyId: 1014, newId: 500 }];
    expect(rules.findExistingMapping(maps, "PERSON", 1014)).toEqual(maps[0]);
    expect(rules.findExistingMapping(maps, "PERSON", 9999)).toBeUndefined();
    expect(rules.findExistingMapping(maps, "PARENT", 1014)).toBeUndefined();
    expect(rules.validateMappedTarget(null, null, 3)).toEqual({
      ok: true,
      action: "create",
    });
    expect(
      rules.validateMappedTarget(maps[0], { schoolId: 3 }, 3),
    ).toEqual({ ok: true, action: "reuse" });
    expect(rules.validateMappedTarget(maps[0], null, 3)).toEqual({
      ok: false,
      action: "block",
    });
    expect(
      rules.validateMappedTarget(maps[0], { schoolId: 1 }, 3),
    ).toEqual({ ok: false, action: "block" });
  });

  it("parses importer args with dry-run default and requires mapping infra for commit", () => {
    expect(rules.parseImporterArgs(["node", "script.mjs"])).toEqual({
      commit: false,
      batch: null,
    });
    expect(
      rules.parseImporterArgs(["node", "script.mjs", "--commit", "--batch", "legacy-sep"]),
    ).toEqual({ commit: true, batch: "legacy-sep" });
    expect(rules.requiresMappingInfrastructure()).toBe(true);
  });

  it("normalizes nullable text and zero-dates for safe import", () => {
    expect(rules.nullishText(" 0 ")).toBeNull();
    expect(rules.nullishText("")).toBeNull();
    expect(rules.nullishText("beirut")).toBe("beirut");
    expect(rules.nullableDate("0000-00-00")).toBeNull();
    expect(rules.nullableDate(null)).toBeNull();
    expect(rules.nullableDate("2018-07-30")).toEqual(new Date("2018-07-30T00:00:00"));
  });

  it("never carries account_id/user_id into person creation", () => {
    // Structural guarantee: buildPersonCreate is not part of the rules
    // surface used for writes, and no rule references legacy accounts.
    const src = require("fs").readFileSync(
      require("path").resolve(
        __dirname,
        "../../../scripts/legacy-parent-student-dryrun.mjs",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/account_id/);
    expect(src).not.toMatch(/user_id/);
  });

  it("generates random temp passwords hashed with bcrypt, never logged or persisted", () => {
    const src = require("fs").readFileSync(
      require("path").resolve(
        __dirname,
        "../../../scripts/legacy-parent-student-dryrun.mjs",
      ),
      "utf8",
    );
    // Random per-person secret + bcrypt hashing present.
    expect(src).toMatch(/randomBytes/);
    expect(src).toMatch(/bcrypt[^a-z]*\.hash|hash\(tempPassword/);
    // Plaintext never reaches logs, mappings, or audit metadata.
    expect(src).not.toMatch(/console\.log\(tempPassword/);
    expect(src).not.toMatch(/plaintext/i);
    expect(src).not.toMatch(/sourceMetadata:[^}]*password/i);
  });
});

describe("legacy parent/student dry-run binary", () => {
  it("plans 235 parents, 320 students, 320 links with 1 orphan and 30 broken skips", async () => {
    const { stdout, stderr } = await execFileAsync("node", [SCRIPT], {
      timeout: 240000,
      maxBuffer: 8 * 1024 * 1024,
    });
    expect(stderr).toBe("");
    const parentPlan = JSON.parse(
      (stdout.match(/PARENT_PLAN (\{.*\})/) ?? [])[1],
    );
    const studentPlan = JSON.parse(
      (stdout.match(/STUDENT_PLAN (\{.*\})/) ?? [])[1],
    );
    const links = JSON.parse((stdout.match(/LINKS (\{.*\})/) ?? [])[1]);
    const stats = JSON.parse((stdout.match(/STATS (\{.*\})/) ?? [])[1]);

    expect(parentPlan.CREATE + parentPlan.REVIEW + parentPlan.COLLISION).toBe(235);
    expect(parentPlan.SKIP).toBe(1);
    expect(parentPlan.skipIds).toEqual([55]);
    expect(parentPlan.INVALID).toBe(0);

    const plannedStudents =
      studentPlan.CREATE + studentPlan.REVIEW + studentPlan.COLLISION;
    expect(plannedStudents).toBe(320);
    expect(studentPlan.SKIP).toBe(30);
    expect(studentPlan.INVALID).toBe(0);

    expect(links.source).toBe(350);
    expect(links.planned).toBe(320);

    // No target collisions in this dataset.
    expect(stats.emailCollisionsTarget).toBe(0);
    expect(stats.identityCollisionsTarget).toBe(0);
    expect(stats.usernameCollisionsTarget).toBe(0);

    // Gender/identity ambiguity is NULLed, never guessed.
    expect(stats.lookups.gender.mapped).toBe(0);

    // Dry-run performs zero writes: two consecutive runs agree on counts.
    const before = JSON.parse((stdout.match(/BEFORE_COUNTS (\{.*\})/) ?? [])[1]);
    const second = await execFileAsync("node", [SCRIPT], {
      timeout: 240000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const after = JSON.parse(
      (second.stdout.match(/BEFORE_COUNTS (\{.*\})/) ?? [])[1],
    );
    expect(after).toEqual(before);
    expect(after).toEqual({ persons: 11, parents: 0, students: 0, accounts: 0 });
    expect(second.stdout).toContain("DRY-RUN COMPLETE. Zero writes performed.");
  }, 300000);

  it("refuses --commit without a batch tag and never writes in tests", async () => {
    const run = await execFileAsync("node", [SCRIPT, "--commit"], {
      timeout: 120000,
    }).catch((e: { stdout?: string; stderr?: string }) => e);
    const output = `${(run as { stdout?: string }).stdout ?? ""}${(run as { stderr?: string }).stderr ?? ""}`;
    expect(output).toMatch(/--batch/);
  }, 180000);
});
