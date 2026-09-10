import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  sendEmailVerification,
} from 'firebase/auth';

import { useAuth } from '../context/AuthContext.jsx';
import { auth } from '../services/firebase.js';

export default function VerifyEmailPage() {
  const {
    user,
    refreshVerification,
    logout,
  } = useAuth();

  const navigate = useNavigate();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  /**
   * If there is no Firebase user, send the user back to login.
   */
  useEffect(() => {
    if (!user) {
      navigate('/login', {
        replace: true,
      });
    }
  }, [user, navigate]);

  /**
   * Check whether the user has clicked the verification link.
   */
  const checkVerification = async () => {
    setChecking(true);
    setError('');
    setMessage('');

    try {
      const refreshedUser = await refreshVerification();

      if (!refreshedUser) {
        navigate('/login', {
          replace: true,
        });

        return;
      }

      if (refreshedUser.emailVerified) {
        /**
         * Verification is complete.
         *
         * AuthContext has already synchronized the
         * application profile.
         */
        navigate('/dashboard', {
          replace: true,
        });

        return;
      }

      setError(
        'Your email is not verified yet. Please click the link in the email and try again.',
      );
    } catch (verificationError) {
      console.error(
        'Email verification check failed:',
        verificationError,
      );

      setError(
        'We could not check your verification status. Please try again.',
      );
    } finally {
      setChecking(false);
    }
  };

  /**
   * Resend verification email.
   */
  const resendVerification = async () => {
    if (!auth.currentUser) {
      navigate('/login', {
        replace: true,
      });

      return;
    }

    setResending(true);
    setError('');
    setMessage('');

    try {
      await sendEmailVerification(auth.currentUser);

      setMessage(
        'Verification email sent. Check your inbox and spam folder.',
      );
    } catch (verificationError) {
      console.error(
        'Failed to resend verification email:',
        verificationError,
      );

      if (
        verificationError?.code ===
        'auth/too-many-requests'
      ) {
        setError(
          'Too many emails were requested. Please wait a little before trying again.',
        );
      } else {
        setError(
          verificationError?.message ||
            'Unable to send the verification email.',
        );
      }
    } finally {
      setResending(false);
    }
  };

  /**
   * Log out.
   */
  const handleLogout = async () => {
    try {
      await logout();

      navigate('/login', {
        replace: true,
      });
    } catch {
      setError('Unable to log out. Please try again.');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-8 text-3xl font-semibold tracking-tight">
            skinDecode
            <span className="text-gray-400">.</span>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-8 w-8 text-gray-700"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8.5 12 3l9 5.5v7L12 21l-9-5.5v-7Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m3.5 8.5 8.5 5 8.5-5"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 13.5V21"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900">
              Verify your email
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              We sent a verification link to:
            </p>

            <p className="mt-1 break-all text-sm font-medium text-gray-900">
              {user.email}
            </p>

            <p className="mt-4 text-sm leading-6 text-gray-500">
              Click the link in that email to verify your
              account. Once you've verified it, come back here
              and continue.
            </p>

            {message && (
              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={checkVerification}
                disabled={checking}
                className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checking
                  ? 'Checking...'
                  : "I've verified my email"}
              </button>

              <button
                type="button"
                onClick={resendVerification}
                disabled={resending}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending
                  ? 'Sending...'
                  : 'Resend verification email'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 text-sm text-gray-500 hover:text-gray-900 hover:underline"
            >
              Use a different account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}