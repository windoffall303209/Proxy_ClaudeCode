-- Migration: Add image_id to product_variants table
-- This allows linking specific images to variants for color-based image display
-- Run this migration after creating the product_variants table

-- Add image_id column if it doesn't exist
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS image_id INT NULL,
ADD CONSTRAINT fk_variant_image
FOREIGN KEY (image_id) REFERENCES product_images(id)
ON DELETE SET NULL;
