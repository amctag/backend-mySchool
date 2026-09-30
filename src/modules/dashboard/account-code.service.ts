import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Single authoritative account-code allocation service.
 *
 * Allocation strategies:
 * 1. Legacy global codes via the `account_code_seq` sequence (existing
 *    flat system accounts). Concurrency-safe by sequence.
 * 2. Hierarchical child codes per (school_id, parent code): 1->2->3->4->8
 *    digit levels, monotonic and gap-reuse-free. Concurrency-safe via the
 *    `account_code_counters` row (school_id, parent code), ensured and
 *    locked atomically inside the creation transaction. PERSON leaves under
 *    `4111` (41110001, 41110002, ...) use the same mechanism.
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
   * Strict chart hierarchy: parent code length -> exact child code length.
   * Level 1 (1 digit) -> Level 2 (2 digits) -> Level 3 (3) -> Level 4 (4)
   * -> Level 5 posting leaves (8 digits, final: no children allowed).
   */
  static readonly CHILD_CODE_LENGTH: Record<number, number> = {
    1: 2,
    2: 3,
    3: 4,
    4: 8,
  };

  /**
   * Exact required child-code length for a parent code, or null when the
   * parent cannot have children (8-digit final accounts, non-numeric codes,
   * or any other unexpected parent length).
   */
  static childCodeLengthFor(parentCode: string): number | null {
    if (!/^\d+$/.test(parentCode)) {
      return null;
    }
    return this.CHILD_CODE_LENGTH[parentCode.length] ?? null;
  }

  /**
   * Source-of-truth hierarchy validation. A direct child must start with
   * the complete parent code and have exactly the required length.
   * Throws BadRequestException with a precise message on any violation.
   */
  static validateHierarchyCode(parentCode: string, childCode: unknown): void {
    if (
      typeof childCode !== 'string' ||
      childCode !== childCode.trim() ||
      !/^\d+$/.test(childCode)
    ) {
      throw new BadRequestException(
        'Account code must contain only numeric digits (no spaces, decimals, signs, or letters).',
      );
    }
    const expectedLength = this.childCodeLengthFor(parentCode);
    if (expectedLength === null) {
      if (/^\d+$/.test(parentCode) && parentCode.length >= 8) {
        throw new BadRequestException(
          `Account "${parentCode}" is a final posting account and cannot have children.`,
        );
      }
      throw new BadRequestException(
        `Account "${parentCode}" cannot have children: parent codes must be 1-4 numeric digits.`,
      );
    }
    if (
      childCode.length !== expectedLength ||
      !childCode.startsWith(parentCode)
    ) {
      throw new BadRequestException(
        `Account code "${childCode}" is invalid: a direct child of "${parentCode}" must be exactly ${expectedLength} digits starting with "${parentCode}".`,
      );
    }
  }

  /**
   * Root accounts (parent_id NULL) must be exactly one numeric digit.
   */
  static validateRootCode(childCode: unknown): void {
    if (
      typeof childCode !== 'string' ||
      childCode !== childCode.trim() ||
      !/^\d$/.test(childCode)
    ) {
      throw new BadRequestException(
        'A root account code is required: exactly one numeric digit (0-9).',
      );
    }
  }

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
      1,
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
      1,
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
   * Next valid child code preview for ANY hierarchy parent
   * (e.g. parent 5 with children 50,51 -> 52; parent 5000 -> 50000002).
   * Considers only direct children of that parent in the same school.
   * Read-only: never writes to the counter.
   */
  async previewNextChildCode(
    tx: Prisma.TransactionClient,
    schoolId: number,
    parentCode: string,
  ): Promise<{ code: string; requiredLength: number }> {
    const requiredLength = AccountCodeService.childCodeLengthFor(parentCode);
    if (requiredLength === null) {
      throw new BadRequestException(
        `Account "${parentCode}" cannot have children.`,
      );
    }
    const nextSeq = await this.computeNextSeq(
      tx,
      schoolId,
      parentCode,
      requiredLength - parentCode.length,
      // Only the 4111 PERSON branch skips sequence 0: the first parent
      // account must be 41110001. Structural levels start at 0 (50, 500…).
      parentCode === AccountCodeService.CUSTOMER_BRANCH_CODE ? 1 : 0,
      false,
    );
    return {
      code: this.formatChildCode(parentCode, nextSeq, requiredLength),
      requiredLength,
    };
  }

  /**
   * Authoritative child-code allocation for ANY hierarchy parent.
   * Same monotonic, gap-reusing-never, row-lock-serialized semantics as the
   * customer-leaf allocator, keyed per (school_id, parent code) so
   * independent branches and schools never affect each other.
   */
  async allocateNextChildCode(
    tx: Prisma.TransactionClient,
    schoolId: number,
    parentCode: string,
  ): Promise<string> {
    const requiredLength = AccountCodeService.childCodeLengthFor(parentCode);
    if (requiredLength === null) {
      throw new BadRequestException(
        `Account "${parentCode}" cannot have children.`,
      );
    }
    const nextSeq = await this.computeNextSeq(
      tx,
      schoolId,
      parentCode,
      requiredLength - parentCode.length,
      // Only the 4111 PERSON branch skips sequence 0 (see preview above).
      parentCode === AccountCodeService.CUSTOMER_BRANCH_CODE ? 1 : 0,
      true,
    );
    return this.formatChildCode(parentCode, nextSeq, requiredLength);
  }

  /**
   * Advance a branch counter past explicitly created codes so later
   * previews/allocations continue forward monotonically.
   */
  async syncBranchCounter(
    tx: Prisma.TransactionClient,
    schoolId: number,
    parentCode: string,
  ): Promise<void> {
    const requiredLength = AccountCodeService.childCodeLengthFor(parentCode);
    if (requiredLength === null) {
      return;
    }
    const seq = await this.maxExistingSeq(
      tx,
      schoolId,
      parentCode,
      requiredLength - parentCode.length,
      parentCode.length === 4 ? 0 : -1,
    );
    // Structural levels legitimately start at sequence 0 (e.g. 50);
    // persisting the observed max keeps the counter authoritative.
    await tx.$queryRaw`
      INSERT INTO "account_code_counters" ("school_id", "prefix", "last_seq")
      VALUES (${schoolId}, ${parentCode}, ${seq})
      ON CONFLICT ("school_id", "prefix")
      DO UPDATE SET "last_seq" = GREATEST("account_code_counters"."last_seq", ${seq})
    `;
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
    return this.syncBranchCounter(
      tx,
      schoolId,
      AccountCodeService.PREFIX,
    );
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
    minSeq: number,
    commit: boolean,
  ): Promise<number> {
    const maxSeqValue = 10 ** seqWidth - 1;
    // A fresh branch starts *before* minSeq so the first allocation yields
    // minSeq itself (0 for structural levels like 50, 1 for PERSON leaves).
    const freshSeq = minSeq - 1;
    let counterSeq: number;
    if (commit) {
      // One atomic statement: creates the row at freshSeq when absent,
      // otherwise takes the row lock until transaction commit (UPDATE
      // always locks).
      const [locked] = await tx.$queryRaw<Array<{ seq: number }>>`
        INSERT INTO "account_code_counters" ("school_id", "prefix", "last_seq")
        VALUES (${schoolId}, ${prefix}, ${freshSeq})
        ON CONFLICT ("school_id", "prefix")
        DO UPDATE SET "last_seq" = "account_code_counters"."last_seq"
        RETURNING "last_seq" AS "seq"
      `;
      counterSeq = locked?.seq ?? freshSeq;
    } else {
      const counters = await tx.$queryRaw<Array<{ seq: number }>>`
        SELECT "last_seq" AS "seq" FROM "account_code_counters"
        WHERE "school_id" = ${schoolId} AND "prefix" = ${prefix}
      `;
      counterSeq = counters[0]?.seq ?? freshSeq;
    }
    const maxExisting = await this.maxExistingSeq(
      tx,
      schoolId,
      prefix,
      seqWidth,
      freshSeq,
    );
    // Monotonic: never reuse gaps, never recycle deleted codes.
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
    emptyValue: number,
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
    let max = emptyValue;
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
    return this.formatChildCode(
      AccountCodeService.PREFIX,
      seq,
      AccountCodeService.CUSTOMER_LEAF_CODE_LENGTH,
    );
  }

  private formatChildCode(
    parentCode: string,
    seq: number,
    requiredLength: number,
  ): string {
    return `${parentCode}${String(seq).padStart(requiredLength - parentCode.length, '0')}`;
  }
}
