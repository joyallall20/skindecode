import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authenticateFirebaseUser } from '../api/userApi.js';
import {
  isGoogleAuthConfigured,
} from '../services/authService.js';
import { Navigation } from '../components/Navigation/index.js';

const getSignupMessage = (error) => {
  const messages = {
    'auth/popup-closed-by-user':
      'The Google sign-up window was closed.',
    'auth/popup-blocked':
      'The Google sign-up popup was blocked. Please allow popups for this site.',
    'auth/account-exists-with-different-credential':
      'An account already exists with a different sign-in method.',
    'auth/too-many-requests':
      'Too many attempts. Please try again later.',
    'auth/network-request-failed':
      'Network error. Please check your internet connection and try again.',
  };

  return (
    messages[error?.code] ||
    error?.message ||
    'Unable to create your account. Please try again.'
  );
};

export default function SignupPage() {
  const {
    loginWithGoogle,
  } = useAuth();

  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const googleSignup = async () => {
    setError('');
    setSubmitting(true);

    try {
      await loginWithGoogle();

      await authenticateFirebaseUser();

      navigate('/dashboard', {
        replace: true,
      });
    } catch (authError) {
      setError(getSignupMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navigation />

      <main
        style={{
          minHeight: 'calc(100vh - 76px)',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#fffafc',
        }}
      >
        <section
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 32,
            border: '1px solid #f1dfe8',
            borderRadius: 20,
            background: '#fff',
          }}
        >
          <div
            style={{
              color: '#111827',
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Skinly<span style={{ color: '#e58aa8' }}>.</span>
          </div>

          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 32,
              color: '#111827',
            }}
          >
            Create your account
          </h1>

          <p
            style={{
              margin: '0 0 24px',
              color: '#6b7280',
            }}
          >
            Get personalized skincare recommendations
            tailored to you.
          </p>

          {error ? (
            <p
              role="alert"
              style={{
                margin: '0 0 16px',
                padding: '12px 14px',
                borderRadius: 9,
                background: '#fef2f2',
                color: '#b42318',
                fontSize: 14,
              }}
            >
              {error}
            </p>
          ) : null}

          {isGoogleAuthConfigured ? (
            <button
              type="button"
              onClick={googleSignup}
              disabled={submitting}
              style={googleButton}
            >
              <span style={googleIcon}>G</span>

              {submitting
                ? 'Creating account…'
                : 'Continue with Google'}
            </button>
          ) : (
            <p
              style={{
                margin: 0,
                padding: 14,
                borderRadius: 9,
                background: '#fef2f2',
                color: '#b42318',
                fontSize: 14,
              }}
            >
              Google sign-in is not configured yet.
            </p>
          )}

          <p
            style={{
              margin: '22px 0 0',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: 14,
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: '#b54f75',
                fontWeight: 700,
              }}
            >
              Sign in
            </Link>
          </p>

          <p
            style={{
              margin: '12px 0 0',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: 13,
            }}
          >
            <Link
              to="/onboarding"
              style={{ color: '#6b7280' }}
            >
              Analyze your skin without an account
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}

const googleButton = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  border: '1px solid #d1d5db',
  borderRadius: 9,
  padding: '13px 16px',
  background: '#fff',
  color: '#111827',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const googleIcon = {
  fontSize: 18,
  fontWeight: 800,
};