import mongoose from "mongoose";
import Product from "../models/Product.js";
import ProductImport from "../models/ProductImport.js";
import Brand from "../models/Brand.js";
import Category from "../models/Category.js";
import Ingredient from "../models/Ingredient.js";
import ProductOffer from "../models/ProductOffer.js";
import Retailer from "../models/Retailer.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { extractProductFromUrl } from "../services/productExtractionService.js";
import { assertSafeUrl, UrlSafetyError } from "../utils/urlSafety.js";
import { buildIntelligenceInputFromExtractedData } from "../utils/productIntelligenceInput.js";
import {
  buildProductContext,
  getIntelligenceAuditInfo,
} from "../services/productIntelligenceService.js";
import {
  computeCanonicalIdentityHash,
  buildProductSlug,
} from "../services/productIdentityService.js";
import { parseIngredientList } from "../utils/ingredientList.js";

const EDITABLE_EXTRACTED_FIELDS = [
  "name",
  "brand",
  "category",
  "description",
  "images",
  "ingredients",
  "keyIngredients",
  "ingredientConfidence",
  "skinTypes",
  "concerns",
  "fragranceFree",
  "alcoholFree",
  "essentialOilFree",
  "pregnancyFriendly",
  "variant",
  "size",
  "quantity",
  "claims",
  "currency",
  "inStock",
  "sku",
  "upc",
  "ean",
  "gtin",
  "mpn",
  "retailerProductId",
  "price",
  "retailer",
];

const catalogProductId = (value) => {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "undefined" && text !== "null" ? text : null;
  }
  if (typeof value.toHexString === "function") return value.toHexString();
  if (typeof value === "object") {
    if (value._id) return catalogProductId(value._id);
  }
  const text = String(value);
  return /^[a-fA-F0-9]{24}$/.test(text) ? text : null;
};

const ensurePublishedProductLink = async (productImport) => {
  if (!productImport) return productImport;
  if (catalogProductId(productImport.publishedProduct)) return productImport;

  const extracted = getSanitizedExtractedData(
    productImport.extractedData || {},
  );
  let existing = null;

  if (extracted.name && extracted.brand && extracted.category) {
    const identityHash = computeCanonicalIdentityHash({
      ...extracted,
      brand: extracted.brand,
      category: extracted.category,
      productIdentifiers: {
        sku: extracted.sku,
        upc: extracted.upc,
        ean: extracted.ean,
        gtin: extracted.gtin,
        mpn: extracted.mpn,
        retailerProductId: extracted.retailerProductId,
      },
    });
    existing = await Product.findOne({ canonicalIdentityHash: identityHash })
      .select("_id")
      .lean();
  }

  if (!existing && productImport.sourceUrl) {
    existing = await Product.findOne({ sourceUrl: productImport.sourceUrl })
      .sort({ updatedAt: -1 })
      .select("_id")
      .lean();
  }

  if (!existing) return productImport;

  await ProductImport.updateOne(
    { _id: productImport._id },
    { $set: { publishedProduct: existing._id } },
  );
  console.info("[product-import] backfilled publishedProduct", {
    importId: String(productImport._id),
    productId: String(existing._id),
  });
  return { ...productImport, publishedProduct: existing._id };
};

const presentProductImport = (productImport) => {
  const publishedProduct = catalogProductId(productImport?.publishedProduct);
  return {
    ...productImport,
    publishedProduct,
    publishedProductId: publishedProduct,
  };
};

const getSanitizedExtractedData = (payload = {}) => ({
  name: String(payload.name || "").trim(),
  brand: String(payload.brand || "").trim(),
  category: String(payload.category || "").trim(),
  description: String(payload.description || "").trim(),
  images: (Array.isArray(payload.images) ? payload.images : [])
    .map((entry) =>
      typeof entry === "string" ? entry : entry?.url || entry?.secure_url || "",
    )
    .map((url) => String(url).trim())
    .filter(Boolean),
  ingredients: parseIngredientList(payload.ingredients),
  keyIngredients: parseIngredientList(payload.keyIngredients),
  ingredientSource: payload.ingredientSource || null,
  ingredientConfidence: payload.ingredientConfidence || null,
  skinTypes: Array.isArray(payload.skinTypes)
    ? payload.skinTypes.filter(Boolean)
    : [],
  concerns: Array.isArray(payload.concerns)
    ? payload.concerns.filter(Boolean)
    : [],
  fragranceFree: payload.fragranceFree ?? null,
  alcoholFree: payload.alcoholFree ?? null,
  essentialOilFree: payload.essentialOilFree ?? null,
  pregnancyFriendly: payload.pregnancyFriendly ?? null,
  variant: String(payload.variant || "").trim(),
  size: String(payload.size || "").trim(),
  quantity: String(payload.quantity || "").trim(),
  claims: Array.isArray(payload.claims) ? payload.claims.filter(Boolean) : [],
  currency: String(payload.currency || "INR").trim(),
  inStock: payload.inStock ?? null,
  sku: String(payload.sku || "").trim(),
  upc: String(payload.upc || "").trim(),
  ean: String(payload.ean || "").trim(),
  gtin: String(payload.gtin || "").trim(),
  mpn: String(payload.mpn || "").trim(),
  retailerProductId: String(payload.retailerProductId || "").trim(),
  price: (() => {
    if (
      payload.price === undefined ||
      payload.price === null ||
      payload.price === ""
    )
      return null;
    const n = Number(payload.price);
    return Number.isFinite(n) ? n : null;
  })(),
  retailer: String(payload.retailer || "").trim(),
});

const pickEditableExtractedData = (payload = {}) => {
  const next = {};
  EDITABLE_EXTRACTED_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      next[field] = payload[field];
    }
  });
  return next;
};

const mergeExtractedData = (current = {}, incoming = {}) =>
  getSanitizedExtractedData({
    ...(current && typeof current.toObject === "function"
      ? current.toObject()
      : current),
    ...pickEditableExtractedData(incoming),
  });

const buildExtractionMessage = (extraction, extractedData) => {
  if (extraction.status === "failed") {
    return extraction.note || "Unable to fetch product page.";
  }
  if (
    extraction.status === "not_configured" ||
    extraction.status === "invalid_response"
  ) {
    return extraction.note || "Unable to extract product details.";
  }

  const parts = [];
  if (extraction.aiProvider === "gemini") {
    parts.push("Groq extraction failed; Gemini fallback used.");
  }
  if (!extractedData.ingredients?.length) {
    parts.push(
      "Product details fetched, but no full ingredient list was found. Please enter ingredients manually.",
    );
  }
  return parts.join(" ") || extraction.note || "Product details fetched.";
};

export const createProductImport = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required to create product imports.");
  }

  const { sourceUrl } = req.body;
  if (!sourceUrl || !/^https?:\/\//i.test(String(sourceUrl))) {
    throw new ApiError(400, "A valid product URL is required.");
  }

  try {
    await assertSafeUrl(String(sourceUrl));
  } catch (error) {
    const message =
      error instanceof UrlSafetyError ? error.message : "URL is not allowed.";
    throw new ApiError(400, message);
  }

  const productImport = await ProductImport.create({
    sourceUrl,
    submittedBy: req.user._id,
    status: "pending",
  });

  console.info("[product-import] created", {
    id: productImport._id.toString(),
    sourceUrl,
  });

  res.status(201).json({ success: true, data: productImport });
});

export const extractProductFromImportUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  const productImport = await ProductImport.findById(id);
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required to extract product data.");
  }

  productImport.status = "processing";
  await productImport.save();
  console.info("[product-import] fetch started", {
    id: productImport._id.toString(),
    sourceUrl: productImport.sourceUrl,
  });

  try {
    const previousData = getSanitizedExtractedData(
      productImport.extractedData || {},
    );
    const extraction = await extractProductFromUrl(productImport.sourceUrl);
    let sanitizedData = getSanitizedExtractedData(
      extraction.extractedData || {},
    );

    const failedStatuses = new Set([
      "not_configured",
      "failed",
      "invalid_response",
    ]);
    const failed = failedStatuses.has(extraction.status);

    if (
      previousData.ingredientSource === "admin" &&
      previousData.ingredients.length
    ) {
      sanitizedData.ingredients = previousData.ingredients;
      sanitizedData.ingredientSource = "admin";
      sanitizedData.ingredientConfidence =
        previousData.ingredientConfidence || "high";
      console.info("[product-import] preserved admin ingredients", {
        count: previousData.ingredients.length,
      });
    }

    const hasNewFields = Boolean(
      sanitizedData.name || sanitizedData.brand || sanitizedData.category,
    );
    if (
      failed &&
      !hasNewFields &&
      (previousData.name || previousData.ingredients.length)
    ) {
      sanitizedData = previousData;
      if (
        previousData.ingredientSource === "admin" &&
        previousData.ingredients.length
      ) {
        sanitizedData.ingredients = previousData.ingredients;
        sanitizedData.ingredientSource = "admin";
      }
    }

    const message = buildExtractionMessage(extraction, sanitizedData);

    productImport.extractedData = sanitizedData;
    productImport.aiProvider = extraction.aiProvider || "gemini";
    productImport.aiModel =
      extraction.aiModel || process.env.GEMINI_MODEL || "";
    productImport.aiRawResponse = extraction.rawResponse || extraction;
    productImport.status = failed ? "failed" : "review";
    productImport.errorMessage = failed
      ? message
      : sanitizedData.ingredients.length
        ? null
        : message;
    await productImport.save();
    console.info("[product-import] fetch completed", {
      id: productImport._id.toString(),
      status: productImport.status,
      provider: productImport.aiProvider,
    });
    console.info("[product-import] extraction completed", {
      ingredientCount: sanitizedData.ingredients.length,
      ingredientSource: sanitizedData.ingredientSource,
    });
    console.info("[product-import] saved", {
      id: productImport._id.toString(),
    });

    const payload = {
      success: !failed,
      message,
      data: productImport,
      product: {
        name: sanitizedData.name,
        brand: sanitizedData.brand,
        price: sanitizedData.price,
        category: sanitizedData.category,
        variant: sanitizedData.variant,
        keyIngredients: sanitizedData.keyIngredients,
        ingredients: sanitizedData.ingredients,
        skinTypes: sanitizedData.skinTypes,
        concerns: sanitizedData.concerns,
        ingredientSource: sanitizedData.ingredientSource,
      },
      extraction,
    };

    if (failed) {
      return res.status(422).json(payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    productImport.status = "failed";
    productImport.errorMessage =
      error.message || "Unable to fetch product page.";
    await productImport.save();
    console.error("[product-import] fetch failed", {
      id: productImport._id.toString(),
      error: error.message,
    });
    throw error;
  }
});

export const getProductImport = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  let productImport = await ProductImport.findById(id)
    .populate("submittedBy", "name email")
    .populate("reviewedBy", "name email")
    .lean();
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  productImport = await ensurePublishedProductLink(productImport);
  res
    .status(200)
    .json({ success: true, data: presentProductImport(productImport) });
});

export const getProductImports = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const { status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;

  const [imports, total] = await Promise.all([
    ProductImport.find(query)
      .populate("submittedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean(),
    ProductImport.countDocuments(query),
  ]);

  res
    .status(200)
    .json({
      success: true,
      data: imports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
});

export const updateExtractedProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  const productImport = await ProductImport.findById(id);
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  if (req.body?.extractedData) {
    const nextData = mergeExtractedData(
      productImport.extractedData,
      req.body.extractedData,
    );
    if (nextData.ingredients.length) {
      nextData.ingredientSource = "admin";
      nextData.ingredientConfidence = "high";
      productImport.errorMessage = null;
      console.info("[product-import] manual ingredients saved", {
        id: productImport._id.toString(),
        count: nextData.ingredients.length,
      });
    } else {
      nextData.ingredientSource = null;
      nextData.ingredientConfidence = null;
    }
    productImport.extractedData = nextData;
    if (
      productImport.status !== "rejected" &&
      nextData.name &&
      nextData.brand &&
      nextData.category
    ) {
      productImport.status = "review";
    }
  }

  await productImport.save();

  res.status(200).json({ success: true, data: productImport });
});

export const approveProductImport = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  const productImport = await ProductImport.findById(id);
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  productImport.status = "approved";
  productImport.reviewedBy = req.user._id;
  productImport.reviewedAt = new Date();
  await productImport.save();

  res.status(200).json({ success: true, data: productImport });
});

export const rejectProductImport = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  const productImport = await ProductImport.findById(id);
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  productImport.status = "rejected";
  productImport.reviewedBy = req.user._id;
  productImport.reviewedAt = new Date();
  productImport.errorMessage = req.body?.reason || "Rejected by admin.";
  await productImport.save();

  res.status(200).json({ success: true, data: productImport });
});

export const publishImportedProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(
      403,
      "Admin access required to publish imported products.",
    );
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  const productImport = await ProductImport.findById(id);
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  if (productImport.status === "rejected") {
    throw new ApiError(400, "Rejected imports cannot be saved to the catalog.");
  }

  const extractedData = getSanitizedExtractedData(
    productImport.extractedData || {},
  );
  if (!extractedData.name || !extractedData.brand || !extractedData.category) {
    throw new ApiError(
      400,
      "Product import is missing required extracted fields.",
    );
  }

  const brandName = String(extractedData.brand).trim();
  const categoryName = String(extractedData.category).trim();

  const [brandRecord, categoryRecord] = await Promise.all([
    Brand.findOneAndUpdate(
      { name: brandName },
      {
        $set: {
          name: brandName,
          slug: brandName.toLowerCase().replace(/\s+/g, "-"),
          isActive: true,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    ),
    Category.findOneAndUpdate(
      { name: categoryName },
      {
        $set: {
          name: categoryName,
          slug: categoryName.toLowerCase().replace(/\s+/g, "-"),
          isActive: true,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    ),
  ]);

  const ingredientDocs = await Promise.all(
    (extractedData.ingredients || []).map(async (ingredientName) => {
      const name = String(ingredientName).trim();
      if (!name) return null;
      const ingredient = await Ingredient.findOneAndUpdate(
        { name },
        { $set: { name, aliases: [name], isActive: true } },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
      );
      return ingredient._id;
    }),
  );

  const keyIngredientDocs = await Promise.all(
    (extractedData.keyIngredients || []).map(async (ingredientName) => {
      const name = String(ingredientName).trim();
      if (!name) return null;
      const ingredient = await Ingredient.findOneAndUpdate(
        { name },
        { $set: { name, aliases: [name], isActive: true } },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
      );
      return ingredient._id;
    }),
  );

  const identityHash = computeCanonicalIdentityHash({
    ...extractedData,
    brand: brandName,
    category: categoryName,
    productIdentifiers: {
      sku: extractedData.sku,
      upc: extractedData.upc,
      ean: extractedData.ean,
      gtin: extractedData.gtin,
      mpn: extractedData.mpn,
      retailerProductId: extractedData.retailerProductId,
    },
  });

  const productSlug =
    buildProductSlug({ ...extractedData, brand: brandName }) ||
    String(extractedData.name).trim().toLowerCase().replace(/\s+/g, "-");

  const product = await Product.findOneAndUpdate(
    { canonicalIdentityHash: identityHash },
    {
      $set: {
        name: extractedData.name,
        canonicalName: extractedData.name,
        slug: productSlug,
        brand: brandRecord._id,
        category: categoryRecord._id,
        description: extractedData.description || "",
        images: extractedData.images || [],
        ingredients: ingredientDocs.filter(Boolean),
        ingredientListText: (extractedData.ingredients || []).join(", "),
        keyIngredients: keyIngredientDocs.filter(Boolean),
        ingredientSource: extractedData.ingredientSource || null,
        ingredientConfidence: extractedData.ingredientConfidence || null,
        skinTypes: extractedData.skinTypes || [],
        concerns: extractedData.concerns || [],
        claims: extractedData.claims || [],
        variant: extractedData.variant || "",
        size: extractedData.size || "",
        quantity: extractedData.quantity || "",
        productIdentifiers: {
          sku: extractedData.sku || "",
          upc: extractedData.upc || "",
          ean: extractedData.ean || "",
          gtin: extractedData.gtin || "",
          mpn: extractedData.mpn || "",
          retailerProductId: extractedData.retailerProductId || "",
        },
        canonicalIdentityHash: identityHash,
        sourceUrl: productImport.sourceUrl,
        fragranceFree: extractedData.fragranceFree ?? null,
        alcoholFree: extractedData.alcoholFree ?? null,
        essentialOilFree: extractedData.essentialOilFree ?? null,
        pregnancyFriendly: extractedData.pregnancyFriendly ?? null,
        source: "ai_import",
        isActive: false,
        intelligenceStatus: "none",
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );

  if (
    extractedData.retailer &&
    extractedData.price !== null &&
    extractedData.price !== undefined
  ) {
    const retailerName = String(extractedData.retailer).trim();
    const retailerDoc = await Retailer.findOneAndUpdate(
      { name: retailerName },
      {
        $set: {
          name: retailerName,
          slug: retailerName.toLowerCase().replace(/\s+/g, "-"),
          isActive: true,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    );

    await ProductOffer.findOneAndUpdate(
      { product: product._id, retailer: retailerDoc._id },
      {
        $set: {
          product: product._id,
          retailer: retailerDoc._id,
          url: productImport.sourceUrl,
          originalUrl: productImport.sourceUrl,
          affiliateUrl: null,
          linkType: "direct",
          price: Number(extractedData.price),
          currency: extractedData.currency || "INR",
          inStock: extractedData.inStock ?? true,
          lastPriceCheck: new Date(),
          isActive: false,
        },
      },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    );
  }

  productImport.status = "approved";
  productImport.reviewedBy = req.user._id;
  productImport.reviewedAt = new Date();
  productImport.publishedProduct = product._id;
  await productImport.save();

  const publishedProductId = String(product._id);
  res.status(200).json({
    success: true,
    data: product,
    product,
    publishedProductId,
    publishedProductImport: presentProductImport(productImport.toObject()),
  });
});

export const getImportIntelligenceInput = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid product import ID.");
  }

  const productImport = await ProductImport.findById(id).lean();
  if (!productImport) {
    throw new ApiError(404, "Product import not found.");
  }

  const intelligenceInput = buildIntelligenceInputFromExtractedData(
    productImport.extractedData || {},
  );
  const auditInfo = getIntelligenceAuditInfo();

  res.status(200).json({
    success: true,
    data: {
      intelligenceInput,
      promptPreview: buildProductContext(intelligenceInput),
      audit: auditInfo,
      publishedProductId: productImport.publishedProduct || null,
    },
  });
});

export default {
  createProductImport,
  extractProductFromImportUrl,
  getProductImport,
  getProductImports,
  updateExtractedProduct,
  approveProductImport,
  rejectProductImport,
  publishImportedProduct,
  getImportIntelligenceInput,
};
