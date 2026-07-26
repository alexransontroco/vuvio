import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx';

const ConversationPage    = lazy(() => import('./routes/ConversationPage.jsx'));
const HomePage            = lazy(() => import('./routes/HomePage.jsx'));
const HomeDiscoverFeed    = lazy(() => import('./routes/HomePage.jsx').then((m) => ({ default: m.HomeDiscoverFeed })));
const ExplorePage         = lazy(() => import('./routes/ExplorePage.jsx'));
const EditProfilePage     = lazy(() => import('./routes/EditProfilePage.jsx'));
const EquipmentManagePage = lazy(() => import('./routes/EquipmentManagePage.jsx'));
const ForgotPasswordPage  = lazy(() => import('./routes/ForgotPasswordPage.jsx'));
const HelpPage            = lazy(() => import('./routes/HelpPage.jsx'));
const GlobeLabPage        = lazy(() => import('./routes/GlobeLabPage.jsx'));
const GlobeTestPage       = lazy(() => import('./routes/GlobeTestPage.jsx'));
const IconsPreviewPage    = lazy(() => import('./routes/IconsPreviewPage.jsx'));
const LoginPage           = lazy(() => import('./routes/LoginPage.jsx'));
const LiveRecapPage       = lazy(() => import('./routes/LiveRecapPage.jsx'));
const MessagesPage        = lazy(() => import('./routes/MessagesPage.jsx'));
const OnboardingPage      = lazy(() => import('./routes/OnboardingPage.jsx'));
const PrivacyPage         = lazy(() => import('./routes/PrivacyPage.jsx'));
const ProfilePage         = lazy(() => import('./routes/ProfilePage.jsx'));
const ReportProblemPage   = lazy(() => import('./routes/ReportProblemPage.jsx'));
const SettingsPage        = lazy(() => import('./routes/SettingsPage.jsx'));
const SignupPage           = lazy(() => import('./routes/SignupPage.jsx'));
const TermsPage           = lazy(() => import('./routes/TermsPage.jsx'));
const VisionPage          = lazy(() => import('./routes/VisionPage.jsx'));

function RouteFallback() {
  const { t } = useTranslation();
  return (
    <div className="route-fallback" role="status" aria-live="polite" aria-label={t('common.loading')}>
      <span />
    </div>
  );
}

function Lazy({ component: Component }) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ── Public standalone ── */}
      <Route path="/vision" element={<Lazy component={VisionPage} />} />
      <Route path="/live/:liveId/recap" element={<Lazy component={LiveRecapPage} />} />
      <Route path="/test/live-recap" element={<Lazy component={LiveRecapPage} />} />

      {/* ── Auth pages (redirect if already logged in) ── */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Suspense fallback={<RouteFallback />}>
              <LoginPage />
            </Suspense>
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Suspense fallback={<RouteFallback />}>
              <SignupPage />
            </Suspense>
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <Suspense fallback={<RouteFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        }
      />

      {/* ── Onboarding (requires auth, skips onboarding guard) ── */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requireOnboarding={false}>
            <Suspense fallback={<RouteFallback />}>
              <OnboardingPage />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* ── App shell with bottom nav ── */}
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="/live" element={<Navigate to="/home" replace />} />
        <Route path="/watch" element={<Navigate to="/home" replace />} />
        <Route path="/home/:liveId" element={<Navigate to="/home" replace />} />
        <Route path="/discover" element={<Navigate to="/home" replace />} />

        {/* Public */}
        <Route path="/home"    element={<Lazy component={HomePage} />} />
        <Route path="/explore"  element={<Lazy component={HomeDiscoverFeed} />} />
        <Route path="/globe"      element={<Suspense fallback={<RouteFallback />}><GlobeTestPage mode="actual" /></Suspense>} />
        <Route path="/map"        element={<Suspense fallback={<RouteFallback />}><GlobeTestPage mode="actual" /></Suspense>} />
        <Route path="/globe-lab"  element={<Lazy component={GlobeLabPage} />} />
        <Route path="/globe-test" element={<Lazy component={GlobeTestPage} />} />
        <Route path="/terms"      element={<Lazy component={TermsPage} />} />
        <Route path="/privacy"    element={<Lazy component={PrivacyPage} />} />
        <Route path="/help"       element={<Lazy component={HelpPage} />} />
        <Route path="/icons"      element={<Lazy component={IconsPreviewPage} />} />

        {/* Public creator profiles */}
        <Route path="/profile/:creatorId" element={<Lazy component={ProfilePage} />} />

        {/* Protected */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Lazy component={ProfilePage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <Lazy component={EditProfilePage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/equipment"
          element={
            <ProtectedRoute>
              <Lazy component={EquipmentManagePage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Lazy component={MessagesPage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoute>
              <Lazy component={ConversationPage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Lazy component={SettingsPage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report-problem"
          element={
            <ProtectedRoute>
              <Lazy component={ReportProblemPage} />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}
