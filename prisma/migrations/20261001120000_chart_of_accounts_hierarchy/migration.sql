-- Hierarchical Chart of Accounts: parent/child support + group/posting flag
-- plus a per-(school, prefix) atomic counter for safe leaf-code allocation.
-- Additive only: no existing column/table is altered, no data is renumbered,
-- existing account IDs are untouched, historical migrations are not modified.
-- DO NOT apply to production without review (see task §18).

-- Account codes are unique ONLY within one school: every school owns its own
-- 4 / 41 / 411 / 4111 rows (same codes, different ids, different school_id).
-- Replace the historical global uniqueness ("accounts_code_key", created in
-- 20260926120000_add_accounting_phase_1) with UNIQUE (school_id, code).
-- Safe: globally-unique codes trivially satisfy per-school uniqueness, so no
-- existing row can violate the new constraint. IDs, codes, journal and
-- person references are untouched.
DROP INDEX IF EXISTS "accounts_code_key";
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_school_id_code_key" UNIQUE ("school_id", "code");

-- Self-reference: accounts.parent_id -> accounts.id (NULL = root).
-- Relationships are by ID; account codes remain human chart labels only.
ALTER TABLE "accounts" ADD COLUMN "parent_id" INTEGER;

-- Group/posting designation. Existing rows default to false (posting/leaf),
-- preserving current Receipt/Payment/Invoice/Record selector behavior.
ALTER TABLE "accounts" ADD COLUMN "is_group" BOOLEAN NOT NULL DEFAULT false;

-- Safe delete: a parent with children cannot be deleted while Restrict holds.
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "accounts_school_id_parent_id_idx"
  ON "accounts"("school_id", "parent_id");

CREATE INDEX "accounts_parent_id_idx"
  ON "accounts"("parent_id");

-- Atomic per-(school, prefix) leaf-code sequence, e.g. school 3 + '4111'.
-- Incremented with INSERT ... ON CONFLICT DO UPDATE ... RETURNING inside the
-- creation transaction, so concurrent allocations never return the same code.
CREATE TABLE "account_code_counters" (
    "school_id" INTEGER NOT NULL,
    "prefix" VARCHAR(32) NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "account_code_counters_pkey" PRIMARY KEY ("school_id", "prefix")
);

ALTER TABLE "account_code_counters"
  ADD CONSTRAINT "account_code_counters_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
