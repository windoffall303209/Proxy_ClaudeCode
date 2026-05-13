-- Migration: Add image_id to product_variants table
-- PostgreSQL version.

ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS image_id INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'product_variants'::regclass
          AND c.contype = 'f'
          AND a.attname = 'image_id'
    ) THEN
        ALTER TABLE product_variants
            ADD CONSTRAINT fk_variant_image
            FOREIGN KEY (image_id) REFERENCES product_images(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_variants_image ON product_variants(image_id);
