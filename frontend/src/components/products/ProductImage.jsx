import { useState } from 'react';
import { resolveImageUrls } from '../../utils/productFormConstants.js';

/**
 * ProductImage
 * Renders a product's primary image with a soft gradient fallback.
 * Accepts either a resolved URL string or the raw `images` array from the API.
 */
export default function ProductImage({ images, src, alt = '', className = '', style = {} }) {
  const resolved = src
    ? [src]
    : resolveImageUrls(images || []);

  const primary = resolved[0] || null;
  const [errored, setErrored] = useState(false);

  if (!primary || errored) {
    return (
      <div
        className={`product-image product-image--placeholder ${className}`}
        style={style}
        aria-label={alt || 'Product image'}
      >
        <span className="product-image__initials" aria-hidden="true">
          {alt ? alt.charAt(0).toUpperCase() : '✦'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={primary}
      alt={alt}
      className={`product-image ${className}`}
      style={style}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
