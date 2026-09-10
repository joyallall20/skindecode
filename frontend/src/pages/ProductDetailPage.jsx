import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getProductById, getProductOffers } from '../api/productApi.js';
import { formatPrice, resolveImageUrls } from '../utils/productFormConstants.js';
import SkinDecodeChat from '../components/common/Skindecodechat.jsx';
import { Navigation } from '../components/Navigation/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The API may return the object directly, { data: object }, or
// { data: { data: object } }. Normalize all three shapes safely.
const unwrap = (response) => {
  const value = response?.data ?? response ?? null;
  if (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    return value.data;
  }
  return value;
};

const brandName = (brand) => brand?.name || brand || '';
const categoryName = (category) => category?.name || category || '';

const humanize = (value) =>
  typeof value === 'string' ? value.replace(/-/g, ' ') : value;

const capitalize = (value) =>
  typeof value === 'string' && value.length > 0
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;

const SKIN_TYPE_LABELS = {
  oily: 'Oily',
  dry: 'Dry',
  combination: 'Combination',
  normal: 'Normal',
  sensitive: 'Sensitive',
};

const SENSITIVITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// SkinDecode's estimated fit label from a 0-1 compatibility value. This is a
// transparent threshold applied to the product's own real compatibility
// number — never a fabricated score.
const matchLabel = (value) => {
  if (value == null) return null;
  if (value >= 0.7) return 'Great match';
  if (value >= 0.5) return 'Good match';
  if (value >= 0.35) return 'Fair match';
  return 'May not suit you';
};

const scoreOutOf10 = (value) =>
  value == null ? null : Math.round(value * 100) / 10;

// Pulls a flat list of ingredient names from whatever the API actually gives
// us: populated ingredient docs (objects with .name), or the raw
// ingredientListText string as a fallback. Never invents names.
function getIngredientNames(product) {
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    const populated = product.ingredients
      .map((entry) => (typeof entry === 'object' ? entry?.name : null))
      .filter(Boolean);
    if (populated.length > 0) return populated;
  }
  if (typeof product.ingredientListText === 'string' && product.ingredientListText.trim()) {
    return product.ingredientListText
      .split(/\n+|,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const DONUT_COLORS = ['#e47796', '#8f6e99', '#b06b83', '#d8b4c4', '#eadde2'];

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function LoadingState() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="min-h-screen bg-[#fdfaf7]">
      <Navigation />
      <main className="mx-auto flex max-w-[1200px] flex-col items-center justify-center px-5 py-32 text-center sm:px-8">
        <motion.div
          className="h-10 w-10 rounded-full border-2 border-[#eadde2] border-t-[#e47796]"
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        <motion.p
          className="mt-6 text-[15px] text-[#746b78]"
          initial={{ opacity: 0 }}
          animate={{ opacity: reduceMotion ? 1 : [0.4, 1, 0.4] }}
          transition={
            reduceMotion
              ? { duration: 0.3 }
              : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          Loading product&hellip;
        </motion.p>
      </main>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="min-h-screen bg-[#fdfaf7]">
      <Navigation />
      <motion.main
        className="mx-auto flex max-w-[1200px] flex-col items-center px-5 py-28 text-center sm:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-[13px] tracking-wide text-[#b06b83]">Product</p>
        <h1 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.75rem,5vw,2.5rem)] text-[#201b28]">
          Product not found
        </h1>
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#746b78]">
          {message || 'The product may have been removed or the link may be invalid.'}
        </p>
        <Link
          to="/products"
          className="mt-8 min-h-[48px] rounded-full bg-[#201b28] px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
        >
          Back to products
        </Link>
      </motion.main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero — brand, name, price/offers, ordinary product-page stuff
// ---------------------------------------------------------------------------

function Hero({ product, offers, hasAnalysis, onAskSkinDecode }) {
  const images = resolveImageUrls(product.images);
  const ingredients = Array.isArray(product.keyIngredients)
    ? product.keyIngredients.map((item) => item?.name || item).filter(Boolean)
    : [];

  const pricedOffers = offers.filter((offer) => offer.price != null);
  const bestPrice = pricedOffers.length
    ? Math.min(...pricedOffers.map((offer) => offer.price))
    : null;

  return (
    <section className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {images[0] ? (
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-[#eadde2] bg-white">
            <img
              src={images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-[#eadde2] bg-[#fff0f4]">
            <span className="font-['Instrument_Serif'] text-6xl text-[#e47796]">
              {product.name?.charAt(0) || 'S'}
            </span>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
        {brandName(product.brand) && (
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#e47796]">
            {brandName(product.brand)}
          </p>
        )}

        <h1 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.08] text-[#201b28]">
          {product.name}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#746b78]">
          {categoryName(product.category) && <span>{categoryName(product.category)}</span>}
          {product.variant && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>{product.variant}</span>
            </>
          )}
        </div>

        {product.qualityScore != null && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#fff0f4] px-3 py-1.5 text-[13px] font-medium text-[#b3405e]">
            <span aria-hidden="true">&#9733;</span>
            <span>{product.qualityScore.toFixed(1)}/10 SkinDecode score</span>
          </div>
        )}

        {product.description && (
          <p className="mt-5 text-[15px] leading-relaxed text-[#4a4450]">
            {product.description}
          </p>
        )}

        {ingredients.length > 0 && (
          <div className="mt-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8f6e99]">
              Key ingredients
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ingredients.slice(0, 8).map((ingredient) => (
                <span
                  key={ingredient}
                  className="rounded-full border border-[#eadde2] bg-white px-3 py-1.5 text-[13px] text-[#201b28]"
                >
                  {ingredient}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onAskSkinDecode}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-[#e47796] bg-white px-5 py-3 text-[15px] font-medium text-[#b3405e] transition-colors hover:bg-[#fff0f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2 sm:w-auto"
        >
          <span aria-hidden="true">✦</span>
          Ask skinDecode about this product
        </button>

        {/* Pricing / retailers */}
        <div id="offers" className="mt-8 scroll-mt-24 border-t border-[#eadde2] pt-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8f6e99]">
            Where to buy
          </p>

          {offers.length === 0 ? (
            <p className="mt-3 text-[15px] text-[#746b78]">
              Purchase options will appear here once affiliate links are activated.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {offers.map((offer, index) => {
                const isBest = bestPrice != null && offer.price === bestPrice;
                return (
                  <div
                    key={offer._id || `${offer.retailer?.name}-${index}`}
                    className={[
                      'flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4',
                      isBest ? 'border-[#e47796] shadow-[0_0_0_2px_#f7d4de]' : 'border-[#eadde2]',
                    ].join(' ')}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#201b28]">
                          {offer.retailer?.name || 'Retailer'}
                        </p>
                        {isBest && (
                          <span className="rounded-full bg-[#fff0f4] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#b3405e]">
                            Best price
                          </span>
                        )}
                      </div>
                      {offer.price != null && (
                        <p className="mt-1 text-[14px] text-[#746b78]">
                          {formatPrice(offer.price, offer.currency)}
                        </p>
                      )}
                    </div>

                    {offer.url && (
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] rounded-full bg-[#201b28] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
                      >
                        View deal &rarr;
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {hasAnalysis && (
          <a
            href="#skindecode-analysis"
            className="mt-8 inline-block text-[14px] font-medium text-[#201b28] underline decoration-[#eadde2] underline-offset-4 hover:decoration-[#e47796]"
          >
            See the full ingredient analysis &darr;
          </a>
        )}
      </motion.div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hook — transition from shopping to understanding
// ---------------------------------------------------------------------------

function AnalysisHook({ ingredientCount }) {
  return (
    <motion.section
      className="mt-20 rounded-3xl border border-[#eadde2] bg-white px-6 py-12 text-center sm:px-12"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="font-['Instrument_Serif'] text-[clamp(1.6rem,3.5vw,2.25rem)] leading-tight text-[#201b28]">
        What&apos;s actually inside this product?
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[#746b78]">
        {ingredientCount > 0 ? `${ingredientCount} ingredients. ` : ''}
        One detailed SkinDecode analysis.
      </p>
      <p className="mx-auto mt-2 max-w-[52ch] text-[15px] leading-relaxed text-[#746b78]">
        Before you buy, see what each ingredient does, how the formula is balanced, and how
        well it may suit your skin.
      </p>
      <a
        href="#skindecode-analysis"
        className="mt-6 inline-block text-[14px] font-medium text-[#e47796] underline decoration-[#f7d4de] underline-offset-4 hover:decoration-[#e47796]"
      >
        &darr; Explore the ingredient analysis
      </a>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Shared section shell
// ---------------------------------------------------------------------------

function AnalysisSection({ eyebrow, title, children, className = '' }) {
  return (
    <motion.section
      className={`mt-16 border-t border-[#eadde2] pt-10 ${className}`}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45 }}
    >
      {eyebrow && (
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8f6e99]">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="mt-3 font-['Instrument_Serif'] text-2xl text-[#201b28] sm:text-[1.75rem]">
          {title}
        </h2>
      )}
      <div className={title || eyebrow ? 'mt-6' : ''}>{children}</div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Formula character — real descriptive fields, no fabricated category scores
// ---------------------------------------------------------------------------

function FormulaCharacter({ intelligence }) {
  const { hydrationProfile, oilControlProfile, qualityAssessment } = intelligence;
  const signals = Array.isArray(qualityAssessment?.formulationSignals)
    ? qualityAssessment.formulationSignals
    : [];

  if (!hydrationProfile && !oilControlProfile && signals.length === 0) return null;

  return (
    <AnalysisSection eyebrow="Formula at a glance" title="What this formula is built to do">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {hydrationProfile && (
          <div className="rounded-2xl border border-[#eadde2] bg-white p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#b06b83]">
              Hydration
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4a4450]">
              {hydrationProfile}
            </p>
          </div>
        )}
        {oilControlProfile && (
          <div className="rounded-2xl border border-[#eadde2] bg-white p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#b06b83]">
              Oil control
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#4a4450]">
              {oilControlProfile}
            </p>
          </div>
        )}
      </div>

      {signals.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[#eadde2] bg-white p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#b06b83]">
            Formulation signals
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {signals.map((signal, index) => (
              <li key={index} className="flex gap-2 text-[14px] leading-relaxed text-[#4a4450]">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#e47796]" />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Ingredient evidence donut — buckets real ingredientAnalysis by evidenceLevel
// ---------------------------------------------------------------------------

function IngredientEvidenceDonut({ ingredientAnalysis }) {
  const data = useMemo(() => {
    const counts = new Map();
    ingredientAnalysis.forEach((entry) => {
      const level = entry?.evidenceLevel ? capitalize(entry.evidenceLevel) : 'Unspecified';
      counts.set(level, (counts.get(level) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [ingredientAnalysis]);

  if (data.length === 0) return null;

  return (
    <AnalysisSection
      eyebrow="Ingredient assessment"
      title="Evidence level across analyzed ingredients"
    >
      <p className="mb-4 max-w-[60ch] text-[14px] text-[#746b78]">
        This reflects how strong the research evidence is behind each analyzed ingredient —
        it&apos;s SkinDecode&apos;s read of the evidence, not an official scientific or
        regulatory rating.
      </p>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="h-[220px] w-full max-w-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-2 text-[14px] text-[#201b28]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span>
                {entry.name} &middot; {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Ingredients analyzed in depth — real per-ingredient explanations, expandable
// ---------------------------------------------------------------------------

function AnalyzedIngredients({ ingredientAnalysis }) {
  const [expandedId, setExpandedId] = useState(null);

  if (ingredientAnalysis.length === 0) return null;

  return (
    <AnalysisSection eyebrow="Ingredients that matter most" title="Ingredients we've analyzed in depth">
      <div className="flex flex-col gap-3">
        {ingredientAnalysis.map((entry, index) => {
          const key = entry._id || entry.ingredient || index;
          const isOpen = expandedId === key;
          const benefits = Array.isArray(entry.benefits) ? entry.benefits : [];
          const concerns = Array.isArray(entry.relevantConcerns) ? entry.relevantConcerns : [];

          return (
            <div key={key} className="rounded-2xl border border-[#eadde2] bg-white p-5">
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <span className="font-['Instrument_Serif'] text-lg text-[#201b28]">
                  {entry.ingredient}
                </span>
                <span className="text-[#b06b83]" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>

              {benefits.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {benefits.map((benefit) => (
                    <span
                      key={benefit}
                      className="rounded-full bg-[#fff0f4] px-3 py-1 text-[12px] font-medium text-[#b3405e]"
                    >
                      {benefit}
                    </span>
                  ))}
                </div>
              )}

              {isOpen && (
                <div className="mt-4 flex flex-col gap-3 border-t border-[#eadde2] pt-4">
                  {entry.explanation && (
                    <p className="text-[14px] leading-relaxed text-[#4a4450]">
                      {entry.explanation}
                    </p>
                  )}
                  {concerns.length > 0 && (
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8f6e99]">
                        Relevant concerns
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {concerns.map((concern) => (
                          <span
                            key={concern}
                            className="rounded-full border border-[#eadde2] px-3 py-1 text-[12px] text-[#201b28]"
                          >
                            {concern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.potentialSensitivityConcern && (
                    <p className="text-[13px] text-[#746b78]">
                      <span className="font-medium text-[#201b28]">Sensitivity: </span>
                      {entry.potentialSensitivityConcern}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Complete ingredient list — search over real parsed names
// ---------------------------------------------------------------------------

function CompleteIngredientList({ names, ingredientAnalysis }) {
  const [query, setQuery] = useState('');
  const [expandedName, setExpandedName] = useState(null);

  const analysisByName = useMemo(() => {
    const map = new Map();
    ingredientAnalysis.forEach((entry) => {
      if (entry?.ingredient) map.set(entry.ingredient.toLowerCase(), entry);
    });
    return map;
  }, [ingredientAnalysis]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return names;
    return names.filter((name) => name.toLowerCase().includes(q));
  }, [names, query]);

  if (names.length === 0) return null;

  return (
    <AnalysisSection
      eyebrow={`${names.length} ingredients`}
      title="Complete ingredient breakdown"
    >
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search an ingredient..."
        aria-label="Search ingredients"
        className="w-full max-w-[360px] rounded-2xl border border-[#eadde2] bg-white px-4 py-3 text-[14px] text-[#201b28] outline-none transition-colors focus-visible:border-[#e47796] focus-visible:ring-2 focus-visible:ring-[#f7d4de]"
      />

      {filtered.length === 0 ? (
        <p className="mt-4 text-[14px] text-[#746b78]">No ingredients match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="mt-4 flex flex-col divide-y divide-[#eadde2] rounded-2xl border border-[#eadde2] bg-white">
          {filtered.map((name) => {
            const match = analysisByName.get(name.toLowerCase());
            const isOpen = expandedName === name;
            return (
              <div key={name} className="px-5 py-3">
                {match ? (
                  <button
                    type="button"
                    onClick={() => setExpandedName(isOpen ? null : name)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 text-left text-[14px] text-[#201b28]"
                  >
                    <span>{name}</span>
                    <span className="text-[12px] text-[#b06b83]">
                      {isOpen ? 'Hide details −' : 'Details +'}
                    </span>
                  </button>
                ) : (
                  <span className="text-[14px] text-[#4a4450]">{name}</span>
                )}

                {match && isOpen && (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#746b78]">
                    {match.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Personalized skin compatibility — real skinTypeCompatibility data, matched
// against the person's own stored onboarding profile when available
// ---------------------------------------------------------------------------

function SkinCompatibility({ skinTypeCompatibility, sensitivitySuitability }) {
  const [storedProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('skinly-anonymous-analysis');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.profile || parsed || null;
    } catch {
      return null;
    }
  });

  const chartData = useMemo(
    () =>
      Object.entries(skinTypeCompatibility).map(([key, value]) => ({
        type: SKIN_TYPE_LABELS[key] || capitalize(key),
        score: scoreOutOf10(value) ?? 0,
      })),
    [skinTypeCompatibility],
  );

  if (chartData.length === 0) return null;

  const userSkinType = storedProfile?.skinType;
  const userSensitivity = storedProfile?.sensitivity;
  const skinValue = userSkinType ? skinTypeCompatibility[userSkinType] : null;
  const sensitivityValue =
    userSensitivity && sensitivitySuitability ? sensitivitySuitability[userSensitivity] : null;

  const matchValues = [skinValue, sensitivityValue].filter((v) => v != null);
  const overallMatch =
    matchValues.length > 0
      ? matchValues.reduce((sum, v) => sum + v, 0) / matchValues.length
      : null;

  return (
    <AnalysisSection eyebrow="Personalized" title="What this formula means for your skin">
      {userSkinType ? (
        <div className="mb-6 rounded-2xl border border-[#eadde2] bg-white p-5">
          <p className="text-[13px] text-[#746b78]">
            Your profile: {humanize(capitalize(userSkinType))} skin
            {userSensitivity ? ` · ${humanize(capitalize(userSensitivity))} sensitivity` : ''}
          </p>
          {overallMatch != null && (
            <p className="mt-2 font-['Instrument_Serif'] text-2xl text-[#201b28]">
              {scoreOutOf10(overallMatch).toFixed(1)}/10 &middot; {matchLabel(overallMatch)}
            </p>
          )}
          <p className="mt-1 text-[12px] text-[#8f6e99]">
            SkinDecode&apos;s estimate, based on your skin quiz answers — not a substitute for
            professional advice.
          </p>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-[#eadde2] bg-[#fff0f4] p-5">
          <p className="text-[14px] text-[#201b28]">
            Take the skin quiz to see how well this formula fits your own skin.
          </p>
          <Link
            to="/onboarding"
            className="mt-3 inline-block text-[13px] font-medium text-[#b3405e] underline decoration-[#f7d4de] underline-offset-4 hover:decoration-[#b3405e]"
          >
            Take the skin quiz &rarr;
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-[#eadde2] bg-white p-5">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#8f6e99]">
          Skin type compatibility
        </p>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="75%">
              <PolarGrid stroke="#eadde2" />
              <PolarAngleAxis dataKey="type" tick={{ fill: '#746b78', fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <Radar dataKey="score" stroke="#e47796" fill="#e47796" fillOpacity={0.35} />
              <Tooltip formatter={(value) => `${value}/10`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {chartData.map((row) => (
            <span key={row.type} className="text-[13px] text-[#746b78]">
              {row.type}: <span className="font-medium text-[#201b28]">{row.score.toFixed(1)}/10</span>
            </span>
          ))}
        </div>
      </div>
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Before you buy — real booleans, conflicts, and limitations
// ---------------------------------------------------------------------------

function BeforeYouBuy({ product, intelligence }) {
  const positives = [];
  const warnings = [];

  if (product.alcoholFree) positives.push('Alcohol free');
  if (product.essentialOilFree) positives.push('Essential oil free');
  if (product.fragranceFree) positives.push('Fragrance free');
  else if (product.fragranceFree === false) warnings.push('Contains fragrance');

  const conflicts = Array.isArray(intelligence.ingredientConflicts)
    ? intelligence.ingredientConflicts
    : [];
  const limitations = Array.isArray(intelligence.qualityAssessment?.limitations)
    ? intelligence.qualityAssessment.limitations
    : [];

  warnings.push(...conflicts, ...limitations);

  if (positives.length === 0 && warnings.length === 0) return null;

  return (
    <AnalysisSection eyebrow="Good to know" title="Before you buy">
      <div className="flex flex-col gap-3">
        {warnings.map((warning, index) => (
          <div
            key={`warning-${index}`}
            className="flex gap-3 rounded-2xl border border-[#f0d3a8] bg-[#fdf6e8] p-4 text-[14px] leading-relaxed text-[#6b5a2f]"
          >
            <span aria-hidden="true">&#9888;</span>
            <span>{warning}</span>
          </div>
        ))}
        {positives.map((positive) => (
          <div
            key={positive}
            className="flex gap-3 rounded-2xl border border-[#c7e0cf] bg-[#f2f8f4] p-4 text-[14px] leading-relaxed text-[#2f5f43]"
          >
            <span aria-hidden="true">&#10003;</span>
            <span>{positive}</span>
          </div>
        ))}
      </div>
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

function Verdict({ product, intelligence }) {
  const { qualityScore } = product;
  const compatibility = intelligence.skinTypeCompatibility || {};
  const bestFor = Object.entries(compatibility)
    .filter(([, value]) => value >= 0.6)
    .map(([key]) => SKIN_TYPE_LABELS[key] || capitalize(key));
  const useCaution = Object.entries(compatibility)
    .filter(([, value]) => value < 0.45)
    .map(([key]) => SKIN_TYPE_LABELS[key] || capitalize(key));

  if (qualityScore == null && bestFor.length === 0 && useCaution.length === 0) return null;

  return (
    <AnalysisSection eyebrow="SkinDecode verdict" className="pb-4">
      <div className="rounded-3xl border border-[#eadde2] bg-white p-8 text-center">
        {qualityScore != null && (
          <p className="font-['Instrument_Serif'] text-5xl text-[#201b28]">
            {qualityScore.toFixed(1)}
            <span className="text-2xl text-[#746b78]">/10</span>
          </p>
        )}
        {intelligence.explanation && (
          <p className="mx-auto mt-4 max-w-[60ch] text-[15px] leading-relaxed text-[#4a4450]">
            {intelligence.explanation}
          </p>
        )}

        <div className="mx-auto mt-6 flex max-w-[520px] flex-col gap-4 text-left sm:flex-row sm:justify-center sm:text-center">
          {bestFor.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#2f5f43]">
                Best for
              </p>
              <p className="mt-1 text-[14px] text-[#201b28]">{bestFor.join(', ')}</p>
            </div>
          )}
          {useCaution.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#b06b83]">
                Use caution
              </p>
              <p className="mt-1 text-[14px] text-[#201b28]">{useCaution.join(', ')}</p>
            </div>
          )}
        </div>

        {intelligence.qualityAssessment?.ratingBasis && (
          <p className="mx-auto mt-6 max-w-[60ch] text-[12px] text-[#8f6e99]">
            {intelligence.qualityAssessment.ratingBasis}
          </p>
        )}

        <a
          href="#offers"
          className="mt-8 inline-block min-h-[48px] rounded-full bg-[#201b28] px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
        >
          Compare prices &rarr;
        </a>
      </div>
    </AnalysisSection>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError('Product not found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const productResponse = await getProductById(id);
        const productData = unwrap(productResponse);

        if (cancelled) return;

        if (!productData || !productData._id) {
          setError('Product not found.');
          setProduct(null);
          setLoading(false);
          return;
        }

        setProduct(productData);

        // Offers are optional. A failed offers request must not prevent
        // the product detail page from rendering.
        try {
          const offersResponse = await getProductOffers(id);
          const offersData = unwrap(offersResponse);
          if (!cancelled) {
            setOffers(Array.isArray(offersData) ? offersData : []);
          }
        } catch {
          if (!cancelled) setOffers([]);
        }
      } catch (err) {
        if (!cancelled) {
          setProduct(null);
          setError(err?.message || 'Unable to load this product.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !product) return <ErrorState message={error} />;

  const intelligence = product.productIntelligence || {};
  const ingredientAnalysis = Array.isArray(intelligence.ingredientAnalysis)
    ? intelligence.ingredientAnalysis
    : [];
  const ingredientNames = getIngredientNames(product);
  const skinTypeCompatibility = intelligence.skinTypeCompatibility || null;
  const hasAnalysis =
    Boolean(intelligence.explanation) ||
    ingredientAnalysis.length > 0 ||
    Boolean(skinTypeCompatibility) ||
    ingredientNames.length > 0;

  return (
    <div className="min-h-screen bg-[#fdfaf7] text-[#201b28]">
      <Navigation />

      <motion.main
        className="mx-auto max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 sm:pt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          to="/products"
          className="inline-block text-[14px] font-medium text-[#746b78] transition-colors hover:text-[#201b28]"
        >
          &larr; Back to products
        </Link>

        <div className="mt-6">
          <Hero
            product={product}
            offers={offers}
            hasAnalysis={hasAnalysis}
            onAskSkinDecode={() => setIsChatOpen(true)}
          />
        </div>

        {hasAnalysis && (
          <>
            <AnalysisHook ingredientCount={ingredientNames.length} />

            <div id="skindecode-analysis" className="scroll-mt-20">
              {intelligence.explanation && (
                <AnalysisSection eyebrow="SkinDecode analysis">
                  <p className="max-w-[70ch] text-[16px] leading-relaxed text-[#4a4450]">
                    {intelligence.explanation}
                  </p>
                  {intelligence.evidenceConfidence != null && (
                    <p className="mt-3 text-[13px] text-[#8f6e99]">
                      {Math.round(intelligence.evidenceConfidence * 100)}% evidence confidence
                    </p>
                  )}
                </AnalysisSection>
              )}

              <FormulaCharacter intelligence={intelligence} />

              <IngredientEvidenceDonut ingredientAnalysis={ingredientAnalysis} />

              <AnalyzedIngredients ingredientAnalysis={ingredientAnalysis} />

              <CompleteIngredientList
                names={ingredientNames}
                ingredientAnalysis={ingredientAnalysis}
              />

              {skinTypeCompatibility && (
                <SkinCompatibility
                  skinTypeCompatibility={skinTypeCompatibility}
                  sensitivitySuitability={intelligence.sensitivitySuitability}
                />
              )}

              <BeforeYouBuy product={product} intelligence={intelligence} />

              <Verdict product={product} intelligence={intelligence} />
            </div>
          </>
        )}
      </motion.main>

      <SkinDecodeChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        productId={product._id}
        productName={product.name}
      />
    </div>
  );
}