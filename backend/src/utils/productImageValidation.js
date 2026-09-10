export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const isAllowedImageMimeType = (mimetype) => ALLOWED_PRODUCT_IMAGE_TYPES.includes(String(mimetype || '').toLowerCase());

export const isAllowedImageBuffer = (buffer, mimetype) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const type = String(mimetype || '').toLowerCase();

  if (type === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (type === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  return false;
};

export default {
  MAX_PRODUCT_IMAGE_BYTES,
  ALLOWED_PRODUCT_IMAGE_TYPES,
  isAllowedImageMimeType,
  isAllowedImageBuffer,
};
