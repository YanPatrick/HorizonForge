-- Fix: add 'uncommon' to items_rarity_check constraint
-- The original migrate_equipment.sql omitted 'uncommon', but the server code
-- uses it in chest generation (CHEST_RARITY_ROLL) and campaign rewards (stage 2).
-- Safe to re-run.

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_rarity_check;
ALTER TABLE items ADD CONSTRAINT items_rarity_check
  CHECK (rarity IN ('starter','common','uncommon','rare','epic','legendary'));
