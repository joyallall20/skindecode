import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  isAllowedImageMimeType,
} from '../utils/productImageValidation.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (isAllowedImageMimeType(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new ApiError(400, 'Only JPEG, PNG, and WebP images are allowed.'));
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES },
  fileFilter,
});

export { ALLOWED_PRODUCT_IMAGE_TYPES, MAX_PRODUCT_IMAGE_BYTES, isAllowedImageMimeType };

export const productImageUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new ApiError(400, 'Image exceeds the 5MB maximum upload size.'));
        return;
      }
      next(new ApiError(400, error.message));
      return;
    }

    next(error);
  });
};

export default productImageUpload;
