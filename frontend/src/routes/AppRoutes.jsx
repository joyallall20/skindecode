import { Routes, Route } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute.jsx';
import AdminRoute from './AdminRoute.jsx';

import TermsPage from '../legal/TermsPage.jsx';
import PrivacyPolicyPage from '../legal/PrivacyPolicyPage.jsx';
import AffiliateDisclosurePage from '../legal/AffiliateDisclosurePage.jsx';
import VerifyEmailPage from '../pages/VerifyEmailPage.jsx';

// Skin Routine is imported directly
import SkinRoutinePage from '../pages/SkinRoutinePage.jsx';

import {
  LandingPage,
  LoginPage,
  SignupPage,
  OnboardingPage,
  DashboardPage,
  ProductsPage,
  ProductDetailPage,
  ProfilePage,
  ChatPage,

  // Admin pages
  AdminDashboardPage,
  AdminAddProductPage,
  AdminProductEditPage,
  AdminProductsPage,
  AdminImportsPage,
  AdminProductDetailPage,
  AdminImportDetailPage,
  AdminIntelligenceTestPage,
  AdminKnowledgePage,
} from '../pages/index.js';


const AppRoutes = () => {
  return (
    <Routes>

      {/* =========================
          PUBLIC ROUTES
      ========================= */}

      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/verify-email"
        element={<VerifyEmailPage />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/signup"
        element={<SignupPage />}
      />

      {/* Skin questionnaire */}
      <Route
        path="/onboarding"
        element={<OnboardingPage />}
      />

      {/* Products */}
      <Route
        path="/products"
        element={<ProductsPage />}
      />

      {/* Skin Routine - Coming Soon */}
      <Route
        path="/skin-routine"
        element={<SkinRoutinePage />}
      />

      {/* Product Detail */}
      <Route
        path="/products/:id"
        element={<ProductDetailPage />}
      />

      {/* =========================
          LEGAL ROUTES
      ========================= */}

      <Route
        path="/terms"
        element={<TermsPage />}
      />

      <Route
        path="/privacy"
        element={<PrivacyPolicyPage />}
      />

      <Route
        path="/affiliate-disclosure"
        element={<AffiliateDisclosurePage />}
      />

      {/* =========================
          PROTECTED USER ROUTES
      ========================= */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />

      {/* =========================
          ADMIN ROUTES
      ========================= */}

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/products"
        element={
          <AdminRoute>
            <AdminProductsPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/products/add"
        element={
          <AdminRoute>
            <AdminAddProductPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/products/:id/edit"
        element={
          <AdminRoute>
            <AdminProductEditPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/products/:id"
        element={
          <AdminRoute>
            <AdminProductDetailPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/intelligence-test"
        element={
          <AdminRoute>
            <AdminIntelligenceTestPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/knowledge"
        element={
          <AdminRoute>
            <AdminKnowledgePage />
          </AdminRoute>
        }
      />

      {/* =========================
          PRODUCT IMPORTS
      ========================= */}

      <Route
        path="/admin/product-imports"
        element={
          <AdminRoute>
            <AdminImportsPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/product-imports/:id"
        element={
          <AdminRoute>
            <AdminImportDetailPage />
          </AdminRoute>
        }
      />

      {/* =========================
          BACKWARDS-COMPATIBLE
          IMPORT ROUTES
      ========================= */}

      <Route
        path="/admin/imports"
        element={
          <AdminRoute>
            <AdminImportsPage />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/imports/:id"
        element={
          <AdminRoute>
            <AdminImportDetailPage />
          </AdminRoute>
        }
      />

      {/* =========================
          FALLBACK
      ========================= */}

      <Route
        path="*"
        element={<LandingPage />}
      />

    </Routes>
  );
};

export default AppRoutes;