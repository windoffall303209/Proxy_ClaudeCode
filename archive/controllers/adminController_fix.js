// Xử lý biến thể sản phẩm (variants)
if (req.body.variants) {
  try {
    const variants = JSON.parse(req.body.variants);
    for (const variant of variants) {
      // Auto-generate SKU if not provided
      let variantSku = variant.sku && variant.sku.trim() ? variant.sku.trim() : Product.generateVariantSKU(product.name, product.sku, variant.size, variant.color);

      await Product.addVariant(product.id, {
        size: variant.size,
        color: variant.color,
        additional_price: variant.additional_price || 0,
        stock_quantity: variant.stock_quantity || 0,
        sku: variantSku
      });
    }
  } catch (e) {
    console.error('Error parsing variants:', e);
  }
}