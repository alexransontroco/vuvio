import { lazy, Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import { usePageTracking } from './hooks/usePageTracking.ts';

function ShareLiveRedirect() {
  const { liveId } = useParams();
  return <Navigate to={`/watch?live=${encodeURIComponent(liveId)}&mode=view`} replace />;
}
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { useAuth } from './context/AuthContext.jsx';

const ConversationPage    = lazy(() => import('./routes/ConversationPage.jsx'));
const WatchPage           = lazy(() => import('./routes/WatchPage.jsx'));
const LivePage            = lazy(() => import('./routes/LivePage.jsx'));
const ExplorePage         = lazy(() => import('./routes/ExplorePage.jsx'));
const AllLivesPage        = lazy(() => import('./routes/AllLivesPage.jsx'));
const DiscoverFeedPage    = lazy(() => import('./routes/DiscoverFeedPage.jsx'));
const DiscoverCategoryPage = lazy(() => import('./routes/DiscoverCategoryPage.jsx'));
const EditProfilePage     = lazy(() => import('./routes/EditProfilePage.jsx'));
const EquipmentManagePage = lazy(() => import('./routes/EquipmentManagePage.jsx'));
const ProfileGearPage     = lazy(() => import('./routes/ProfileGearPage.jsx'));
const ForgotPasswordPage  = lazy(() => import('./routes/ForgotPasswordPage.jsx'));
const HelpPage            = lazy(() => import('./routes/HelpPage.jsx'));
const InternalStreamAdminPage = lazy(() => import('./routes/InternalStreamAdminPage.jsx'));
const CurrentGlobePage    = lazy(() => import('./routes/CurrentGlobePage.jsx'));
const GlobeTest2Page      = lazy(() => import('./routes/GlobeTest2Page.jsx'));
const GlobeTest3Page      = lazy(() => import('./routes/GlobeTest3Page.jsx'));
const LoginPage           = lazy(() => import('./routes/LoginPage.jsx'));
const LiveRecapPage       = lazy(() => import('./routes/LiveRecapPageSimple.jsx'));
const LiveSummaryPage     = lazy(() => import('./routes/LiveSummaryPage.jsx'));
const MessagesPage        = lazy(() => import('./routes/MessagesPage.jsx'));
const OnboardingPage      = lazy(() => import('./routes/OnboardingPage.jsx'));
const PrivacyPage         = lazy(() => import('./routes/PrivacyPage.jsx'));
const ProfilePage         = lazy(() => import('./routes/ProfilePage.jsx'));
const ReportProblemPage   = lazy(() => import('./routes/ReportProblemPage.jsx'));
const SettingsPage        = lazy(() => import('./routes/SettingsPage.jsx'));
const SignupPage          = lazy(() => import('./routes/SignupPage.jsx'));
const VerifyEmailPage     = lazy(() => import('./routes/VerifyEmailPage.jsx'));
const TermsPage           = lazy(() => import('./routes/TermsPage.jsx'));
const VisionPage          = lazy(() => import('./routes/VisionPage.jsx'));
const FollowingPage       = lazy(() => import('./routes/FollowingPage.jsx'));
const AnalyticsPage       = lazy(() => import('./routes/AnalyticsPage.jsx'));
const AdminDocsPage       = lazy(() => import('./routes/AdminDocsPage.jsx'));
const AdminInvestorCrmPage = lazy(() => import('./routes/AdminInvestorCrmPage.jsx'));
const AdminMarketingPage   = lazy(() => import('./routes/AdminMarketingPage.jsx'));
const CreatorStatsPage     = lazy(() => import('./routes/CreatorStatsPage.jsx'));
const PrivacySettingsPage  = lazy(() => import('./routes/PrivacySettingsPage.jsx'));
const DesktopLayout       = lazy(() => import('./components/desktop/DesktopLayout.jsx'));
const AgentsPage          = lazy(() => import('./routes/AgentsPage.jsx'));
const NotificationsPage   = lazy(() => import('./routes/NotificationsPage.jsx'));
const NotFoundPage        = lazy(() => import('./routes/NotFoundPage.jsx'));

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

function AdminRoute({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(hostname);
  const isAdmin = isLocalDev
    || user?.email?.endsWith('@vuvio.app')
    || user?.email === 'alexandre.ranson@gmail.com'
    || user?.email === 'doug.benchetrit@gmail.com'
    || user?.email === 'cecilia.ranson@outlook.com';

  if (authLoading && !isLocalDev) return null;
  if (!user && !isLocalDev) return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  if (!isAdmin) return <Navigate to="/watch" replace />;

  return children;
}

// Preload primary route chunks after app boots
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    import('./routes/WatchPage.jsx');
    import('./routes/GlobeTest2Page.jsx');
  }, { once: true });
}

function PageTracker() {
  usePageTracking();
  return null;
}

export default function App() {
  const { showSplash } = useAuth();
  const location = useLocation();
  const initialPath = useRef(location.pathname);

  return (
    <>
      <PageTracker />
      {showSplash && initialPath.current === '/' && <SplashScreen />}
      <Routes>
      {/* ── Public standalone ── */}
      <Route path="/vision" element={<Lazy component={VisionPage} />} />
      <Route path="/agents" element={<Lazy component={AgentsPage} />} />
      <Route path="/live/:liveId/summary" element={<Lazy component={LiveSummaryPage} />} />
      <Route path="/live/:liveId/recap" element={<Lazy component={LiveRecapPage} />} />
      <Route path="/desktop" element={<Lazy component={DesktopLayout} />} />
      <Route path="/admin" element={<Navigate to="/admin/docs" replace />} />
      <Route path="/admin/docs" element={<AdminRoute><Lazy component={AdminDocsPage} /></AdminRoute>} />
      <Route path="/admin/investor-crm" element={<AdminRoute><Lazy component={AdminInvestorCrmPage} /></AdminRoute>} />
      <Route path="/admin/marketing" element={<AdminRoute><Lazy component={AdminMarketingPage} /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><Lazy component={AnalyticsPage} /></AdminRoute>} />

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
        <Route path="/share/live/:liveId" element={<ShareLiveRedirect />} />
        <Route path="/live/:liveId" element={<ProtectedRoute requireOnboarding={false}><Lazy component={LivePage} /></ProtectedRoute>} />
        <Route path="/discover" element={<Navigate to="/watch" replace />} />
        <Route path="/discover/:categorySlug" element={<Lazy component={DiscoverCategoryPage} />} />

        {/* Public */}
        <Route path="/watch"         element={<Lazy component={WatchPage} />} />
        <Route path="/explore"      element={<Lazy component={ExplorePage} />} />
        <Route path="/explore/live" element={<Lazy component={AllLivesPage} />} />
        <Route path="/globe"         element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/map"           element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/globe-current" element={<Lazy component={CurrentGlobePage} />} />
        <Route path="/map-current"   element={<Lazy component={CurrentGlobePage} />} />
        <Route path="/globe-test-2"  element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/globe-test-3"  element={<Lazy component={GlobeTest3Page} />} />
        <Route path="/terms"      element={<Lazy component={TermsPage} />} />
        <Route path="/privacy"    element={<Lazy component={PrivacyPage} />} />
        <Route path="/help"       element={<Lazy component={HelpPage} />} />
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
        <Route
          path="/profile/stats"
          element={
            <ProtectedRoute>
              <Lazy component={CreatorStatsPage} />
            </ProtectedRoute>
          }
        />
        <Route path="/profile/:creatorId" element={<Lazy component={ProfilePage} />} />
        <Route path="/@:creatorId" element={<Lazy component={ProfilePage} />} />

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
          path="/settings/privacy"
          element={
            <ProtectedRoute>
              <Lazy component={PrivacySettingsPage} />
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
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Lazy component={NotificationsPage} />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Lazy component={NotFoundPage} />} />
      </Route>
    </Routes>
    </>
  );
}
