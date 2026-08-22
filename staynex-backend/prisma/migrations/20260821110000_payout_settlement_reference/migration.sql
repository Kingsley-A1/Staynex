-- Preserve structured external settlement evidence separately from operator notes.
ALTER TABLE "Payout" ADD COLUMN "settlementReference" STRING;
