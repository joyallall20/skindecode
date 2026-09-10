import { getCloudinaryConfig, isCloudinaryConfigured } from '../config/cloudinary.js';
import ApiError from '../utils/ApiError.js';

const loadCloudinary = async () => {
  const { v2 } = await import('cloudinary');
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  v2.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return v2;
};

const uploadBuffer = async (file, folder) => {
  const cloudinary = await loadCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
};

export const uploadProductImage = async (file, { uploadFn } = {}) => {
  if (!file?.buffer) {
    throw new ApiError(400, 'An image file is required.');
  }

  if (!uploadFn && !isCloudinaryConfigured()) {
    console.error('[cloudinary] configuration missing');
    throw new ApiError(503, 'Cloudinary is not configured.');
  }

  const { folder } = getCloudinaryConfig();

  try {
    const result = uploadFn
      ? await uploadFn(file, { folder })
      : await uploadBuffer(file, folder);

    const secureUrl = result?.secure_url || result?.url;
    const publicId = result?.public_id;
    if (!secureUrl || !publicId) {
      throw new Error('Cloudinary did not return a secure URL and public_id.');
    }

    return {
      secure_url: secureUrl,
      public_id: publicId,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[cloudinary] upload failed', { message: error.message });
    throw new ApiError(502, 'Unable to upload image to Cloudinary.');
  }
};

export const deleteProductImage = async (publicId, { destroyFn } = {}) => {
  if (!publicId) return { deleted: false, reason: 'missing_public_id' };

  if (!destroyFn && !isCloudinaryConfigured()) {
    console.error('[cloudinary] configuration missing');
    throw new ApiError(503, 'Cloudinary is not configured.');
  }

  try {
    const result = destroyFn
      ? await destroyFn(publicId)
      : await (await loadCloudinary()).uploader.destroy(publicId, { resource_type: 'image' });

    return {
      deleted: result?.result === 'ok' || result?.result === 'not found',
      result: result?.result || 'ok',
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[cloudinary] delete failed', { message: error.message, publicId });
    return {
      deleted: false,
      reason: error.message || 'cloudinary_delete_failed',
    };
  }
};

export default {
  uploadProductImage,
  deleteProductImage,
};
