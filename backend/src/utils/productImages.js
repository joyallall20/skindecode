import mongoose from 'mongoose';

export const toProductImageUrl = (entry) => {
  if (typeof entry === 'string') return entry.trim();
  return String(entry?.url || entry?.secure_url || '').trim();
};

export const normalizeProductImage = (entry, index = 0) => {
  if (entry === null || entry === undefined) return null;

  if (typeof entry === 'string') {
    const url = entry.trim();
    if (!url) return null;
    return {
      url,
      publicId: '',
      isPrimary: index === 0,
    };
  }

  if (typeof entry !== 'object') return null;
  const url = toProductImageUrl(entry);
  if (!url) return null;

  const normalized = {
    url,
    publicId: String(entry.publicId || entry.public_id || '').trim(),
    isPrimary: Boolean(entry.isPrimary) || index === 0,
  };

  if (entry._id) {
    normalized._id = entry._id;
  }

  return normalized;
};

export const normalizeProductImages = (images = []) => {
  if (!Array.isArray(images)) return [];
  const normalized = images
    .map((entry, index) => normalizeProductImage(entry, index))
    .filter(Boolean);

  if (normalized.length && !normalized.some((image) => image.isPrimary)) {
    normalized[0].isPrimary = true;
  }

  return normalized;
};

export const mergeIncomingProductImages = (existingImages = [], incomingImages = []) => {
  if (!Array.isArray(incomingImages)) return normalizeProductImages(existingImages);

  const existingByUrl = new Map();
  normalizeProductImages(existingImages).forEach((image) => {
    existingByUrl.set(image.url, image);
  });

  const merged = incomingImages
    .map((entry, index) => {
      const url = toProductImageUrl(entry);
      if (!url) return null;
      const previous = existingByUrl.get(url);
      const next = previous
        ? { ...previous }
        : normalizeProductImage(entry, index);
      if (!next) return null;
      if (typeof entry === 'object' && entry && Object.prototype.hasOwnProperty.call(entry, 'isPrimary')) {
        next.isPrimary = Boolean(entry.isPrimary);
      }
      return next;
    })
    .filter(Boolean);

  if (merged.length && !merged.some((image) => image.isPrimary)) {
    merged[0].isPrimary = true;
  } else {
    let seenPrimary = false;
    merged.forEach((image) => {
      if (image.isPrimary && !seenPrimary) {
        seenPrimary = true;
        return;
      }
      if (seenPrimary) image.isPrimary = false;
    });
  }

  return merged;
};

export const findProductImage = (images = [], imageId) => {
  const target = String(imageId || '').trim();
  if (!target) return null;

  return normalizeProductImages(images).find((image) => {
    if (image._id && String(image._id) === target) return true;
    if (image.publicId && image.publicId === target) return true;
    return false;
  }) || null;
};

export const createStoredProductImage = ({ url, publicId, isPrimary }) => ({
  _id: new mongoose.Types.ObjectId(),
  url,
  publicId: publicId || '',
  isPrimary: Boolean(isPrimary),
});

export default {
  toProductImageUrl,
  normalizeProductImage,
  normalizeProductImages,
  mergeIncomingProductImages,
  findProductImage,
  createStoredProductImage,
};
