import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import ProductImage from './ProductImage.jsx';

/**
 * Get product rating from whichever rating field is available.
 */
export function getProductRating(product) {
  const raw =
    product?.rating ??
    product?.averageRating ??
    product?.ratingAverage ??
    product?.reviewRating ??
    product?.ratings?.average ??
    product?.ratings?.value ??
    null;

  const value =
    raw && typeof raw === 'object'
      ? raw.average ?? raw.value ?? null
      : raw;

  const num = Number(value);

  if (!Number.isFinite(num) || num <= 0) return null;

  return Math.min(5, Math.round(num * 10) / 10);
}

/**
 * Get marketplace prices from whichever price field exists.
 *
 * Returns:
 * [
 *   {
 *     name: 'Amazon',
 *     price: 799,
 *     url: '...'
 *   }
 * ]
 */
export function getMarketplacePrices(product) {
  const raw =
    product?.marketplacePrices ??
    product?.marketplacePricing ??
    product?.prices ??
    product?.marketplaces ??
    product?.priceListings ??
    null;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry) return null;

      const name =
        entry.marketplace ??
        entry.name ??
        entry.store ??
        entry.platform ??
        entry.source;

      const priceRaw =
        entry.price ??
        entry.amount ??
        entry.value ??
        entry.mrp;

      if (!name || priceRaw == null) return null;

      const price =
        typeof priceRaw === 'number'
          ? priceRaw
          : Number(String(priceRaw).replace(/[^0-9.]/g, ''));

      if (!Number.isFinite(price) || price <= 0) return null;

      return {
        name: String(name),
        price,
        url: entry.url ?? entry.link ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.price - b.price);
}

/**
 * Get retailer price offers for a product from real ProductOffer
 * records (product.offers — populated by the page-level batch offer
 * fetch, using the same offer shape ProductDetailPage already
 * consumes: offer.retailer?.name, offer.price, offer.url /
 * offer.affiliateUrl, offer.inStock, offer.isActive).
 *
 * Falls back to getMarketplacePrices() for any legacy inline price
 * fields already on the product, so nothing regresses for products
 * whose offers haven't loaded/been wired up yet.
 *
 * Never fabricates a price, retailer, or discount. Inactive or
 * out-of-stock offers are excluded when that information is present.
 *
 * Returns: [{ name, price, url }], sorted cheapest first.
 */
export function getRetailerOffers(product) {
  const rawOffers = Array.isArray(product?.offers) ? product.offers : null;

  if (!rawOffers || rawOffers.length === 0) {
    return getMarketplacePrices(product);
  }

  const seen = new Set();

  return rawOffers
    .filter(
      (offer) =>
        offer &&
        offer.isActive !== false &&
        offer.inStock !== false
    )
    .map((offer) => {
      const name = offer?.retailer?.name ?? offer?.retailerName ?? null;
      const price = Number(offer?.price);

      if (!name || !Number.isFinite(price) || price <= 0) return null;

      const url = offer?.url ?? offer?.affiliateUrl ?? null;

      return { name: String(name), price, url };
    })
    .filter((offer) => {
      if (!offer) return false;
      const key = offer.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.price - b.price);
}

export function formatINR(amount) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Get personalized recommendation reasons.
 *
 * Priority:
 * 1. Explicit recommendation reason
 * 2. Product intelligence explanation
 * 3. Structured compatibility information
 *
 * Never invents a personalized reason.
 */
function getRecommendationReasons(product) {
  const reasons = [];

  const explicitReasons =
    product?.recommendationReasons ??
    product?.recommendation?.reasons ??
    product?.matchReasons ??
    null;

  if (Array.isArray(explicitReasons)) {
    explicitReasons.forEach((item) => {
      const text =
        typeof item === 'string'
          ? item
          : item?.reason ??
            item?.text ??
            item?.message ??
            item?.description;

      if (typeof text === 'string' && text.trim()) {
        reasons.push(text.trim());
      }
    });
  }

  if (
    typeof product?.recommendationReason === 'string' &&
    product.recommendationReason.trim()
  ) {
    reasons.push(product.recommendationReason.trim());
  }

  if (
    typeof product?.whyRecommended === 'string' &&
    product.whyRecommended.trim()
  ) {
    reasons.push(product.whyRecommended.trim());
  }

  // Product-level intelligence.
  if (
    reasons.length === 0 &&
    typeof product?.productIntelligence?.explanation === 'string' &&
    product.productIntelligence.explanation.trim()
  ) {
    reasons.push(product.productIntelligence.explanation.trim());
  }

  const skinCompatibility =
    product?.productIntelligence?.skinTypeCompatibility;

  const concernCompatibility =
    product?.productIntelligence?.concernCompatibility;

  const sensitivitySuitability =
    product?.productIntelligence?.sensitivitySuitability;

  const extractPositiveText = (value) => {
    if (!value) return null;

    if (typeof value === 'string') {
      return value.trim() || null;
    }

    if (Array.isArray(value)) {
      const positive = value.find(
        (item) =>
          typeof item === 'string' ||
          item?.match === true ||
          item?.compatible === true ||
          item?.suitable === true
      );

      if (typeof positive === 'string') {
        return positive.trim() || null;
      }

      return (
        positive?.explanation ??
        positive?.reason ??
        positive?.text ??
        null
      );
    }

    if (typeof value === 'object') {
      return (
        value.explanation ??
        value.reason ??
        value.text ??
        null
      );
    }

    return null;
  };

  if (reasons.length < 2) {
    const skinReason = extractPositiveText(skinCompatibility);

    if (skinReason) {
      reasons.push(skinReason);
    }
  }

  if (reasons.length < 2) {
    const concernReason =
      extractPositiveText(concernCompatibility);

    if (concernReason) {
      reasons.push(concernReason);
    }
  }

  if (reasons.length < 2) {
    const sensitivityReason =
      extractPositiveText(sensitivitySuitability);

    if (sensitivityReason) {
      reasons.push(sensitivityReason);
    }
  }

  return [...new Set(reasons.filter(Boolean))].slice(0, 2);
}

/**
 * Shortens marketplace names for the compact overlay.
 */
function formatMarketplaceName(name) {
  if (!name) return '';

  const value = String(name).trim();

  const normalized = value.toLowerCase();

  if (normalized.includes('amazon')) return 'Amazon';
  if (normalized.includes('flipkart')) return 'Flipkart';
  if (normalized.includes('nykaa')) return 'Nykaa';
  if (normalized.includes('myntra')) return 'Myntra';
  if (normalized.includes('firstcry')) return 'FirstCry';
  if (normalized.includes('tira')) return 'Tira';
  if (normalized.includes('purplle')) return 'Purplle';

  return value;
}

export default function ProductCard({
  product,
  index = 0,
  isRecommended = false,
  offersLoading = false,
}) {
  const navigate = useNavigate();

  const [showWhy, setShowWhy] = useState(false);
  const [showAllPrices, setShowAllPrices] = useState(false);

  if (!product) return null;

  const {
    _id,
    name,
    brand,
    category,
    images,
  } = product;

  const brandName =
    brand?.name ??
    brand ??
    '';

  const categoryName =
    category?.name ??
    category ??
    '';

  const rating = getProductRating(product);

  const marketplacePrices =
    getRetailerOffers(product);

  const recommendationReasons =
    getRecommendationReasons(product);

  /*
   * Recommendation metadata is produced by the backend
   * matching engine.
   *
   * The frontend only displays it.
   *
   * It does NOT calculate rank or compatibility.
   */
  const recommendation =
    product?.recommendation ?? null;

  const categoryRank =
    recommendation?.categoryRank ?? null;

  const recommendationCategory =
    recommendation?.recommendationCategory ?? null;

  const compatibilityScoreRaw =
    recommendation?.compatibilityScore ?? null;

  const compatibilityScore =
    Number.isFinite(Number(compatibilityScoreRaw))
      ? Number(compatibilityScoreRaw)
      : null;

  /*
   * Prices now render below the product name (not as an image
   * overlay). Show the 2 cheapest by default; anything beyond that
   * lives behind a "+N more" dropdown so the card doesn't grow
   * unbounded when a product has many retailer offers.
   */
  const primaryPrices = marketplacePrices.slice(0, 2);
  const extraPrices = marketplacePrices.slice(2);

  const handleOpen = () => {
    if (!_id) return;

    navigate(`/products/${_id}`);
  };

  const handleKeyDown = (event) => {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      handleOpen();
    }
  };

  const handleWhyClick = (event) => {
    event.stopPropagation();

    if (recommendationReasons.length > 0) {
      setShowWhy((current) => !current);
    }
  };

  const handleTogglePrices = (event) => {
    event.stopPropagation();

    if (extraPrices.length > 0) {
      setShowAllPrices((current) => !current);
    }
  };

  /**
   * Renders one retailer price row. Shared between the always-visible
   * rows and the ones revealed by the "+N more" dropdown, so both
   * look identical and stay in sync.
   */
  const renderPriceRow = (marketplace, isCheapest) => {
    const rowContent = (
      <>
        <span
          className={`
            min-w-0
            flex-1
            truncate
            text-[10px]
            ${
              isCheapest
                ? 'font-semibold text-[#171312]'
                : 'font-medium text-black/55'
            }
          `}
        >
          {formatMarketplaceName(marketplace.name)}
        </span>

        <span
          className={`
            shrink-0
            text-[10px]
            ${
              isCheapest
                ? 'font-bold text-[#171312]'
                : 'font-medium text-black/65'
            }
          `}
        >
          {formatINR(marketplace.price)}
        </span>

        {isCheapest && (
          <span
            className="
              shrink-0
              rounded-full
              bg-[#171312]
              px-1.5
              py-0.5
              text-[6px]
              font-bold
              uppercase
              tracking-wide
              text-white
            "
          >
            Best
          </span>
        )}
      </>
    );

    const rowClassName = `
      flex
      items-center
      gap-2
      rounded-md
      px-1
      py-0.5
      transition-colors
      hover:bg-black/[0.04]
    `;

    if (marketplace.url) {
      return (
        <a
          key={`${marketplace.name}-${marketplace.price}`}
          href={marketplace.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            event.stopPropagation();
          }}
          className={rowClassName}
          aria-label={`${marketplace.name} ${formatINR(marketplace.price)}`}
        >
          {rowContent}
        </a>
      );
    }

    return (
      <div
        key={`${marketplace.name}-${marketplace.price}`}
        className={rowClassName}
      >
        {rowContent}
      </div>
    );
  };

  return (
    <motion.article
      role="button"
      tabIndex={0}
      aria-label={`View ${name}`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      initial={{
        opacity: 0,
        y: 18,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.05, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -4,
      }}
      className="
        group
        cursor-pointer
        overflow-hidden
        rounded-2xl
        border
        border-black/[0.07]
        bg-white
        shadow-[0_4px_20px_rgba(0,0,0,0.04)]
        transition-shadow
        duration-300
        hover:shadow-[0_12px_35px_rgba(0,0,0,0.10)]
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-pink-400
        focus-visible:ring-offset-2
      "
    >
      {/* =========================================================
          PRODUCT IMAGE
          ========================================================= */}
      <div className="
        relative
        aspect-[4/5]
        overflow-hidden
        bg-[#f7f5f3]
      ">
        <motion.div
          className="h-full w-full"
          whileHover={{
            scale: 1.025,
          }}
          transition={{
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ProductImage
            images={images}
            alt={name}
            className="
              h-full
              w-full
              object-contain
              transition-transform
              duration-500
            "
          />
        </motion.div>

        {/* =======================================================
            RECOMMENDATION MATCH BADGE — TOP LEFT

            Rank comes directly from the backend.
            No frontend ranking calculation.
            ======================================================= */}
        {isRecommended && categoryRank != null && (
          <motion.div
            initial={{
              opacity: 0,
              x: -8,
              scale: 0.95,
            }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            transition={{
              duration: 0.3,
              delay: 0.08,
            }}
            className="
              absolute
              left-3
              top-3
              z-20
              max-w-[150px]
              rounded-xl
              bg-[#ff3d77]
              px-3
              py-2
              text-[#171312]
              shadow-[0_4px_14px_rgba(255,61,119,0.45)]
            "
            title={
              recommendationCategory
                ? `Ranked #${categoryRank} match in ${recommendationCategory}`
                : `Ranked #${categoryRank} match`
            }
          >
            <div className="
              flex
              items-center
              gap-1.5
            ">
              <span className="
                text-[13px]
                leading-none
                text-[#171312]
              ">
                ✦
              </span>

              <span className="
                text-[11px]
                font-extrabold
                uppercase
                leading-none
                tracking-tight
                text-[#171312]
              ">
                #{categoryRank} Match
              </span>
            </div>

            {compatibilityScore != null && (
              <div className="
                mt-1
                text-[8px]
                font-bold
                text-[#171312]/70
              ">
                {Math.round(compatibilityScore)}% compatibility
              </div>
            )}
          </motion.div>
        )}

        {/* =======================================================
            RATING — BOTTOM CORNER OF IMAGE
            ======================================================= */}
        {rating != null && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.85,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.25,
              delay: 0.15,
            }}
            className="
              absolute
              bottom-3
              right-3
              z-20
              flex
              items-center
              gap-1
              rounded-full
              bg-white/95
              px-2.5
              py-1.5
              text-[11px]
              font-bold
              text-[#171312]
              shadow-[0_3px_12px_rgba(0,0,0,0.14)]
              backdrop-blur-md
            "
            title={`Rated ${rating} out of 5`}
          >
            <span className="text-[#ff3d77]">
              ★
            </span>

            <span>
              {rating.toFixed(1)}
            </span>
          </motion.div>
        )}
      </div>

      {/* =========================================================
          PRODUCT INFORMATION
          ========================================================= */}
      <div className="px-4 pb-4 pt-3.5">

        {/* BRAND */}
        {brandName && (
          <div className="
            mb-1
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.13em]
            text-black/40
          ">
            {brandName}
          </div>
        )}

        {/* PRODUCT NAME */}
        <h3 className="
          line-clamp-2
          text-[15px]
          font-semibold
          leading-[1.35]
          text-[#171312]
        ">
          {name}
        </h3>

        {/* CATEGORY */}
        {categoryName && (
          <div className="
            mt-1
            text-[9px]
            font-medium
            text-black/35
          ">
            {categoryName}
          </div>
        )}

        {/* =======================================================
            RETAILER PRICES — BELOW NAME

            2 cheapest shown by default; anything beyond that sits
            behind a "+N more" dropdown. Cheapest is marked Best.
            Never fabricates a price - if offers haven't loaded yet,
            show an unobtrusive loading note instead.
            ======================================================= */}
        {marketplacePrices.length === 0 && offersLoading && (
          <div className="
            mt-2
            text-[9px]
            font-medium
            text-black/35
          ">
            Loading prices…
          </div>
        )}

        {marketplacePrices.length > 0 && (
          <div className="mt-2">
            <div className="space-y-0.5">
              {primaryPrices.map((marketplace, priceIndex) =>
                renderPriceRow(marketplace, priceIndex === 0)
              )}
            </div>

            {extraPrices.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleTogglePrices}
                  aria-expanded={showAllPrices}
                  className="
                    mt-0.5
                    flex
                    items-center
                    gap-1
                    px-1
                    py-0.5
                    text-[9px]
                    font-semibold
                    text-black/40
                    transition-colors
                    hover:text-black/60
                  "
                >
                  <span>
                    {showAllPrices
                      ? 'Show less'
                      : `+${extraPrices.length} more price${
                          extraPrices.length > 1 ? 's' : ''
                        }`}
                  </span>

                  <motion.span
                    animate={{
                      rotate: showAllPrices ? 180 : 0,
                    }}
                    transition={{
                      duration: 0.2,
                    }}
                    className="text-[8px]"
                  >
                    ▾
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {showAllPrices && (
                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0,
                      }}
                      animate={{
                        height: 'auto',
                        opacity: 1,
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                      }}
                      transition={{
                        duration: 0.2,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5">
                        {extraPrices.map((marketplace) =>
                          renderPriceRow(marketplace, false)
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        )}

        {/* =======================================================
            WHY THIS PRODUCT
            ======================================================= */}
        {recommendationReasons.length > 0 && (
          <div className="mt-3">

            <button
              type="button"
              onClick={handleWhyClick}
              aria-expanded={showWhy}
              className="
                flex
                w-full
                items-center
                justify-between
                rounded-xl
                border
                border-[#ff3d77]/10
                bg-[#ff3d77]/[0.045]
                px-3
                py-2.5
                text-left
                transition-all
                duration-200
                hover:border-[#ff3d77]/20
                hover:bg-[#ff3d77]/[0.075]
              "
            >
              <span className="
                flex
                items-center
                gap-1.5
                text-[10px]
                font-semibold
                text-[#171312]
              ">
                <span className="
                  text-[12px]
                  text-[#ff3d77]
                ">
                  ✦
                </span>

                <span>
                  Why this product
                </span>
              </span>

              <motion.span
                animate={{
                  rotate: showWhy ? 90 : 0,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="
                  text-[12px]
                  text-black/45
                "
              >
                →
              </motion.span>
            </button>

            {/* ===================================================
                EXPANDED REASON
                =================================================== */}
            <AnimatePresence initial={false}>
              {showWhy && (
                <motion.div
                  initial={{
                    height: 0,
                    opacity: 0,
                  }}
                  animate={{
                    height: 'auto',
                    opacity: 1,
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="overflow-hidden"
                >
                  <div className="
                    px-3
                    pb-1
                    pt-2.5
                  ">
                    <div className="space-y-1.5">
                      {recommendationReasons.map(
                        (reason, reasonIndex) => (
                          <div
                            key={`${reason}-${reasonIndex}`}
                            className="
                              flex
                              items-start
                              gap-2
                              text-[9px]
                              leading-[1.5]
                              text-black/60
                            "
                          >
                            <span className="
                              mt-[2px]
                              shrink-0
                              text-[#ff3d77]
                            ">
                              •
                            </span>

                            <span>
                              {reason}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.article>
  );
}