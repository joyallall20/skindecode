import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useAuth } from "../context/AuthContext.jsx";
import { saveSkinProfile } from "../api/skinProfileApi.js";
import { recordAnonymousConsent, analyzeAnonymously } from "../api/anonymousAnalysisApi.js";
import { generateRecommendations as generateAuthenticatedRecommendations } from "../api/recommendationApi.js";
import LoginModal from "../components/auth/LoginModal.jsx";
import { Navigation } from "../components/Navigation/index.js";
import {
  buildSkinProfilePayload,
  clearPendingSkinProfile,
  readPendingSkinProfile,
  storePendingSkinProfile,
} from "../utils/pendingSkinProfile.js";
import "./OnboardingPage.css";

const questions = [
  {
    key: "skinType",
    title: "How would you describe your skin?",
    options: [
      ["oily", "Oily"],
      ["dry", "Dry"],
      ["combination", "Combination"],
      ["normal", "Normal"],
    ],
  },
  {
    key: "sensitivity",
    title: "How sensitive is your skin?",
    options: [
      ["low", "Low"],
      ["medium", "Medium"],
      ["high", "High"],
    ],
  },
  {
    key: "concerns",
    title: "What are your main skin concerns?",
    multi: true,
    options: [
      ["acne", "Acne & breakouts"],
      ["pigmentation", "Pigmentation"],
      ["dark-spots", "Dark spots"],
      ["dryness", "Dryness"],
      ["excess-oil", "Excess oil"],
      ["aging", "Signs of aging"],
      ["fine-lines", "Fine lines"],
      ["uneven-texture", "Uneven texture"],
      ["dullness", "Dullness"],
      ["redness", "Redness"],
      ["dark-circles", "Dark circles"],
      ["dehydration", "Dehydration"],
      ["large-pores", "Large pores"],
      ["sun-damage", "Sun damage"],
    ],
  },
  {
    key: "primaryGoal",
    title: "What's your primary skincare goal?",
    options: [
      ["clearer-skin", "Clearer skin"],
      ["brighter-even", "Brighter & more even skin"],
      ["hydration", "Better hydration"],
      ["smoother-texture", "Smoother texture"],
      ["less-oiliness", "Less oiliness"],
      ["anti-aging", "Reduce signs of aging"],
      ["healthier-skin", "Healthier-looking skin"],
    ],
  },
  {
    key: "avoidancePreferences",
    title: "Is there anything you would like us to avoid?",
    multi: true,
    options: [
      ["fragrance", "Fragrance"],
      ["essential-oils", "Essential oils"],
      ["alcohol", "Alcohol"],
      ["harsh-exfoliants", "Harsh exfoliants"],
      ["irritating-ingredients", "Ingredients that irritate my skin"],
      ["known-allergies", "Known allergies"],
      ["nothing-to-avoid", "Nothing to avoid"],
    ],
  },
  {
    key: "responseToNewProducts",
    title: "How does your skin usually react to new products?",
    options: [
      ["no-reaction", "Usually no reaction"],
      ["sometimes-irritated", "Sometimes gets irritated"],
      ["often-irritated", "Often gets irritated"],
      ["very-easily-irritated", "Gets irritated very easily"],
    ],
  },
  {
    key: "morningSkinFeel",
    title: "What does your skin usually feel like in the morning?",
    options: [
      ["dry", "Dry / tight"],
      ["balanced", "Balanced"],
      ["slightly-oily", "Slightly oily"],
      ["very-oily", "Very oily"],
      ["combination-feel", "Combination"],
    ],
  },
];

const required = (question) =>
  question.multi
    ? Array.isArray(question.answer) && question.answer.length > 0
    : Boolean(question.answer);

function Logo() {
  return (
    <span className="font-['Instrument_Serif'] text-2xl tracking-tight text-[#201b28]">
      Skinly<span className="text-[#e47796]">.</span>
    </span>
  );
}

function ConsultationProgress({ step, total }) {
  const percent = ((step + 1) / total) * 100;
  return (
    <div className="mt-8 sm:mt-10">
      <div className="flex items-baseline justify-between text-[13px] text-[#8f6e99]">
        <span>Skin consultation</span>
        <span aria-hidden="true">
          Question {step + 1} of {total}
        </span>
      </div>
      <div
        className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#eadde2]"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Question ${step + 1} of ${total}`}
      >
        <motion.div
          className="h-full rounded-full bg-[#e47796]"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function LoadingScreen() {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <Navigation />
      <main className="onboarding flex min-h-[calc(100vh-76px)] flex-col items-center justify-center bg-[#fdfaf7] px-6 text-center">
        <Logo />
        <p className="mt-10 text-[13px] tracking-wide text-[#b06b83]">
          Your personalized recommendations
        </p>
        <h1 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.75rem,5vw,2.75rem)] leading-tight text-[#201b28]">
          Generating your personalized recommendations...
        </h1>
        <p className="mt-3 max-w-[380px] text-[15px] leading-relaxed text-[#746b78]">
          We're matching your skin profile with products that suit your needs.
        </p>
        <div
          className="mt-10 flex items-center gap-2"
          role="status"
          aria-live="polite"
          aria-label="Generating recommendations"
        >
          {[0, 1, 2].map((i) =>
            reduceMotion ? (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#e47796]" />
            ) : (
              <motion.span
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-[#e47796]"
                animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.15,
                }}
              />
            ),
          )}
        </div>
      </main>
    </>
  );
}

function ConsentScreen({ onAccept, onBack, loading, error, consentAccepted, setConsentAccepted }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto mt-10 max-w-[680px] pb-[120px] sm:mt-14 md:pb-0"
    >
      <p className="text-[13px] tracking-wide text-[#b06b83]">
        Before we generate your recommendations
      </p>

      <h1 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.08] text-[#201b28]">
        Your privacy matters
      </h1>

      <p className="mt-3 text-[15px] leading-relaxed text-[#746b78]">
        We'll use the answers you provide about your skin type, sensitivity,
        concerns, goals, preferences, and product interests to generate
        personalized skincare recommendations. If you continue without
        creating an account, we won't save your answers as a persistent
        SkinProfile. We will maintain a limited record of your consent and
        the applicable policy versions.
      </p>

      <div className="mt-8">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-[#eadde2] text-[#e47796] focus:ring-[#e47796]"
          />
          <span className="text-[15px] text-[#201b28]">
            I agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#e47796] underline hover:text-[#d16382]"
            >
              Terms of Use
            </a>{" "}
            and acknowledge the{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#e47796] underline hover:text-[#d16382]"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-5 text-[14px] text-[#b3405e]">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="min-h-[48px] rounded-full px-4 py-3 text-[15px] font-medium text-[#201b28] transition-opacity disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!consentAccepted || loading}
          className="min-h-[48px] flex-1 rounded-full bg-[#201b28] px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
        >
          {loading ? "Generating..." : "Get my recommendations"}
        </button>
      </div>
    </motion.section>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingProfile, setPendingProfile] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const reduceMotion = useReducedMotion();
  const savingRef = useRef(false);

  const question = questions[step];
  const selected = answers[question.key] || (question.multi ? [] : "");
  const canContinue = required({ ...question, answer: selected });
  const progress = useMemo(
    () => `${String(step + 1).padStart(2, "0")} / ${questions.length}`,
    [step],
  );

  const select = (value) => {
    if (!question.multi)
      return setAnswers((current) => ({ ...current, [question.key]: value }));
    
    setAnswers((current) => {
      const currentValues = Array.isArray(current[question.key])
        ? current[question.key]
        : [];
      
      // Special handling for avoidancePreferences "nothing-to-avoid"
      if (question.key === "avoidancePreferences") {
        if (value === "nothing-to-avoid") {
          return { ...current, [question.key]: ["nothing-to-avoid"] };
        }
        
        const withoutNothing = currentValues.filter(
          (item) => item !== "nothing-to-avoid"
        );
        
        return {
          ...current,
          [question.key]: withoutNothing.includes(value)
            ? withoutNothing.filter((item) => item !== value)
            : [...withoutNothing, value],
        };
      }
      
      return {
        ...current,
        [question.key]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  };

  const handleProfileComplete = async (profileData) => {
    if (authLoading || savingRef.current) return;

    if (!isAuthenticated) {
      // Anonymous flow: store profile, show consent
      setPendingProfile(profileData);
      storePendingSkinProfile(profileData);
      setShowConsent(true);
      return;
    }

    // Authenticated flow: save profile and generate recommendations
    if (savingRef.current) return;
    savingRef.current = true;
    setError("");
    setIsGenerating(true);

    try {
      // Save profile first
      await saveSkinProfile(profileData);
      clearPendingSkinProfile();
      setPendingProfile(null);
      
      // Generate authenticated recommendations
      const recommendationsResponse = await generateAuthenticatedRecommendations(profileData);
      
      // Extract recommendations from response
      const responseData = recommendationsResponse?.data ?? recommendationsResponse;
      const recommendations = responseData?.recommendations ?? [];
      
      console.log("[AUTH FRONTEND] Recommendation count:", recommendations.length);
      
      // Navigate to products with completed analysis
      navigate("/products", {
        state: {
          analysis: {
            profile: profileData,
            recommendations,
            anonymous: false,
            createdAt: new Date().toISOString(),
          },
          fromOnboarding: true,
        },
      });
    } catch (requestError) {
      console.error("Authenticated recommendation error:", {
        message: requestError.message,
        status: requestError.response?.status,
        data: requestError.response?.data,
      });
      
      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        "We couldn't generate your recommendations. Please try again.",
      );
      setIsGenerating(false);
    } finally {
      savingRef.current = false;
    }
  };

  const handleConsentAccept = async () => {
    if (!pendingProfile || consentLoading || isGenerating) return;
    if (!consentAccepted) return;
    
    setConsentLoading(true);
    setIsGenerating(true);
    
    try {
      // Record consent first (anonymous only)
      const consentResponse = await recordAnonymousConsent({
        agreedToTerms: true,
        agreedToPrivacy: true,
      });

      const consentId =
        consentResponse?.data?.consentId ??
        consentResponse?.consentId;

      if (!consentId) {
        throw new Error("Failed to record consent. Please try again.");
      }

      // Call analyzeAnonymously - this polls until completed
      const analysisResponse = await analyzeAnonymously(pendingProfile, consentId);
      
      // Handle both response shapes
      const analysisData = analysisResponse?.data ?? analysisResponse;
      const recommendations = analysisData?.recommendations ?? [];
      const resultProfile = analysisData?.profile ?? pendingProfile;

      console.log("[ANON FRONTEND] Final recommendation count:", recommendations.length);

      // Navigate to products page with completed recommendations AND profile
      navigate("/products", {
        state: {
          analysis: {
            profile: resultProfile,
            recommendations,
            anonymous: true,
            createdAt: new Date().toISOString(),
          },
          fromOnboarding: true,
        },
      });
    } catch (error) {
      console.error("Anonymous recommendation error:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      
      setConsentError(
        error.response?.data?.message ||
        error.message ||
        "We couldn't generate your recommendations. Please try again."
      );
      setIsGenerating(false);
    } finally {
      setConsentLoading(false);
    }
  };

  const continueStep = async () => {
    if (!canContinue || savingRef.current) return;
    if (step < questions.length - 1) return setStep((current) => current + 1);

    setError("");
    const profileData = buildSkinProfilePayload(answers);
    try {
      await handleProfileComplete(profileData);
    } catch {
      // Error already surfaced via setError
    }
  };

  const handleLoginSuccess = async () => {
    const profileToSave = pendingProfile || readPendingSkinProfile() || buildSkinProfilePayload(answers);

    if (!profileToSave) {
      setShowLoginModal(false);
      return;
    }

    setShowLoginModal(false);
    
    if (savingRef.current) return;
    savingRef.current = true;
    
    try {
      await saveSkinProfile(profileToSave);
      clearPendingSkinProfile();
      setPendingProfile(null);
      navigate("/products", { replace: true });
    } catch (requestError) {
      storePendingSkinProfile(profileToSave);
      setError(
        requestError.message ||
          "We could not save your skin profile. Please try again.",
      );
    } finally {
      savingRef.current = false;
    }
  };

  const handleRestart = () => {
    setStep(0);
    setAnswers({});
    setError("");
    setShowConsent(false);
    setConsentAccepted(false);
    setConsentError("");
    setPendingProfile(null);
    setIsGenerating(false);
  };

  const handleBackFromConsent = () => {
    setShowConsent(false);
    setConsentAccepted(false);
    setConsentError("");
    setPendingProfile(null);
    setStep(questions.length - 1);
  };

  if (isGenerating) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Navigation />
      <main className="onboarding min-h-[calc(100vh-76px)] bg-[#fdfaf7] px-5 pb-10 pt-7 text-[#201b28] sm:px-10 md:px-16">
        <header className="mx-auto max-w-[680px]">
          {!showConsent && (
            <ConsultationProgress step={step} total={questions.length} />
          )}
          {!showConsent && (
            <span className="sr-only">{progress}</span>
          )}
        </header>

        <AnimatePresence mode="wait">
          {showConsent ? (
            <ConsentScreen
              key="consent"
              onAccept={handleConsentAccept}
              onBack={handleBackFromConsent}
              loading={consentLoading}
              error={consentError}
              consentAccepted={consentAccepted}
              setConsentAccepted={setConsentAccepted}
            />
          ) : (
            <motion.section
              key={step}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mx-auto mt-10 max-w-[680px] pb-[120px] sm:mt-14 md:pb-0"
            >
              <p className="text-[13px] tracking-wide text-[#b06b83]">
                Your skin consultation
              </p>

              <h1 className="mt-3 font-['Instrument_Serif'] text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.08] text-[#201b28]">
                {question.title}
              </h1>

              <p className="mt-3 text-[15px] text-[#746b78]">
                {question.multi ? "Select all that apply." : "Choose the answer that feels most like you."}
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {question.options.map(([value, label]) => {
                  const isSelected = question.multi
                    ? selected.includes(value)
                    : selected === value;
                  return (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={isSelected}
                      onClick={() => select(value)}
                      className={[
                        "min-h-[48px] rounded-2xl border px-5 py-4 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2",
                        isSelected
                          ? "border-[#e47796] bg-[#fff0f4] text-[#201b28] shadow-[0_0_0_2px_#f7d4de]"
                          : "border-[#eadde2] bg-white text-[#201b28] hover:border-[#e0b8c3] hover:bg-[#fffafb]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p role="alert" className="mt-5 text-[14px] text-[#b3405e]">
                  {error}
                </p>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {!showConsent && !isGenerating && (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eadde2] bg-[#fdfaf7] px-5 pt-3 pb-[calc(12px_+_env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(32,27,40,0.04)] md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:shadow-none">
            <div className="mx-auto flex max-w-[680px] items-center justify-between gap-4 md:mt-10">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((current) => current - 1)}
                className="min-h-[48px] rounded-full px-4 py-3 text-[15px] font-medium text-[#201b28] transition-opacity disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canContinue || authLoading}
                onClick={continueStep}
                className="min-h-[48px] rounded-full bg-[#201b28] px-6 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e47796] focus-visible:ring-offset-2"
              >
                {step === questions.length - 1
                  ? "Get my recommendations"
                  : "Continue"}
              </button>
            </div>
          </div>
        )}
      </main>

      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="Create an account or log in to save your skin profile."
        onSuccess={handleLoginSuccess}
      />
    </>
  );
}