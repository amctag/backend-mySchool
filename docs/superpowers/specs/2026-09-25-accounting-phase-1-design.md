# Accounting Phase 1 Design

## Goal

Add the approved Accounting Phase 1 database foundation to the existing NestJS, Prisma, and PostgreSQL backend. This phase changes only the Prisma schema, a new migration, and the idempotent lookup seed. It does not add accounting APIs, posting logic, document-number generation, installment behavior, or frontend pages.

## Fixed business requirements

- `Account` remains limited to `id` and unique `code`.
- Existing `Person` receives nullable `accountId` mapped to `persons.account_id`; no person/account junction replaces it.
- All requested accounting tables and relationships retain their specified business meaning.
- `currencyId` and `userId` remain nullable integer columns without foreign keys because the current schema has neither `Currency` nor generic `User` models.
- Existing tables and data must not be dropped, recreated, reset, or destructively rewritten.
- Phase 2 behavior is out of scope.

## Prisma and PostgreSQL mapping

New Prisma models use singular PascalCase names and camelCase fields. PostgreSQL uses the exact requested table names through `@@map` and snake_case columns through `@map`.

The models and mapped tables are:

| Prisma model | PostgreSQL table |
|---|---|
| `AccountingRegisterType` | `accounting_register_types` |
| `Account` | `accounts` |
| `AccountingRegister` | `accounting_register` |
| `AccountingDaily` | `accounting_daily` |
| `AccountingReceipt` | `accounting_receipts` |
| `AccountingPayment` | `accounting_payments` |
| `AccountingSale` | `accounting_sales` |
| `AccountingPurchase` | `accounting_purchase` |
| `AccountingSalesReturn` | `accounting_sales_return` |
| `AccountingPurchaseReturn` | `accounting_purchase_return` |
| `AccountingInvoice` | `accounting_invoice` |
| `AccountingInvoiceDetail` | `accounting_invoice_details` |
| `ItemType` | `item_types` |
| `Item` | `items` |
| `AccountingRegistrationPackage` | `accounting_registration_package` |
| `AccountingRegistrationPackageItem` | `accounting_registration_package_items` |
| `AccountingRegistrationPackageClass` | `accounting_registration_package_classes` |
| `Installment` | `installment` |

`Person` gains `accountId Int?` and an optional `Account` relation. Required reverse relations are added to existing `School`, `Year`, and `Class` models and to all new models so Prisma validation succeeds.

## Field types and nullability

- IDs and document `nb` values use auto-incrementing or ordinary PostgreSQL integers, matching the existing project.
- Descriptions, notes, and comments whose business requirement does not require content are nullable text.
- `AccountingRegister.dateCreated`, invoice/package/installment `dateCreated`, and package-class/package-item creation dates use `DateTime @default(now()) @db.Timestamptz(6)`.
- The installment business `date` is nullable `DateTime @db.Date`; it is distinct from its creation timestamp.
- `currencyId` and `userId` are nullable `Int` values without relations.
- `currencyRate` uses `Decimal(18,6)` and is nullable because currency itself is optional and has no lookup model yet.
- Monetary values (`debit`, `credit`, `tax`, `discount`, `total`, `unitPrice`, `price`, and `amount`) use `Decimal(18,2)`.
- Fractional invoice quantity is supported with `Decimal(18,3)`.
- `Installment.paid` is Boolean with a default of `false`.
- Item and package names and account codes use bounded `VarChar(255)` values. Register-type and item-type names are unique.

No unspecified timestamps or product/inventory attributes are added. The `Item` model receives the project's standard `createdAt` and `updatedAt` timestamps because it is a maintained school-owned entity; lookup models and accounting records retain only their requested fields plus technically required relation fields.

## Relations and deletion behavior

Financial history is conservative:

- `persons.account_id → accounts.id`: `ON DELETE RESTRICT` when populated.
- Register type and School to accounting register: `ON DELETE RESTRICT`.
- Account/register/item/year/class/package/receipt relations: `ON DELETE RESTRICT`.
- Invoice to invoice details: `ON DELETE CASCADE`, treating details as owned children of the invoice.
- Other document/register relations do not cascade.

Foreign-key columns receive indexes where Prisma/PostgreSQL does not create an appropriate unique index. `Account.code`, register-type name, and item-type name are unique. No new uniqueness rule is imposed on `nb` in Phase 1 because number generation and its business scope are explicitly deferred.

## Lookup seeding

The existing `seedLookups` function is extended with typed Prisma accessors and `upsert` calls keyed by unique name.

Accounting register types:

- Receipt
- Payment
- Sales
- Purchase
- Sales Return
- Purchase Return

Item types:

- Product
- Services

The lookup seed remains repeatable and non-destructive. The destructive full development seed is not executed.

## Migration workflow

1. Add a schema-level regression test that checks the required models, mappings, fields, relations, numeric types, and seed names; run it and observe failure before implementation.
2. Update `prisma/schema.prisma` and `src/database/seed/seed-lookups.ts` minimally until the regression test passes.
3. Run `npx prisma format` and `npx prisma validate`.
4. Run `npx prisma migrate dev --name add_accounting_phase_1 --create-only` against the development database.
5. Inspect the complete generated SQL. It may create the approved tables, indexes, foreign keys, and nullable `persons.account_id`; it must not drop or recreate existing tables or modify existing rows.
6. If and only if the SQL is non-destructive and matches this design, apply it using the established development migration workflow.
7. Run `npx prisma generate`, `npx prisma validate`, and the backend build/type-check.
8. Run only the idempotent lookup seed.
9. Query PostgreSQL metadata and lookup tables read-only to verify the new tables, `persons.account_id`, foreign keys, indexes, and eight required seed rows.

The workflow must not use `prisma db push`, `prisma migrate reset`, or any force-reset option.

## Validation and success criteria

Phase 1 is complete only when:

- The schema regression test and existing relevant tests pass.
- Prisma format and validation succeed.
- The generated migration contains no destructive changes to existing tables/data.
- The migration applies successfully to the development database.
- Prisma Client generation and backend build succeed.
- The lookup seed runs successfully and is safe to rerun.
- Direct PostgreSQL verification confirms the approved tables, column, foreign keys, indexes, and lookup records.
- No Phase 2 API, posting, numbering, installment, navigation, or frontend code is introduced.

