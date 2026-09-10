import { helpTextStyle, panelStyle, secondaryButtonStyle } from './editorStyles.js';

export default function ProductImagesCard({
  images = [],
  onChange,
  disabled = false,
  uploading = false,
  onUploadFiles,
}) {
  const setPrimary = (key) => {
    onChange(images.map((image) => ({ ...image, isPrimary: image.key === key })));
  };

  const removeImage = (key) => {
    const next = images.filter((image) => image.key !== key);
    if (next.length && !next.some((image) => image.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  };

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (onUploadFiles) {
      onUploadFiles(files);
      return;
    }
    const next = [...images];
    files.forEach((file) => {
      const duplicate = next.some((image) => image.file && image.file.name === file.name && image.file.size === file.size);
      if (duplicate) return;
      next.push({
        key: `file-${file.name}-${file.size}-${Date.now()}`,
        url: URL.createObjectURL(file),
        publicId: '',
        isPrimary: next.length === 0,
        _id: null,
        file,
      });
    });
    onChange(next);
  };

  const primary = images.find((image) => image.isPrimary) || images[0];

  return (
    <section style={{ ...panelStyle, height: '100%' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Product Images</h2>
      <p style={{ ...helpTextStyle, marginTop: 0 }}>
        Set a main image for the catalog. Extracted URLs and uploaded files are both supported.
      </p>

      {images.length === 0 ? (
        <div style={{
          marginTop: 18,
          minHeight: 220,
          border: '1px dashed #d1d5db',
          borderRadius: 16,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: '#6b7280',
          padding: 24,
          background: '#f9fafb',
        }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>No product images yet</div>
            <p style={{ margin: '0 0 16px' }}>Upload photos or extract a product URL to populate images.</p>
            <label style={{ ...secondaryButtonStyle, display: 'inline-block' }}>
              Upload Images
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={disabled || uploading} onChange={handleFiles} />
            </label>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{
            width: '100%',
            aspectRatio: '1 / 1',
            maxHeight: 320,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            marginBottom: 12,
          }}
          >
            <img src={primary.url} alt="Main product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {images.map((image) => (
              <div key={image.key} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setPrimary(image.key)}
                  disabled={disabled}
                  style={{
                    width: 72,
                    height: 72,
                    padding: 0,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: image.isPrimary ? '2px solid #111827' : '1px solid #e5e7eb',
                    cursor: 'pointer',
                    background: '#fff',
                  }}
                >
                  <img src={image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => removeImage(image.key)}
                  disabled={disabled}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: 'none',
                    background: '#111827',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <label style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              border: '1px dashed #d1d5db',
              display: 'grid',
              placeItems: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: '#6b7280',
              fontWeight: 700,
              background: '#f9fafb',
            }}
            >
              +
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={disabled || uploading} onChange={handleFiles} />
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ ...secondaryButtonStyle, display: 'inline-block' }}>
              {uploading ? 'Uploading…' : 'Upload Images'}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={disabled || uploading} onChange={handleFiles} />
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
