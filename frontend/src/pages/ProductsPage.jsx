import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import apiClient from '../api/axios.js';
import { API_PATHS } from '../utils/constants.js';
import ProductGrid from '../components/products/ProductGrid.jsx';
import { getMarketplacePrices, getProductRating } from '../components/products/ProductCard.jsx';
import { getLatestRecommendations } from '../api/recommendationApi.js';
import './ProductsPage.css';
import { Navigation } from '../components/Navigation/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { readPendingSkinProfile } from '../utils/pendingSkinProfile.js';

// Number of recommended products revealed per screen / "Load more" click.
const PAGE_SIZE = 24;
const DEFAULT_FILTERS = { search: '', category: '', brand: '', minPrice: '', maxPrice: '' };
const ONBOARDING_MODAL_KEY = 'skinly-show-onboarding-modal';
const DEBOUNCE_MS = 300;
const ANONYMOUS_PROFILE_KEY = 'skinly-anonymous-analysis';
const PROFILE_EXPIRY_DAYS = 30;

const CATEGORY_DISPLAY = [
  { key: 'all', label: 'All', slug: '' },
  { key: 'cleansers', label: 'Cleansers', slug: 'cleanser', fallbackSlugs: ['cleansers', 'cleanser'] },
  { key: 'moisturizers', label: 'Moisturizers', slug: 'moisturizer', fallbackSlugs: ['moisturizers', 'moisturizer'] },
  { key: 'sunscreens', label: 'Sunscreens', slug: 'sunscreen', fallbackSlugs: ['sunscreens', 'sunscreen', 'sun-screen', 'sun screen'] },
  { key: 'serums', label: 'Serums', slug: 'serum', fallbackSlugs: ['serums', 'serum'] },
  { key: 'exfoliants', label: 'Exfoliants', slug: 'exfoliant', fallbackSlugs: ['exfoliants', 'exfoliant', 'face-scrub', 'scrub', 'face scrub'] },
  { key: 'toners-essences', label: 'Toners & Essences', slug: 'toner', fallbackSlugs: ['toners', 'toner', 'toners-essences', 'toners & essences'] },
  { key: 'retinoids-anti-aging', label: 'Retinoids & Anti-Aging', slug: 'treatment', fallbackSlugs: ['retinoids', 'retinoid', 'anti-aging', 'anti aging', 'treatment'] },
  { key: 'eye-creams-serums', label: 'Eye Creams & Serums', slug: 'eye-care', fallbackSlugs: ['eye-care', 'eye care', 'eye-creams', 'eye creams', 'eye-serums', 'eye serums'] },
  { key: 'face-masks', label: 'Face Masks', slug: 'mask', fallbackSlugs: ['masks', 'mask', 'face-masks', 'face masks'] },
  { key: 'facial-oils', label: 'Facial Oils', slug: 'facial-oil', fallbackSlugs: ['facial-oils', 'facial oils', 'face-oil', 'face oil', 'oil'] },
];

const CATEGORY_METADATA = {
  'cleansers': 'Removes dirt, oil, makeup, and dead skin cells without stripping the moisture barrier.',
  'moisturizers': 'Hydrates the skin and seals in moisture using humectants, emollients, and occlusives.',
  'sunscreens': 'Protects against UV radiation to prevent premature aging, hyperpigmentation, and skin damage.',
  'serums': 'Highly concentrated liquids delivering targeted active ingredients deep into the skin.',
  'exfoliants': 'Sheds dead skin cells to improve texture, unclog pores, and boost cell turnover.',
  'toners-essences': 'Balances skin pH, provides initial hydration, and prepares skin for subsequent products.',
  'retinoids-anti-aging': 'Vitamin A derivatives that accelerate cellular turnover and smooth fine lines.',
  'eye-creams-serums': 'Formulated for the delicate eye area to address dark circles, puffiness, and fine lines.',
  'face-masks': 'Intensive, short-term treatments for hydration, detoxifying, or soothing.',
  'facial-oils': 'Rich in fatty acids to nourish dry skin and repair the lipid barrier.',
};

function formatGoal(goal) {
  if (!goal) return '';
  return goal
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSkinType(type) {
  if (!type) return '';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const PROFILE_FIELDS = [
  'skinType',
  'sensitivity',
  'concerns',
  'primaryGoal',
  'avoidancePreferences',
  'responseToNewProducts',
  'morningSkinFeel',
];

function isProfile(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    PROFILE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(value, field)),
  );
}

// Normalize analysis state from router
function normalizeAnalysisState(state) {
  if (!state) return null;

  // Case 1: state.analysis exists
  if (state.analysis && typeof state.analysis === 'object' && !Array.isArray(state.analysis)) {
    return {
      profile: state.analysis.profile ?? state.profile ?? null,
      recommendations: Array.isArray(state.analysis.recommendations) 
        ? state.analysis.recommendations 
        : [],
      anonymous: Boolean(state.analysis.anonymous ?? state.anonymous),
      createdAt: state.analysis.createdAt ?? new Date().toISOString(),
    };
  }

  // Case 2: state has recommendations and/or profile directly
  if (Array.isArray(state.recommendations) || state.profile) {
    return {
      profile: state.profile ?? null,
      recommendations: Array.isArray(state.recommendations) ? state.recommendations : [],
      anonymous: Boolean(state.anonymous),
      createdAt: new Date().toISOString(),
    };
  }

  // Case 3: state is already normalized
  if (typeof state === 'object' && !Array.isArray(state)) {
    return {
      profile: state.profile ?? null,
      recommendations: Array.isArray(state.recommendations) ? state.recommendations : [],
      anonymous: Boolean(state.anonymous),
      createdAt: state.createdAt ?? new Date().toISOString(),
    };
  }

  return null;
}

// Shared source for both the skin profile and the recommendations
function resolveStoredAnalysis(routerAnalysis) {
  if (routerAnalysis && typeof routerAnalysis === 'object' && !Array.isArray(routerAnalysis)) {
    return routerAnalysis;
  }
  
  try {
    const raw = localStorage.getItem(ANONYMOUS_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.createdAt) {
      const timestamped = { ...parsed, createdAt: new Date().toISOString() };
      localStorage.setItem(ANONYMOUS_PROFILE_KEY, JSON.stringify(timestamped));
      return timestamped;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isAnalysisExpired(src) {
  if (!src?.createdAt) return false;
  const createdTime = new Date(src.createdAt).getTime();
  if (isNaN(createdTime)) return false;
  const expiryTime = createdTime + PROFILE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > expiryTime;
}

function readSkinProfile(routerAnalysis) {
  const src = resolveStoredAnalysis(routerAnalysis);
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null;

  const profile = isProfile(src?.profile)
    ? src.profile
    : isProfile(src?.data?.profile)
      ? src.data.profile
      : isProfile(src?.data)
        ? src.data
        : isProfile(src)
          ? src
          : null;
  
  if (!profile) return null;

  if (isAnalysisExpired(src)) {
    try {
      localStorage.removeItem(ANONYMOUS_PROFILE_KEY);
    } catch {
      // ignore
    }
    return null;
  }

  return profile;
}

function readRecommendations(routerAnalysis) {
  const src = resolveStoredAnalysis(routerAnalysis);
  if (!src || typeof src !== 'object' || Array.isArray(src) || isAnalysisExpired(src)) return [];

  const recommendations = Array.isArray(src.recommendations)
    ? src.recommendations
    : Array.isArray(src.data?.recommendations)
      ? src.data.recommendations
      : [];

  return recommendations;
}

function SkinProfileSection({ profile, isAuthenticated }) {
  if (!profile) {
    return (
      <section className="border-b border-[#eadde2] bg-[#fdfaf7] px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-[1200px] rounded-3xl border border-[#eadde2] bg-white p-6 sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b06b83]">
            Your skin profile
          </p>
          <h2 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.5rem,3vw,2rem)] text-[#201b28]">
            Create your skin profile
          </h2>
          <p className="mt-2 max-w-[52ch] text-[15px] text-[#746b78]">
            Answer a few questions so we can personalize your skincare discovery.
          </p>
          <div className="mt-6">
            <Link
              to="/onboarding"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#201b28] px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
            >
              Create skin profile &rarr;
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const skinType = formatSkinType(profile.skinType);
  const goal = formatGoal(profile.primaryGoal);
  const sensitivity = profile.sensitivity ? formatSkinType(profile.sensitivity) : null;
  const concerns = Array.isArray(profile.concerns)
    ? profile.concerns.map(formatGoal).filter(Boolean)
    : [];
  const avoidancePreferences = Array.isArray(profile.avoidancePreferences)
    ? profile.avoidancePreferences.map(formatGoal).filter(Boolean)
    : [];
  const morningSkinFeel = profile.morningSkinFeel ? formatGoal(profile.morningSkinFeel) : null;
  const responseToNewProducts = profile.responseToNewProducts ? formatGoal(profile.responseToNewProducts) : null;

  return (
    <motion.section
      className="border-b border-[#eadde2] bg-[#fdfaf7] px-5 py-10 sm:px-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto max-w-[1200px] rounded-3xl border border-[#eadde2] bg-white p-6 sm:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b06b83]">
          Your skin profile
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {skinType && (
            <div>
              <p className="text-[13px] text-[#746b78]">Skin type</p>
              <p className="mt-1 font-['Instrument_Serif'] text-2xl text-[#201b28]">
                {skinType} skin
              </p>
            </div>
          )}
          {sensitivity && (
            <div>
              <p className="text-[13px] text-[#746b78]">Sensitivity</p>
              <p className="mt-1 font-['Instrument_Serif'] text-2xl text-[#201b28]">
                {sensitivity}
              </p>
            </div>
          )}
          {goal && (
            <div>
              <p className="text-[13px] text-[#746b78]">Primary goal</p>
              <p className="mt-1 font-['Instrument_Serif'] text-2xl text-[#201b28]">{goal}</p>
            </div>
          )}
        </div>

        {morningSkinFeel && (
          <p className="mt-5 text-[14px] text-[#746b78]">
            Morning skin feel:{' '}
            <span className="font-medium text-[#201b28]">{morningSkinFeel}</span>
          </p>
        )}

        {responseToNewProducts && (
          <p className="mt-3 text-[14px] text-[#746b78]">
            Reaction to new products:{' '}
            <span className="font-medium text-[#201b28]">{responseToNewProducts}</span>
          </p>
        )}

        {concerns.length > 0 && (
          <p className="mt-3 text-[14px] text-[#746b78]">
            Main concerns:{' '}
            <span className="font-medium text-[#201b28]">{concerns.join(' · ')}</span>
          </p>
        )}

        {avoidancePreferences.length > 0 && avoidancePreferences[0] !== 'Nothing To Avoid' && (
          <p className="mt-3 text-[14px] text-[#746b78]">
            Avoidance preferences:{' '}
            <span className="font-medium text-[#201b28]">{avoidancePreferences.join(' · ')}</span>
          </p>
        )}

        <p className="mt-5 text-[13px] text-[#8f6e99]">
          Your skincare recommendations are tailored to your profile.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/onboarding"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#201b28] px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
          >
            Recreate skin profile
          </Link>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#201b28] px-6 py-3 text-[15px] font-medium text-[#201b28] transition-colors hover:bg-[#201b28] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
            >
              Log in to save skin profile
            </Link>
          )}
        </div>
      </div>
    </motion.section>
  );
}

// Resolves each display-tab to a real backend category id when one matches
function buildDisplayCategories(categories) {
  return CATEGORY_DISPLAY.map((display) => {
    if (display.slug === '') {
      return { ...display, id: '' };
    }

    const match = categories.find((cat) => {
      const catName = (cat.name || '').toLowerCase();
      const catSlug = (cat.slug || '').toLowerCase();

      if (catSlug === display.slug.toLowerCase()) return true;

      if (display.fallbackSlugs?.some((slug) =>
        catSlug === slug.toLowerCase() || catName === slug.toLowerCase() || catName.includes(slug.toLowerCase())
      )) return true;

      return display.label.toLowerCase().includes(catName) || catName.includes(display.label.toLowerCase());
    });

    return { ...display, id: match?._id ?? display.slug };
  });
}

function productMatchesCategory(product, activeCategoryId, displayCategories) {
  if (!activeCategoryId) return true;

  const catValue = product?.category;
  const catId = catValue?._id || (typeof catValue === 'string' ? catValue : null);
  if (catId && catId === activeCategoryId) return true;

  const catName = (catValue?.name || (typeof catValue === 'string' ? catValue : '') || '').toLowerCase();
  const catSlug = (catValue?.slug || '').toLowerCase();

  const display = displayCategories.find((d) => d.id === activeCategoryId);
  if (!display) return false;

  const slugs = [display.slug, ...(display.fallbackSlugs || [])]
    .filter(Boolean)
    .map((s) => s.toLowerCase());

  if (catSlug && slugs.includes(catSlug)) return true;
  if (catName && (slugs.some((s) => catName === s || catName.includes(s)) || catName === display.label.toLowerCase())) {
    return true;
  }

  return false;
}

function productMatchesSearch(product, term) {
  const q = (term || '').trim().toLowerCase();
  if (!q) return true;

  const name = (product?.name || '').toLowerCase();
  const brandName = (product?.brand?.name || product?.brand || '').toString().toLowerCase();
  const categoryName = (product?.category?.name || product?.category || '').toString().toLowerCase();
  const ingredientNames = (product?.keyIngredients || []).map((i) => (i?.name || i || '').toString().toLowerCase());

  return (
    name.includes(q) ||
    brandName.includes(q) ||
    categoryName.includes(q) ||
    ingredientNames.some((ing) => ing.includes(q))
  );
}

function productMatchesBrand(product, brandId) {
  if (!brandId) return true;
  const brand = product?.brand;
  const id = brand?._id || (typeof brand === 'string' ? brand : null);
  return id === brandId;
}

function productMatchesPriceRange(product, minPrice, maxPrice) {
  if (!minPrice && !maxPrice) return true;

  const marketplacePrices = getMarketplacePrices(product);
  const recommendationPrice = product?.recommendation?.price;
  
  const candidatePrices = marketplacePrices.length > 0
    ? marketplacePrices.map((mp) => mp.price)
    : (Number.isFinite(Number(recommendationPrice)) ? [Number(recommendationPrice)] : []);

  if (candidatePrices.length === 0) return true;

  const lowest = Math.min(...candidatePrices);
  const min = minPrice ? Number(minPrice) : null;
  const max = maxPrice ? Number(maxPrice) : null;

  if (min != null && lowest < min) return false;
  if (max != null && lowest > max) return false;
  return true;
}

function CategoryRow({ activeCategoryId, displayCategories, onSelect }) {
  return (
    <section className="ppage__cats-container" aria-label="Product categories">
      <div className="ppage__cats-track">
        {displayCategories.map((category, index) => {
          const isActive = category.id === '' ? activeCategoryId === '' : activeCategoryId === category.id;
          const metadata = CATEGORY_METADATA[category.key];

          return (
            <motion.button
              key={category.key}
              type="button"
              className={`ppage__cat-item${isActive ? ' ppage__cat-item--active' : ''}`}
              onClick={() => onSelect(category.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
              aria-pressed={isActive}
              aria-label={metadata ? `${category.label} - ${metadata}` : category.label}
              title={metadata}
            >
              <span className="ppage__cat-name">{category.label}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function SidebarFilters({ filters, brands, onChange, onClear }) {
  const debounceRef = useRef(null);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange({ search: value }), DEBOUNCE_MS);
  };

  const hasActive = Boolean(filters.search || filters.brand || filters.minPrice || filters.maxPrice);

  return (
    <aside className="ppage__sidebar" aria-label="Catalog filters">
      <div className="pside__header">
        <h3 className="pside__title">Filters</h3>
        {hasActive && (
          <button type="button" className="pside__clear-btn" onClick={onClear}>
            Reset
          </button>
        )}
      </div>

      <div className="pside__section">
        <label htmlFor="pside-search" className="pside__heading">Search</label>
        <div className="pside__search-wrap">
          <svg className="pside__search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            id="pside-search"
            type="search"
            className="pside__search-input"
            placeholder="Search products…"
            defaultValue={filters.search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="pside__section">
        <span className="pside__heading">Budget</span>
        <div className="pside__budget-row">
          <div className="pside__budget-field">
            <span className="pside__budget-currency">₹</span>
            <input
              type="number"
              className="pside__budget-input"
              placeholder="Min"
              min="0"
              value={filters.minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value })}
              aria-label="Minimum price"
            />
          </div>
          <span className="pside__budget-sep">–</span>
          <div className="pside__budget-field">
            <span className="pside__budget-currency">₹</span>
            <input
              type="number"
              className="pside__budget-input"
              placeholder="Max"
              min="0"
              value={filters.maxPrice}
              onChange={(e) => onChange({ maxPrice: e.target.value })}
              aria-label="Maximum price"
            />
          </div>
        </div>
      </div>

      <div className="pside__section">
        <span className="pside__heading">Brand</span>
        <div className="pside__brand-list">
          <label className="pside__brand-label">
            <input
              type="radio"
              name="catalog-brand"
              value=""
              checked={filters.brand === ''}
              onChange={() => onChange({ brand: '' })}
              className="pside__brand-radio"
            />
            <span className="pside__brand-text">All Brands</span>
          </label>
          {brands.map((b) => (
            <label key={b._id} className="pside__brand-label">
              <input
                type="radio"
                name="catalog-brand"
                value={b._id}
                checked={filters.brand === b._id}
                onChange={() => onChange({ brand: b._id })}
                className="pside__brand-radio"
              />
              <span className="pside__brand-text">{b.name}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default function ProductsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [authenticatedProfile, setAuthenticatedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authenticatedRecommendation, setAuthenticatedRecommendation] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [onboardingAnalysis, setOnboardingAnalysis] = useState(() => {
    return resolveStoredAnalysis(null);
  });

  // Load Categories & Brands
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          apiClient.get(API_PATHS.categories.list),
          apiClient.get(API_PATHS.brands.list),
        ]);
        const catData = catRes.data?.data ?? catRes.data ?? [];
        const brandData = brandRes.data?.data ?? brandRes.data ?? [];
        setCategories(Array.isArray(catData) ? catData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
      } catch {
        // non-critical metadata
      }
    };
    loadMetadata();
  }, []);

  // Fetch authenticated profile if user is logged in
  useEffect(() => {
    if (!isAuthenticated) {
      setAuthenticatedProfile(null);
      return;
    }
    
    setProfileLoading(true);
    
    const fetchProfile = async () => {
      try {
        const response = await apiClient.get(API_PATHS.skinProfile.get, {
          withCredentials: true,
        });
        
        const profileData = response?.data?.data ?? response?.data;
        if (profileData && isProfile(profileData)) {
          setAuthenticatedProfile(profileData);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log("[PRODUCTS] No saved skin profile found (valid)");
        } else {
          console.error("[PRODUCTS] Skin profile fetch error:", error.message);
        }
      } finally {
        setProfileLoading(false);
      }
    };
    
    fetchProfile();
  }, [isAuthenticated]);

  // Fetch authenticated recommendations if user is logged in
  useEffect(() => {
    if (!isAuthenticated) {
      setAuthenticatedRecommendation(null);
      return;
    }

    let active = true;

    const loadRecommendations = async () => {
      setRecommendationLoading(true);

      try {
        console.log('[PRODUCTS] Loading authenticated recommendations');

        const response = await getLatestRecommendations();

        if (!active) return;

        const data = response?.data?.data ?? response?.data ?? null;

        console.log('[PRODUCTS] Authenticated recommendation loaded:', data);

        setAuthenticatedRecommendation(data);
      } catch (error) {
        if (!active) return;

        if (error?.response?.status === 404) {
          setAuthenticatedRecommendation(null);
        } else {
          console.error(
            '[PRODUCTS] Failed to load authenticated recommendations:',
            error
          );
          setAuthenticatedRecommendation(null);
        }
      } finally {
        if (active) setRecommendationLoading(false);
      }
    };

    loadRecommendations();

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // Handle post-onboarding modal and router state
  useEffect(() => {
    if (location.state?.fromOnboarding || location.state?.recommendations || location.state?.analysis) {
      const normalizedAnalysis = normalizeAnalysisState(location.state);
      
      if (normalizedAnalysis) {
        setOnboardingAnalysis(normalizedAnalysis);
        
        if (location.state?.fromOnboarding) {
          setShowWelcomeModal(true);
          try {
            sessionStorage.setItem(ONBOARDING_MODAL_KEY, '1');
          } catch {
            // ignore
          }
        }
        
        try {
          localStorage.setItem(ANONYMOUS_PROFILE_KEY, JSON.stringify(normalizedAnalysis));
        } catch {
          // ignore
        }
      }
      
      navigate(location.pathname + location.search, { replace: true, state: {} });
      return;
    }

    let hasPendingFlag = false;
    try {
      hasPendingFlag = sessionStorage.getItem(ONBOARDING_MODAL_KEY) === '1';
    } catch {
      hasPendingFlag = false;
    }

    if (hasPendingFlag) {
      const stored = resolveStoredAnalysis(null);
      setOnboardingAnalysis(stored);
      setShowWelcomeModal(true);
    }
  }, [location, navigate]);

  const closeWelcomeModal = () => {
    setShowWelcomeModal(false);
    try {
      sessionStorage.removeItem(ONBOARDING_MODAL_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!showWelcomeModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeWelcomeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showWelcomeModal]);

  const handleFilterChange = useCallback((partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleCategorySelect = useCallback((categoryId) => {
    setFilters((prev) => ({ ...prev, category: categoryId }));
  }, []);

  const hasActiveFilters = Boolean(
    filters.search || filters.category || filters.brand || filters.minPrice || filters.maxPrice
  );

  // Profile priority: authenticated > onboarding/analysis > pending > null
  const skinProfile = useMemo(() => {
    // 1. Authenticated profile from backend
    if (authenticatedProfile && isProfile(authenticatedProfile)) {
      return authenticatedProfile;
    }
    
    // 2. Profile from onboarding/analysis
    const analysisProfile = readSkinProfile(onboardingAnalysis);
    if (analysisProfile) {
      return analysisProfile;
    }
    
    // 3. Pending profile from localStorage
    const pendingProfile = readPendingSkinProfile();
    if (pendingProfile && isProfile(pendingProfile)) {
      return pendingProfile;
    }
    
    return null;
  }, [authenticatedProfile, onboardingAnalysis]);

  const recommendations = useMemo(() => {
    // For authenticated users, use the fetched recommendation
    if (isAuthenticated && authenticatedRecommendation) {
      const latest = Array.isArray(authenticatedRecommendation)
        ? authenticatedRecommendation[0]
        : authenticatedRecommendation;

      const items = latest?.products || latest?.recommendations || [];
      return items;
    }

    // For anonymous users, use onboarding analysis
    return readRecommendations(onboardingAnalysis);
  }, [isAuthenticated, authenticatedRecommendation, onboardingAnalysis]);

  // Preserve complete recommendation metadata while extracting products
  const recommendedProducts = useMemo(() => {
    const seen = new Set();
    const items = [];
    
    recommendations.forEach((item) => {
      const product = item?.product || item;
      if (product?._id && !seen.has(product._id)) {
        seen.add(product._id);
        items.push({
          ...product,
          recommendation: {
            rank: item?.rank ?? null,
            compatibilityScore: item?.compatibilityScore ?? item?.score ?? null,
            matchedFactors: item?.matchedFactors ?? [],
            concernsMatched: item?.concernsMatched ?? [],
            concernsNotMatched: item?.concernsNotMatched ?? [],
            explanation: item?.explanation ?? product?.productIntelligence?.explanation ?? null,
            price: item?.price ?? null,
            retailer: item?.retailer ?? null,
            offerUrl: item?.offerUrl ?? null,
          },
        });
      }
    });
    
    return items;
  }, [recommendations]);

  const displayCategories = useMemo(
    () => buildDisplayCategories(categories),
    [categories],
  );

  const filteredRecommendedProducts = useMemo(() => {
    return recommendedProducts.filter((product) =>
      productMatchesCategory(product, filters.category, displayCategories) &&
      productMatchesSearch(product, filters.search) &&
      productMatchesBrand(product, filters.brand) &&
      productMatchesPriceRange(product, filters.minPrice, filters.maxPrice)
    );
  }, [recommendedProducts, filters, displayCategories]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, recommendedProducts]);

  const displayedProducts = useMemo(
    () => filteredRecommendedProducts.slice(0, visibleCount),
    [filteredRecommendedProducts, visibleCount],
  );

  const hasMore = visibleCount < filteredRecommendedProducts.length;
  const totalCount = filteredRecommendedProducts.length;

  const handleLoadMore = () => setVisibleCount((count) => count + PAGE_SIZE);

  const hasAnyRecommendations = recommendedProducts.length > 0;
  const hasOnlyCategoryFilter = Boolean(filters.category) &&
    !filters.search && !filters.brand && !filters.minPrice && !filters.maxPrice;

  let emptyTitle;
  let emptySubtitle;
  if (recommendationLoading) {
    emptyTitle = 'Loading your recommendations...';
    emptySubtitle = 'Fetching products selected for your skin.';
  } else if (!hasAnyRecommendations) {
    emptyTitle = 'No recommended products yet';
    emptySubtitle = 'Complete your skin profile and we\u2019ll curate products picked for your skin.';
  } else if (displayedProducts.length === 0 && hasOnlyCategoryFilter) {
    emptyTitle = 'No recommended products in this category yet.';
    emptySubtitle = 'Try another category, or check back as we add more picks for you.';
  } else if (displayedProducts.length === 0) {
    emptyTitle = 'No products match your filters';
    emptySubtitle = 'Try adjusting your search or filter criteria.';
  }

  return (
    <div className="ppage">
      <Navigation />

      {/* USER SKIN PROFILE SECTION */}
      <SkinProfileSection profile={skinProfile} isAuthenticated={isAuthenticated} />

      {/* PAGE HEADER */}
      <section className="border-b border-[#eadde2] bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-[13px] tracking-wide text-[#b06b83]">
            Personalized for you
          </p>
          <h1 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.75rem,4vw,2.5rem)] leading-tight text-[#201b28]">
            Recommended for You
          </h1>
          <p className="mt-3 max-w-[600px] text-[15px] leading-relaxed text-[#746b78]">
            Products selected based on your skin profile, concerns, sensitivity and preferences.
          </p>
        </div>
      </section>

      {/* PRODUCT TYPE CATEGORIES */}
      <CategoryRow
        activeCategoryId={filters.category}
        displayCategories={displayCategories}
        onSelect={handleCategorySelect}
      />

      {/* Mobile Filter Trigger Bar */}
      <div className="ppage__mobile-filter-bar">
        <button
          type="button"
          className={`ppage__mobile-trigger${hasActiveFilters ? ' ppage__mobile-trigger--active' : ''}`}
          onClick={() => setMobileDrawerOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Filter Recommendations{hasActiveFilters ? ' (Active)' : ''}
        </button>
      </div>

      {/* RECOMMENDED PRODUCTS */}
      <div className="ppage__catalog-layout">
        <div className="ppage__sidebar-desktop">
          <SidebarFilters
            filters={filters}
            brands={brands}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        </div>

        <main className="ppage__main-content">
          <div className="ppage__results-bar">
            <span className="ppage__results-count">
              {totalCount.toLocaleString()} Recommended Product{totalCount === 1 ? '' : 's'}
            </span>
            {hasActiveFilters && (
              <button type="button" className="ppage__clear-link" onClick={handleClearFilters}>
                Clear filters
              </button>
            )}
          </div>

          <ProductGrid
            products={displayedProducts}
            isLoading={recommendationLoading}
            hasFilters={hasActiveFilters}
            emptyTitle={emptyTitle}
            emptySubtitle={emptySubtitle}
          />

          {hasMore && (
            <div className="ppage__load-more-wrap">
              <button
                type="button"
                className="ppage__load-more-btn"
                onClick={handleLoadMore}
              >
                Load More Products
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <motion.div
            className="ppage__drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileDrawerOpen(false)}
          >
            <motion.div
              className="ppage__drawer-sheet"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ppage__drawer-header">
                <h3 className="ppage__drawer-title">Filters</h3>
                <button
                  type="button"
                  className="ppage__drawer-close"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close filters"
                >
                  ✕
                </button>
              </div>
              <div className="ppage__drawer-content">
                <SidebarFilters
                  filters={filters}
                  brands={brands}
                  onChange={handleFilterChange}
                  onClear={() => {
                    handleClearFilters();
                    setMobileDrawerOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ONBOARDING WELCOME MODAL */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            className="ppage__modal-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeWelcomeModal}
          >
            <motion.div
              className="ppage__modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="onboarding-modal-heading"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="ppage__modal-eyebrow">YOUR SKIN PROFILE IS READY</p>
              <h2 id="onboarding-modal-heading" className="ppage__modal-heading">
                Thank you.
              </h2>
              <p className="ppage__modal-body">
                We&apos;ve created your personalized skin profile and selected products with your skin in mind.
              </p>
              <div className="ppage__modal-actions">
                <button
                  type="button"
                  className="ppage__modal-primary"
                  onClick={closeWelcomeModal}
                >
                  See my recommended products →
                </button>
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    className="ppage__modal-secondary"
                    onClick={closeWelcomeModal}
                  >
                    Log in to save skin profile
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}