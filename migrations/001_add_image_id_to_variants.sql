-- PostgreSQL migration: add image_id to product_variants.
ALTER TABLE product_variants
    ADD COLUMN IF NOT EXISTS image_id INT NULL;

DO $$
BEGIN
    ALTER TABLE product_variants
        ADD CONSTRAINT fk_variant_image
        FOREIGN KEY (image_id) REFERENCES product_images(id)
        ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS product_variants_idx_variant_image ON product_variants (image_id);
