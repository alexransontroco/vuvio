import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { useAuth } from './context/AuthContext.jsx';

const ConversationPage    = lazy(() => import('./routes/ConversationPage.jsx'));
const WatchPage           = lazy(() => import('./routes/WatchPage.jsx'));
const LivePage            = lazy(() => import('./routes/LivePage.jsx'));
const ExplorePage         = lazy(() => import('./routes/ExplorePage.jsx'));
const AllLivesPage        = lazy(() => import('./routes/AllLivesPage.jsx'));
const DiscoverFeedPage    = lazy(() => import('./routes/DiscoverFeedPage.jsx'));
const EditProfilePage     = lazy(() => import('./routes/EditProfilePage.jsx'));
const EquipmentManagePage = lazy(() => import('./routes/EquipmentManagePage.jsx'));
const ProfileGearPage     = lazy(() => import('./routes/ProfileGearPage.jsx'));
const ForgotPasswordPage  = lazy(() => import('./routes/ForgotPasswordPage.jsx'));
const HelpPage            = lazy(() => import('./routes/HelpPage.jsx'));
const InternalStreamAdminPage = lazy(() => import('./routes/InternalStreamAdminPage.jsx'));
const CurrentGlobePage    = lazy(() => import('./routes/CurrentGlobePage.jsx'));
const GlobeLabPage        = lazy(() => import('./routes/GlobeLabPage.jsx'));
const GlobeTestPage       = lazy(() => import('./routes/GlobeTestPage.jsx'));
const GlobeTest2Page      = lazy(() => import('./routes/GlobeTest2Page.jsx'));
const GlobeTest3Page      = lazy(() => import('./routes/GlobeTest3Page.jsx'));
const GlobeCesiumPage     = lazy(() => import('./routes/GlobeCesiumPage.jsx'));
const IconsPreviewPage    = lazy(() => import('./routes/IconsPreviewPage.jsx'));
const LoginPage           = lazy(() => import('./routes/LoginPage.jsx'));
const LiveRecapPage       = lazy(() => import('./routes/LiveRecapPage.jsx'));
const LiveSummaryPage     = lazy(() => import('./routes/LiveSummaryPage.jsx'));
const MessagesPage        = lazy(() => import('./routes/MessagesPage.jsx'));
const OnboardingPage      = lazy(() => import('./routes/OnboardingPage.jsx'));
const OnboardingTestPage  = lazy(() => import('./routes/OnboardingTestPage.jsx'));
const PrivacyPage         = lazy(() => import('./routes/PrivacyPage.jsx'));
const ProfilePage         = lazy(() => import('./routes/ProfilePage.jsx'));
const ReportProblemPage   = lazy(() => import('./routes/ReportProblemPage.jsx'));
const SettingsPage        = lazy(() => import('./routes/SettingsPage.jsx'));
const SignupPage          = lazy(() => import('./routes/SignupPage.jsx'));
const VerifyEmailPage     = lazy(() => import('./routes/VerifyEmailPage.jsx'));
const TermsPage           = lazy(() => import('./routes/TermsPage.jsx'));
const VisionPage          = lazy(() => import('./routes/VisionPage.jsx'));
const SocialDemoPage      = lazy(() => import('./routes/SocialDemoPage.jsx'));
const TestUsersPage       = lazy(() => import('./routes/TestUsersPage.jsx'));
const FollowingPage       = lazy(() => import('./routes/FollowingPage.jsx'));
const AnalyticsPage       = lazy(() => import('./routes/AnalyticsPage.jsx'));
const DesktopLayout       = lazy(() => import('./components/desktop/DesktopLayout.jsx'));
const SplashTestPage      = lazy(() => import('./routes/SplashTestPage.jsx'));
const CloudflareTestPage  = lazy(() => import('./routes/CloudflareTestPage.jsx'));
const AgentsPage          = lazy(() => import('./routes/AgentsPage.jsx'));

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
  const { showSplash } = useAuth();
  const location = useLocation();

  if (showSplash && location.pathname === '/') {
    return <SplashScreen />;
  }

  return (
    <Routes>
      {/* ── Public standalone ── */}
      <Route path="/vision" element={<Lazy component={VisionPage} />} />
      <Route path="/agents" element={<Lazy component={AgentsPage} />} />
      <Route path="/live/:liveId/summary" element={<Lazy component={LiveSummaryPage} />} />
      <Route path="/live/:liveId/recap" element={<Lazy component={LiveRecapPage} />} />
      <Route path="/test/live-recap" element={<Lazy component={LiveRecapPage} />} />
      <Route path="/desktop" element={<Lazy component={DesktopLayout} />} />
      <Route path="/cloudflare-test" element={<Lazy component={CloudflareTestPage} />} />
      <Route path="/onboarding-test" element={<Lazy component={OnboardingTestPage} />} />
      <Route path="/test/splash" element={<SplashTestPage />} />

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
        path="/verify-email"
        element={
          <Suspense fallback={<RouteFallback />}>
            <VerifyEmailPage />
          </Suspense>
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
        <Route index element={<Navigate to="/watch" replace />} />
        <Route path="/home" element={<Navigate to="/watch" replace />} />
        <Route path="/watch/:liveId" element={<Navigate to="/watch" replace />} />
        <Route path="/live/:liveId" element={<ProtectedRoute requireOnboarding={false}><Lazy component={LivePage} /></ProtectedRoute>} />
        <Route path="/discover" element={<Lazy component={DiscoverFeedPage} />} />

        {/* Public */}
        <Route path="/watch"         element={<Lazy component={WatchPage} />} />
        <Route path="/explore"      element={<Lazy component={ExplorePage} />} />
        <Route path="/explore/live" element={<Lazy component={AllLivesPage} />} />
        <Route path="/globe"        element={<Lazy component={CurrentGlobePage} />} />
        <Route path="/map"          element={<Lazy component={CurrentGlobePage} />} />
        <Route path="/globe-lab"    element={<Lazy component={GlobeLabPage} />} />
        <Route path="/globe-test"   element={<Lazy component={GlobeTestPage} />} />
        <Route path="/globe-test-2" element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/globe-test-3" element={<Lazy component={GlobeTest3Page} />} />
        <Route path="/globe-cesium" element={<Lazy component={GlobeCesiumPage} />} />
        <Route path="/terms"      element={<Lazy component={TermsPage} />} />
        <Route path="/privacy"    element={<Lazy component={PrivacyPage} />} />
        <Route path="/help"       element={<Lazy component={HelpPage} />} />
        <Route path="/icons"      element={<Lazy component={IconsPreviewPage} />} />
        <Route path="/demo/social" element={<Lazy component={SocialDemoPage} />} />
        <Route path="/test/users" element={<Lazy component={TestUsersPage} />} />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <Lazy component={AnalyticsPage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/internal/streams"
          element={
            <ProtectedRoute>
              <Lazy component={InternalStreamAdminPage} />
            </ProtectedRoute>
          }
        />

        {/* Public creator profiles */}
        <Route
          path="/profile/following"
          element={
            <ProtectedRoute>
              <Lazy component={FollowingPage} />
            </ProtectedRoute>
          }
        />
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
          path="/profile/gear"
          element={
            <ProtectedRoute>
              <Lazy component={ProfileGearPage} />
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

        <Route path="*" element={<Navigate to="/watch" replace />} />
      </Route>
    </Routes>
  );
}
