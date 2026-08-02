-- QR receipt scanning removed from scope (founder decision 2026-08-03).
-- Verified beforehand that no rows use source='QR' and no qrRaw data exists.

-- Postgres cannot drop a value from an enum in place, so swap the type.
ALTER TABLE "Receipt" ALTER COLUMN "source" DROP DEFAULT;

CREATE TYPE "ReceiptSource_new" AS ENUM ('PHOTO', 'TEXT');

ALTER TABLE "Receipt"
  ALTER COLUMN "source" TYPE "ReceiptSource_new"
  USING ("source"::text::"ReceiptSource_new");

ALTER TYPE "ReceiptSource" RENAME TO "ReceiptSource_old";
ALTER TYPE "ReceiptSource_new" RENAME TO "ReceiptSource";
DROP TYPE "ReceiptSource_old";

ALTER TABLE "Receipt" ALTER COLUMN "source" SET DEFAULT 'PHOTO';

-- The raw fiscal QR string has no remaining purpose.
ALTER TABLE "Receipt" DROP COLUMN "qrRaw";
