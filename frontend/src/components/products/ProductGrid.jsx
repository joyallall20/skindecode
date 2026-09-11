import ProductCard from './ProductCard.jsx';
import './ProductCard.css';

const SKELETON_COUNT = 12;

function SkeletonCard() {
  return (
    <article className="pcard pcard--skeleton" aria-hidden="true">
      <div className="pcard__image-wrap" />
      <div className="pcard__body">
        <div className="pcard__brand">Loading…</div>
        <h3 className="pcard__name">Product name</h3>
        <div className="pcard__category">Category</div>
      </div>
    </article>
  );
}

function EmptyState({ hasFilters, title, subtitle }) {
  const resolvedTitle = title || (hasFilters ? 'No products match your filters' : 'No products yet');
  const resolvedSubtitle = subtitle || (hasFilters
    ? 'Try adjusting your search or clearing the filters.'
    : 'Check back soon — new products are added regularly.');

  return (
    <div className="pgrid__empty">
      <div className="pgrid__empty-icon" aria-hidden="true">✦</div>
      <h3 className="pgrid__empty-title">{resolvedTitle}</h3>
      <p className="pgrid__empty-sub">{resolvedSubtitle}</p>
    </div>
  );
}

/**
 * ProductGrid
 *
 * Props:
 *   products       — array of product objects
 *   isLoading      — show skeleton cards
 *   hasFilters     — affects default empty-state messaging
 *   emptyTitle     — optional override for the empty-state heading
 *   emptySubtitle  — optional override for the empty-state body text
 */
export default function ProductGrid({
  products = [],
  recommendedProductIds = [],
  offersLoading = false,
  isLoading = false,
  hasFilters = false,
  emptyTitle,
  emptySubtitle,
}) {
  if (isLoading && products.length === 0) {
    return (
      <div className="pgrid">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && products.length === 0) {
    return <EmptyState hasFilters={hasFilters} title={emptyTitle} subtitle={emptySubtitle} />;
  }

  // Defensive: IDs may arrive as ObjectId instances, plain strings, or be
  // absent entirely depending on the caller. Normalize to strings so the
  // lookup below is never fooled by a type mismatch.
  const recommendedIds = new Set(
    (recommendedProductIds || []).map((id) => String(id)),
  );

  return (
    <div className="pgrid">
      {products.map((product, index) => (
        <ProductCard
          key={product._id}
          product={product}
          index={index}
          isRecommended={recommendedIds.has(String(product._id))}
          offersLoading={offersLoading}
        />
      ))}
    </div>
  );
}