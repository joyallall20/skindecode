import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSkinProfile, saveSkinProfile } from '../../api/skinProfileApi.js';
import { getLatestRecommendations } from '../../api/recommendationApi.js';
import ProductCard from '../../components/products/ProductCard.jsx';
import { Navigation } from '../../components/Navigation/index.js';
import {
  clearPendingSkinProfile,
  readPendingSkinProfile,
} from '../../utils/pendingSkinProfile.js';

const unwrap = (value) => value?.data ?? value;
const formatValue = (value) =>
  String(value || '')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DashboardPage() {
  const { profile: account, loading: authLoading, isAuthenticated } = useAuth();
  const [skinProfile, setSkinProfile] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pendingFlushRef = useRef(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;

    const load = async () => {
      // Flush a pending assessment saved before login (e.g. page reload).
      if (!pendingFlushRef.current) {
        const pending = readPendingSkinProfile();
        if (pending) {
          pendingFlushRef.current = true;
          try {
            await saveSkinProfile(pending);
            clearPendingSkinProfile();
          } catch {
            pendingFlushRef.current = false;
          }
        }
      }

      const [profileResult, recommendationResult] = await Promise.allSettled([
        getSkinProfile(),
        getLatestRecommendations(),
      ]);

      if (!active) return;

      if (profileResult.status === 'fulfilled') {
        setSkinProfile(unwrap(profileResult.value));
      } else if (!profileResult.reason?.isNotFound) {
        setError((current) => current || 'We could not load your skin profile yet.');
      }

      if (recommendationResult.status === 'fulfilled') {
        setRecommendation(unwrap(recommendationResult.value));
      }

      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated]);

  const firstName =
    account?.name?.split(' ')?.[0] ||
    account?.displayName?.split(' ')?.[0] ||
    'Welcome back';
  const products = useMemo(() => {
    const latest = Array.isArray(recommendation) ? recommendation[0] : recommendation;
    const items = latest?.products || latest?.recommendations || [];
    return items.map((item) => item?.product || item).filter(Boolean).slice(0, 4);
  }, [recommendation]);
  const concerns = Array.isArray(skinProfile?.concerns) ? skinProfile.concerns : [];

  return (
    <div className="min-h-screen bg-[#fdfaf7] text-[#201b28]">
      <Navigation />
      <main className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm tracking-[0.18em] text-[#b06b83] uppercase">Your skincare space</p>
          <h1 className="mt-3 font-['Instrument_Serif'] text-4xl sm:text-5xl">
            Good morning, {firstName}
          </h1>
          <p className="mt-4 max-w-xl text-[#746b78]">
            Your skin profile, recommendations and skincare tools — all in one place.
          </p>
        </motion.section>

        {error ? (
          <p role="alert" className="mt-8 rounded-xl border border-[#f1dfe8] bg-white p-5 text-[#8f3d61]">
            {error}
          </p>
        ) : null}

        <section className="mt-12 rounded-2xl border border-[#eadde2] bg-white p-6 sm:p-8">
          <p className="text-xs tracking-[0.18em] text-[#b06b83] uppercase">Your skin profile</p>
          {loading ? (
            <p className="mt-6 text-[#746b78]">Loading your profile…</p>
          ) : skinProfile ? (
            <>
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-[#746b78]">Skin type</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(skinProfile.skinType)} skin
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#746b78]">Sensitivity</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(skinProfile.sensitivity)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#746b78]">Primary goal</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatValue(skinProfile.primaryGoal)}
                  </p>
                </div>
              </div>
              {concerns.length ? (
                <p className="mt-6 text-sm text-[#746b78]">
                  Main concerns:{' '}
                  <span className="text-[#201b28]">
                    {concerns.map(formatValue).join(' · ')}
                  </span>
                </p>
              ) : null}
              <div className="mt-7 flex flex-wrap gap-4">
                <Link
                  to="/onboarding"
                  className="rounded-full bg-[#201b28] px-5 py-3 text-sm font-semibold text-white"
                >
                  Update skin profile
                </Link>
                <Link
                  to="/profile"
                  className="rounded-full border border-[#d8c4ce] px-5 py-3 text-sm font-semibold text-[#201b28]"
                >
                  View full profile
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <p className="text-[#746b78]">Your skin profile isn’t complete yet.</p>
              <Link
                to="/onboarding"
                className="mt-5 inline-block rounded-full bg-[#201b28] px-5 py-3 text-sm font-semibold text-white"
              >
                Create your skin profile
              </Link>
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.18em] text-[#b06b83] uppercase">
                Personalized discovery
              </p>
              <h2 className="mt-2 font-['Instrument_Serif'] text-3xl">Recommended for you</h2>
              <p className="mt-2 text-sm text-[#746b78]">
                Products selected based on your skin profile and goals.
              </p>
            </div>
            <Link to="/products" className="text-sm font-semibold text-[#8f3d61]">
              View all recommendations →
            </Link>
          </div>
          {loading ? (
            <p className="mt-8 text-[#746b78]">Preparing your recommendations…</p>
          ) : products.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product, index) => (
                <ProductCard key={product._id} product={product} index={index} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-[#eadde2] bg-white p-8 text-[#746b78]">
              We’re preparing recommendations for your profile.
            </div>
          )}
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#f4e6ec] p-7 sm:p-9">
            <p className="text-xs tracking-[0.18em] text-[#8f3d61] uppercase">Ask Skinly</p>
            <h2 className="mt-3 font-['Instrument_Serif'] text-3xl">
              Have a question about your skincare?
            </h2>
            <p className="mt-3 text-[#746b78]">
              Get thoughtful guidance as you build a routine that feels right for you.
            </p>
            <Link
              to="/chat"
              className="mt-6 inline-block rounded-full bg-[#201b28] px-5 py-3 text-sm font-semibold text-white"
            >
              Chat with Skinly →
            </Link>
          </div>
          <div className="rounded-2xl border border-[#eadde2] bg-white p-7 sm:p-9">
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-[0.18em] text-[#b06b83] uppercase">Build your routine</p>
              <span className="text-xs font-semibold text-[#8f3d61]">Coming soon</span>
            </div>
            <h2 className="mt-3 font-['Instrument_Serif'] text-3xl">
              A skincare routine built around you.
            </h2>
            <p className="mt-3 text-[#746b78]">
              Turn your skin profile, goals and products into a personalized morning and evening
              routine.
            </p>
            <div className="mt-6 space-y-2 text-sm text-[#746b78]">
              <p>
                <strong className="text-[#201b28]">AM</strong> · Cleanse → Treat → Moisturize → SPF
              </p>
              <p>
                <strong className="text-[#201b28]">PM</strong> · Cleanse → Treat → Moisturize
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
