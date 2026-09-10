import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { isGoogleAuthConfigured } from '../../services/authService.js';

const getAuthMessage = (error, mode) => {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
    'auth/popup-blocked':
      'The sign-in popup was blocked by your browser. Please allow popups for this site.',
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/weak-password':
      'Use a stronger password with at least six characters.',
  };
  return (
    messages[error?.code] ||
    error?.message ||
    (mode === 'signup'
      ? 'Unable to create your account. Please try again.'
      : 'Unable to sign in. Please try again.')
  );
};

/**
 * Reusable login/signup modal for protected flows
 * (SkinProfile save, chat, etc.).
 */
export default function LoginModal({
  open,
  onClose,
  message = 'Create an account or log in to continue.',
  onSuccess,
}) {
  const { login, loginWithGoogle, signup, syncApplicationUser } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open) {
      setError('');
      setSubmitting(false);
      setMode('login');
      setEmail('');
      setPassword('');
    }
  }, [open]);

  if (!open) return null;

  const finishAuth = async () => {
    // Ensure backend user sync + token are ready before callers save data.
    await syncApplicationUser();
    if (typeof onSuccess === 'function') {
      await onSuccess();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      await finishAuth();
    } catch (authError) {
      setError(getAuthMessage(authError, mode));
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      await finishAuth();
    } catch (authError) {
      setError(getAuthMessage(authError, mode));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close login dialog"
        className="absolute inset-0 bg-[#201b28]/45"
        onClick={() => {
          if (!submitting) onClose?.();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative z-[81] w-full max-w-[420px] rounded-3xl border border-[#eadde2] bg-white p-7 shadow-[0_24px_64px_rgba(32,27,40,0.22)]"
      >
        <button
          type="button"
          onClick={() => {
            if (!submitting) onClose?.();
          }}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#746b78] hover:bg-[#fff0f4] hover:text-[#201b28]"
        >
          &times;
        </button>

        <p className="font-['Instrument_Serif'] text-2xl text-[#201b28]">
          Skinly<span className="text-[#e47796]">.</span>
        </p>
        <h2
          id="login-modal-title"
          className="mt-3 text-2xl font-semibold text-[#201b28]"
        >
          {mode === 'signup' ? 'Create an account' : 'Welcome back'}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#746b78]">
          {message}
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3.5">
          <label className="grid gap-1.5 text-[13px] font-semibold text-[#374151]">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-[#d8c4ce] px-3.5 py-3 text-[15px] text-[#201b28] outline-none focus:border-[#e47796] focus:ring-2 focus:ring-[#f7d4de]"
            />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-[#374151]">
            Password
            <input
              required
              minLength={mode === 'signup' ? 6 : undefined}
              type="password"
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-[#d8c4ce] px-3.5 py-3 text-[15px] text-[#201b28] outline-none focus:border-[#e47796] focus:ring-2 focus:ring-[#f7d4de]"
            />
          </label>

          {error ? (
            <p role="alert" className="m-0 text-[13px] text-[#b42318]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[#201b28] px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {submitting
              ? mode === 'signup'
                ? 'Creating account…'
                : 'Signing in…'
              : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        {isGoogleAuthConfigured ? (
          <>
            <div className="my-4 flex items-center gap-2.5 text-[12px] text-[#9ca3af]">
              <span className="h-px flex-1 bg-[#eadde2]" />
              OR
              <span className="h-px flex-1 bg-[#eadde2]" />
            </div>
            <button
              type="button"
              onClick={googleLogin}
              disabled={submitting}
              className="w-full rounded-xl border border-[#d8c4ce] bg-white px-4 py-3 text-[15px] font-semibold text-[#201b28] disabled:opacity-50"
            >
              Continue with Google
            </button>
          </>
        ) : null}

        <p className="mt-5 text-center text-[13px] text-[#746b78]">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-semibold text-[#b54f75]"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Skinly?{' '}
              <button
                type="button"
                className="font-semibold text-[#b54f75]"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
              >
                Create an account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
