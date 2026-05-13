// Service gom logic productvisualembeddingservice để controller không phải lặp xử lý nghiệp vụ.
const crypto = require("crypto");
const pool = require("../config/database");
const Product = require("../models/Product");
const ProductImageEmbedding = require("../models/ProductImageEmbedding");

const DEFAULT_EMBED_MODEL = "nvidia/nvclip";
const DEFAULT_EMBED_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Lấy endpoint API dùng để tạo visual embedding từ biến môi trường hoặc cấu hình mặc định.
function resolveEmbedBaseUrl() {
  return String(
    process.env.PRODUCT_VISUAL_EMBED_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      DEFAULT_EMBED_BASE_URL,
  )
    .trim()
    .replace(/\/$/, "");
}

// Lấy API key cho dịch vụ visual embedding, ưu tiên khóa riêng của sản phẩm.
function resolveVisualApiKey() {
  return String(
    process.env.PRODUCT_VISUAL_NVIDIA_API_KEY ||
      process.env.NVIDIA_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
  ).trim();
}

// Xác định model embedding ảnh đang được cấu hình cho hệ thống.
function resolveModel() {
  return (
    String(
      process.env.PRODUCT_VISUAL_EMBED_MODEL || DEFAULT_EMBED_MODEL,
    ).trim() || DEFAULT_EMBED_MODEL
  );
}

// Cho phép ép input_type cho model bất đối xứng (query/passage) qua biến môi trường.
function resolveVisualInputType() {
  const value = String(process.env.PRODUCT_VISUAL_INPUT_TYPE || "")
    .trim()
    .toLowerCase();
  if (value === "query" || value === "passage") {
    return value;
  }
  return "";
}

// Đọc timeout gọi API embedding và đặt ngưỡng tối thiểu để tránh hủy request quá sớm.
function getVisualEmbeddingTimeoutMs() {
  return Math.max(
    4000,
    Number.parseInt(process.env.PRODUCT_VISUAL_EMBED_TIMEOUT_MS, 10) || 10000,
  );
}

// Gọi HTTP có timeout riêng để request embedding không treo tiến trình.
async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = getVisualEmbeddingTimeoutMs(),
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  timeoutId.unref?.();

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Visual embedding request timed out after ${timeoutMs}ms`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Kiểm tra hệ thống đã có khóa API để bật tính năng embedding ảnh hay chưa.
function hasVisualEmbeddingCredentials() {
  return Boolean(resolveVisualApiKey());
}

// Chuẩn hóa vector theo L2 để so sánh cosine ổn định hơn.
function l2Normalize(vector = []) {
  const arr = Array.isArray(vector) ? vector.map(Number) : [];
  let sum = 0;
  arr.forEach((v) => {
    sum += v * v;
  });
  const mag = Math.sqrt(sum) || 1;
  return arr.map((v) => v / mag);
}

// Tính độ tương đồng cosine giữa hai vector ảnh cùng kích thước.
function cosineSimilarity(left = [], right = []) {
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length === 0 ||
    left.length !== right.length
  ) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < left.length; i += 1) {
    dot += Number(left[i]) * Number(right[i]);
  }
  return dot;
}

/** NV-CLIP hosted API: inline base64 chỉ nhận ảnh đã decode khoảng <= 200KB, định dạng jpg/png/jpeg. */
const NV_CLIP_MAX_IMAGE_BYTES = 200 * 1024;

/**
 * NV-CLIP chỉ chấp nhận png/jpg/jpeg trong payload; WebP/AVIF phải decode thật sang JPEG.
 * Không được trả về buffer gốc nếu đoán sai định dạng, ví dụ WebP nhỏ bị coi là JPEG.
 */
async function prepareImageBufferForNvClip(buffer) {
  const sharp = require("sharp");
  // Nén ảnh theo từng mức kích thước/chất lượng để phù hợp giới hạn payload của NV-CLIP.
  const shrink = async (maxSide, quality) =>
    sharp(buffer)
      .rotate()
      .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

  const steps = [
    [1024, 88],
    [768, 85],
    [640, 80],
    [512, 75],
    [448, 70],
    [384, 65],
    [320, 60],
    [256, 58],
    [224, 55],
  ];

  let out = await shrink(steps[0][0], steps[0][1]);
  for (
    let i = 1;
    i < steps.length && out.length > NV_CLIP_MAX_IMAGE_BYTES;
    i += 1
  ) {
    out = await shrink(steps[i][0], steps[i][1]);
  }

  if (out.length > NV_CLIP_MAX_IMAGE_BYTES) {
    throw new Error(
      "NV-CLIP: image still exceeds 200KB after compression; use a smaller source image or NVCF asset upload.",
    );
  }

  return { buffer: out, mimeExt: "jpeg" };
}

// Trích vector embedding từ response chuẩn OpenAI-compatible của NVIDIA.
function parseOpenAiEmbeddingResponse(json) {
  if (
    !json ||
    typeof json !== "object" ||
    !Array.isArray(json.data) ||
    !json.data.length
  ) {
    return null;
  }
  const first = json.data[0];
  const emb = first && first.embedding;
  if (Array.isArray(emb) && emb.length && typeof emb[0] === "number") {
    return emb.map(Number);
  }
  return null;
}

// Tải ảnh sản phẩm từ URL về buffer để chuẩn bị gửi sang dịch vụ embedding.
async function fetchImageBuffer(imageUrl) {
  const response = await fetch(String(imageUrl || "").trim(), {
    headers: { "User-Agent": "TMDT-VisualEmbed/1.0" },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    throw new Error(`Image fetch ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Chuyển buffer ảnh thành vector embedding thông qua API NVIDIA/OpenAI-compatible.
async function embedImageBuffer(imageBuffer, options = {}) {
  const apiKey = resolveVisualApiKey();
  if (!apiKey) {
    throw new Error(
      "Visual embedding API key missing: set OPENAI_API_KEY (nvapi-...) or PRODUCT_VISUAL_NVIDIA_API_KEY.",
    );
  }

  const model = options.model || resolveModel();
  const baseUrl = resolveEmbedBaseUrl();
  const url = `${baseUrl}/embeddings`;

  const { buffer: prepared, mimeExt } =
    await prepareImageBufferForNvClip(imageBuffer);
  const b64 = Buffer.from(prepared).toString("base64");
  const input = `data:image/${mimeExt};base64,${b64}`;

  const payload = {
    model,
    input: [input],
  };

  const inputType = resolveVisualInputType();
  if (inputType) {
    payload.input_type = inputType;
  }

  const body = JSON.stringify(payload);

  let attempt = 0;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    attempt += 1;
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const rawBody = await response.text();
    let json = null;
    if (rawBody) {
      try {
        json = JSON.parse(rawBody);
      } catch {
        json = null;
      }
    }

    if (response.status === 503 && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 8000));
      continue;
    }

    if (!response.ok) {
      const errObj = json && json.error;
      const detail =
        (typeof errObj === "string" ? errObj : null) ||
        errObj?.message ||
        errObj?.detail ||
        json?.message ||
        json?.detail ||
        (json && typeof json === "object"
          ? JSON.stringify(json).slice(0, 900)
          : null) ||
        rawBody?.slice(0, 900) ||
        "(empty body)";
      throw new Error(`NVIDIA visual embedding ${response.status}: ${detail}`);
    }

    const flat = parseOpenAiEmbeddingResponse(json);
    if (!flat || !flat.length) {
      throw new Error("NVIDIA visual embedding returned empty vector");
    }

    return l2Normalize(flat);
  }

  throw new Error("NVIDIA visual embedding failed after retries");
}

// Tạo vector embedding cho ảnh sản phẩm lấy trực tiếp từ URL.
async function embedImageFromUrl(imageUrl) {
  const buffer = await fetchImageBuffer(imageUrl);
  return embedImageBuffer(buffer);
}

// Tạo hash nội dung URL ảnh để biết embedding hiện có còn dùng được hay không.
function hashContent(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

// Đồng bộ embedding cho ảnh đại diện của một sản phẩm và lưu vào bảng tìm kiếm ảnh.
async function syncPrimaryProductImageEmbedding(productId) {
  if (!hasVisualEmbeddingCredentials()) {
    return { skipped: true, reason: "no_token" };
  }

  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    return { skipped: true, reason: "bad_id" };
  }

  const images = await Product.getImages(id);
  if (!images.length) {
    await ProductImageEmbedding.deleteByProductId(id);
    return { skipped: true, reason: "no_images" };
  }

  const primary = images.find((img) => img.is_primary) || images[0];
  const imageUrl = primary.image_url;
  const contentHash = hashContent(imageUrl);
  const model = resolveModel();

  const existing = await ProductImageEmbedding.getByProductId(id);
  if (
    existing?.content_hash === contentHash &&
    existing?.embedding_model === model
  ) {
    return { skipped: true, reason: "unchanged" };
  }

  console.log(
    `[visual-sync] product ${id}: calling NVIDIA embed (fetch + resize + API)...`,
  );
  const vector = await embedImageFromUrl(imageUrl);
  await ProductImageEmbedding.upsertForProduct({
    productId: id,
    productImageId: primary.id,
    imageUrl,
    contentHash,
    embeddingModel: model,
    embeddingDim: vector.length,
    embeddingVector: vector,
  });

  return { skipped: false, productId: id };
}

// Đưa việc đồng bộ embedding ảnh sản phẩm vào hàng đợi nền sau khi dữ liệu thay đổi.
function scheduleProductVisualEmbeddingSync(productId) {
  if (!hasVisualEmbeddingCredentials()) {
    return;
  }
  setImmediate(() => {
    syncPrimaryProductImageEmbedding(productId).catch((err) => {
      console.error("productVisualEmbeddingSync error:", err.message || err);
    });
  });
}

// Tìm sản phẩm có ảnh tương tự ảnh đầu vào bằng cosine similarity trên vector đã lưu.
async function searchSimilarProductsByImageUrl(imageUrl, limit = 12) {
  if (!hasVisualEmbeddingCredentials() || !String(imageUrl || "").trim()) {
    return [];
  }

  let queryVector;
  try {
    queryVector = await embedImageFromUrl(imageUrl);
  } catch (error) {
    console.error("Visual query embed error:", error.message || error);
    return [];
  }

  const rows = await ProductImageEmbedding.listAllForSearch();
  const dim = queryVector.length;
  const model = resolveModel();
  const compatible = rows.filter(
    (row) =>
      row.embedding_model === model &&
      Array.isArray(row.embedding_vector) &&
      row.embedding_vector.length === dim,
  );

  if (!compatible.length) {
    return [];
  }

  const scored = compatible
    .map((row) => ({
      productId: row.product_id,
      score: cosineSimilarity(queryVector, row.embedding_vector),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit, 1));

  if (!scored.length) {
    return [];
  }

  const products = await Product.getByIds(scored.map((s) => s.productId));
  const active = products.filter(
    (p) => p && p.is_active !== false && p.is_active !== 0,
  );
  const byId = new Map(active.map((p) => [p.id, p]));

  return scored
    .map((s) => {
      const p = byId.get(s.productId);
      if (!p) {
        return null;
      }
      return {
        ...p,
        visual_similarity: s.score,
      };
    })
    .filter(Boolean);
}

// Quét toàn bộ sản phẩm đang bật để tạo lại embedding ảnh phục vụ tìm kiếm tương tự.
async function syncAllProductImageEmbeddings(options = {}) {
  if (!hasVisualEmbeddingCredentials()) {
    throw new Error(
      "Visual embedding API key not set (OPENAI_API_KEY or PRODUCT_VISUAL_NVIDIA_API_KEY)",
    );
  }

  const delayMs =
    Number.parseInt(process.env.PRODUCT_VISUAL_SYNC_DELAY_MS, 10) || 400;
  const logEvery = Math.max(
    1,
    Number.parseInt(process.env.PRODUCT_VISUAL_SYNC_LOG_EVERY, 10) || 20,
  );

  const [rows] = await pool.execute(
    "SELECT id FROM products WHERE is_active = TRUE ORDER BY id ASC",
  );

  console.log(
    `[visual-sync] ${rows.length} active products (log every ${logEvery} rows; delay ${delayMs}ms)`,
  );

  let embedded = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (i === 0 || (i + 1) % logEvery === 0 || i === rows.length - 1) {
      console.log(
        `[visual-sync] ... ${i + 1}/${rows.length} (product id ${row.id})`,
      );
    }
    try {
      const result = await syncPrimaryProductImageEmbedding(row.id);
      if (!result.skipped) {
        embedded += 1;
        console.log(`[visual-sync] product ${row.id}: embedded OK`);
      }
    } catch (e) {
      fail += 1;
      console.error(`Embed failed product ${row.id}:`, e.message || e);
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const total = await ProductImageEmbedding.count();
  return { processed: rows.length, embedded, fail, indexed: total };
}

module.exports = {
  hasVisualEmbeddingCredentials,
  resolveModel,
  embedImageFromUrl,
  syncPrimaryProductImageEmbedding,
  scheduleProductVisualEmbeddingSync,
  searchSimilarProductsByImageUrl,
  syncAllProductImageEmbeddings,
};
