import './BrandMarquee.css';

/**
 * BrandMarquee
 * Single-row, seamless, right-to-left infinite scroll of brand logos.
 * Pass a `brands` array of { name, src } — logo files should live in
 * src/assets/logos/ and be imported wherever this component is used.
 */
export default function BrandMarquee({ brands, speed = 38 }) {
  return (
    <div className="brand-marquee" style={{ '--marquee-duration': `${speed}s` }}>
      <div className="brand-marquee__fade brand-marquee__fade--left" aria-hidden="true" />
      <div className="brand-marquee__fade brand-marquee__fade--right" aria-hidden="true" />

      <div className="brand-marquee__track">
        {[...brands, ...brands].map((brand, i) => (
          <div className="brand-marquee__item" key={`${brand.name}-${i}`}>
            <img
              src={brand.src}
              alt={brand.name}
              className="brand-marquee__logo"
              loading="lazy"
              draggable="false"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
