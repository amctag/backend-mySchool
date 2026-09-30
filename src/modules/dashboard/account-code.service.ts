import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Single authoritative account-code allocation service.
 *
 * Two allocation strategies coexist:
 * 1. Legacy global codes via the `account_code_seq` sequence (existing
 *    GENERAL / PERSON / system accounts). Concurrency-safe by sequence.
 * 2. Deterministic hierarchical PERSON leaves under the customer branch
 *    parent with code `4111`: 41110001, 41110002, ... Concurrency-safe via
 *    the `account_code_counters` row (school_id, '4111'), incremented
 *    atomically inside the creation transaction.
 *
 * Chart pages, the Parents "+ Create Account" flow, and invoice-time
 * auto-creation must ALL go through this service so numbering never diverges.
 */
@Injectable()
export class AccountCodeService {
  /** Code of the "ordinary customers" branch parent (resolved by school+code). */
  static readonly CUSTOMER_BRANCH_CODE = '4111';

  /** Full length of an allocated PERSON leaf code, e.g. `41110001`. */
  static readonly CUSTOMER_LEAF_CODE_LENGTH = 8;

  /** Last 4 digits of the leaf code are the per-branch sequence. */
  static readonly CUSTOMER_LEAF_SEQ_WIDTH = 4;

  static readonly CUSTOMER_LEAF_MAX_SEQ = 9999;

  private static readonly PREFIX = AccountCodeService.CUSTOMER_BRANCH_CODE;

  /**
   * Legacy allocation: next value of the global `account_code_seq`.
   * Used for root GENERAL accounts, system accounts, and (until the bulk
   * parent migration runs) auto-created PERSON accounts.
   */
  async allocateLegacyCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const [sequence] = await tx.$queryRaw<Array<{ code: string }>>`
      SELECT nextval('"account_code_seq"')::text AS code
    `;
    if (!sequence) {
      throw new ConflictException('Could not allocate an account code');
    }
    return sequence.code;
  }

  /**
   * Resolve the customer-branch parent (code `4111`) for a school by
   * school + code. Never hardcode database IDs.
   */
  async findCustomerBranchParent(
    tx: Prisma.TransactionClient,
    schoolId: number,
  ): Promise<{ id: number; code: string; name: string; isGroup: boolean } | null> {
    return tx.account.findFirst({
      where: {
        schoolId,
        code: AccountCodeService.CUSTOMER_BRANCH_CODE,
      },
      select: { id: true, code: true, name: true, isGroup: true },
    });
  }

  /**
   * Read-only preview of the next PERSON leaf code under `4111`
   * (e.g. existing 41110001..41110003 -> 41110004). Best effort: the
   * authoritative value is allocated transactionally at creation time.
   * Never writes to the counter.
   */
  async previewCustomerLeafCode(
    tx: Prisma.TransactionClient,
    schoolId: number,
  ): Promise<string> {
    const nextSeq = await this.computeNextSeq(
      tx,
      schoolId,
      AccountCodeService.PREFIX,
      AccountCodeService.CUSTOMER_LEAF_SEQ_WIDTH,
      false,
    );
    return this.formatLeafCode(nextSeq);
  }

  /**
   * Authoritative allocation of the next PERSON leaf code under `4111`.
   *
   * Semantics: next = max(counter.last_seq, max existing leaf seq) + 1,
   * monotonically increasing. Gaps are NEVER reused and deleted codes are
   * NEVER recycled, so an old code can never point at a different parent.
   *
   * Concurrency: the (school_id, prefix) counter row is ensured and locked
   * by a single atomic UPSERT whose UPDATE arm takes the row lock until the
   * creation transaction commits. Concurrent requests serialize on that row:
   * the second sees the first's committed value and receives the next code.
   * The existing-code read only initializes/synchronizes the counter and is
   * never the concurrency mechanism.
   */
  async allocateCustomerLeafCode(
    tx: Prisma.TransactionClient,
    schoolId: number,
  ): Promise<string> {
    const nextSeq = await this.computeNextSeq(
      tx,
      schoolId,
      AccountCodeService.PREFIX,
      AccountCodeService.CUSTOMER_LEAF_SEQ_WIDTH,
      true,
    );
    return this.formatLeafCode(nextSeq);
  }

  /**
   * Shared PERSON-account rule for Parent creation paths (Parents page
   * "+ Create Account" and invoice-time auto-creation):
   * resolve the school's 4111 branch parent by school + code, then allocate
   * the next 8-digit leaf. Fails cleanly when the branch does not exist —
   * PERSON accounts must NEVER silently fall back to the legacy sequence.
   */
  async allocateCustomerPersonAccount(
    tx: Prisma.TransactionClient,
    schoolId: number,
  ): Promise<{ code: string; parentId: number }> {
    const branch = await this.findCustomerBranchParent(tx, schoolId);
    if (!branch) {
      throw new ConflictException(
        'Customer chart branch 4111 is not set up for this school. ' +
          'Create the 4 / 41 / 411 / 4111 structure before creating parent accounts.',
      );
    }
    if (!branch.isGroup) {
      throw new ConflictException(
        'Customer chart branch 4111 must be a group account.',
      );
    }
    const code = await this.allocateCustomerLeafCode(tx, schoolId);
    return { code, parentId: branch.id };
  }

  /**
   * Ensure the (school_id, '4111') counter is at least as far as the
   * highest existing 8-digit leaf, so manual/legacy rows never collide
   * with future allocations. Called after explicit leaf creation.
   */
  async syncCustomerCounter(
    tx: Prisma.TransactionClient,
    schoolId: number,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ code: string }>>`
      SELECT "code" FROM "accounts"
      WHERE "school_id" = ${schoolId}
        AND "code" LIKE '4111____'
      ORDER BY "code" DESC
      LIMIT 1
    `;
    const top = rows[0]?.code;
    if (!top) {
      return;
    }
    const seq = Number(top.slice(AccountCodeService.PREFIX.length));
    if (!Number.isInteger(seq) || seq < 1) {
      return;
    }
    await tx.$queryRaw`
      INSERT INTO "account_code_counters" ("school_id", "prefix", "last_seq")
      VALUES (${schoolId}, ${AccountCodeService.PREFIX}, ${seq})
      ON CONFLICT ("school_id", "prefix")
      DO UPDATE SET "last_seq" = GREATEST("account_code_counters"."last_seq", ${seq})
    `;
  }

  /**
   * Branch-generic next-sequence computation for (schoolId, prefix).
   * Future generated branches (teacher/supplier/employee/…) reuse this with
   * their own prefix; each keeps an independent counter row. Nothing here is
   * hardcoded to 4111 beyond the callers.
   *
   * @param commit when true, ensures + locks the counter row and persists
   * the new value (allocation). When false, reads only (preview).
   */
  private async computeNextSeq(
    tx: Prisma.TransactionClient,
    schoolId: number,
    prefix: string,
    seqWidth: number,
    commit: boolean,
  ): Promise<number> {
    const maxSeqValue = 10 ** seqWidth - 1;
    let counterSeq: number;
    if (commit) {
      // One atomic statement: creates the row at 0 when absent, otherwise
      // takes the row lock until transaction commit (UPDATE always locks).
      const [locked] = await tx.$queryRaw<Array<{ seq: number }>>`
        INSERT INTO "account_code_counters" ("school_id", "prefix", "last_seq")
        VALUES (${schoolId}, ${prefix}, 0)
        ON CONFLICT ("school_id", "prefix")
        DO UPDATE SET "last_seq" = "account_code_counters"."last_seq"
        RETURNING "last_seq" AS "seq"
      `;
      counterSeq = locked?.seq ?? 0;
    } else {
      const counters = await tx.$queryRaw<Array<{ seq: number }>>`
        SELECT "last_seq" AS "seq" FROM "account_code_counters"
        WHERE "school_id" = ${schoolId} AND "prefix" = ${prefix}
      `;
      counterSeq = counters[0]?.seq ?? 0;
    }
    const maxExisting = await this.maxExistingSeq(tx, schoolId, prefix, seqWidth);
    const next = Math.max(counterSeq, maxExisting) + 1;
    if (next > maxSeqValue) {
      throw new ConflictException(
        `Account range ${prefix}0001..${prefix}${'9'.repeat(seqWidth)} is exhausted`,
      );
    }
    if (commit) {
      // Only ever increases: deletions never lower the counter, so codes
      // are never recycled.
      await tx.$queryRaw`
        UPDATE "account_code_counters" SET "last_seq" = ${next}
        WHERE "school_id" = ${schoolId} AND "prefix" = ${prefix}
          AND "last_seq" < ${next}
      `;
    }
    return next;
  }

  /**
   * Highest sequence already present under (schoolId, prefix), used ONLY to
   * initialize/synchronize the counter when it lags behind existing rows.
   * Never the concurrency mechanism.
   */
  private async maxExistingSeq(
    tx: Prisma.TransactionClient,
    schoolId: number,
    prefix: string,
    seqWidth: number,
  ): Promise<number> {
    // Prefix/width are internal constants, never user input.
    const likePattern = `${prefix}${'_'.repeat(seqWidth)}`;
    const rows = await tx.$queryRaw<Array<{ code: string }>>`
      SELECT "code" FROM "accounts"
      WHERE "school_id" = ${schoolId}
        AND "code" LIKE ${likePattern}
      ORDER BY "code" DESC
      LIMIT 50
    `;
    let max = 0;
    for (const row of rows) {
      const suffix = row.code.slice(prefix.length);
      if (!new RegExp(`^\\d{${seqWidth}}$`).test(suffix)) {
        continue;
      }
      const parsed = Number(suffix);
      if (parsed > max) {
        max = parsed;
      }
    }
    return max;
  }

  private formatLeafCode(seq: number): string {
    return `${AccountCodeService.PREFIX}${String(seq).padStart(AccountCodeService.CUSTOMER_LEAF_SEQ_WIDTH, '0')}`;
  }
}
