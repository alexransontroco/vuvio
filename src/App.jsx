import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import { usePageTracking } from './hooks/usePageTracking.ts';
import { initAndroidBackButton } from './platform/androidBack.js';
import { initAppLifecycle } from './platform/appLifecycle.js';
import { initDeepLinks } from './platform/deepLinks.js';
import { initNetworkStatus } from './platform/network.js';
import { initPushNotificationRouting } from './platform/notifications.js';

function ShareLiveRedirect() {
  const { liveId } = useParams();
  const location = useLocation();
  return <Navigate to={`/watch?live=${encodeURIComponent(liveId)}&mode=view${location.search ? `&${location.search.slice(1)}` : ''}`} replace />;
}

function PublicLiveRoute() {
  const { liveId } = useParams();
  const { user, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) return null;
  if (!user) return <Navigate to={`/watch?live=${encodeURIComponent(liveId)}&mode=view${location.search ? `&${location.search.slice(1)}` : ''}`} replace />;
  return <Lazy component={LivePage} />;
}
import ProtectedRoute, { PublicOnlyRoute } from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { isAdminEmail } from './constants/adminEmails.js';

const ConversationPage    = lazy(() => import('./routes/ConversationPage.jsx'));
const WatchPage           = lazy(() => import('./routes/WatchPage.jsx'));
const LivePage            = lazy(() => import('./routes/LivePage.jsx'));
const ExplorePage         = lazy(() => import('./routes/ExplorePage.jsx'));
const AllLivesPage        = lazy(() => import('./routes/AllLivesPage.jsx'));
const AllUpcomingPage     = lazy(() => import('./routes/AllUpcomingPage.jsx'));
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
const GlobeTest4Page      = lazy(() => import('./routes/GlobeTest4Page.jsx'));
const GlobeTest5Page      = lazy(() => import('./routes/GlobeTest5Page.jsx'));
const GlobeTest6Page      = lazy(() => import('./routes/GlobeTest6Page.jsx'));
const GlobeTest7Page      = lazy(() => import('./routes/GlobeTest7Page.jsx'));
const GlobeTest8Page      = lazy(() => import('./routes/GlobeTest8Page.jsx'));
const GlobeCesiumPage     = lazy(() => import('./routes/GlobeCesiumPage.jsx'));
const LoginPage           = lazy(() => import('./routes/LoginPage.jsx'));
const LiveRecapPage       = lazy(() => import('./routes/LiveRecapPageSimple.jsx'));
const LiveSummaryPage     = lazy(() => import('./routes/LiveSummaryPage.jsx'));
const MessagesPage        = lazy(() => import('./routes/MessagesPage.jsx'));
const OnboardingPage      = lazy(() => import('./routes/OnboardingPage.jsx'));
const CommunityGuidelinesPage = lazy(() => import('./routes/CommunityGuidelinesPage.jsx'));
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
const AdminBusinessPage    = lazy(() => import('./routes/AdminBusinessPage.jsx'));
const CreatorStatsPage     = lazy(() => import('./routes/CreatorStatsPage.jsx'));
const PrivacySettingsPage  = lazy(() => import('./routes/PrivacySettingsPage.jsx'));
const DesktopLayout       = lazy(() => import('./components/desktop/DesktopLayout.jsx'));
const AgentsPage          = lazy(() => import('./routes/AgentsPage.jsx'));
const LandingPage         = lazy(() => import('./routes/LandingPage.jsx'));
const NotificationsPage   = lazy(() => import('./routes/NotificationsPage.jsx'));
const NotFoundPage        = lazy(() => import('./routes/NotFoundPage.jsx'));
const IntroPreviewPage    = lazy(() => import('./routes/IntroPreviewPage.jsx'));
const IntroPreviewV1Page  = lazy(() => import('./routes/IntroPreviewV1Page.jsx'));
const StudioPage          = lazy(() => import('./routes/StudioPage.jsx'));

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
  const isAdmin = isLocalDev || isAdminEmail(user?.email);

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
  const navigate = useNavigate();

  useEffect(() => initDeepLinks(navigate), [navigate]);
  useEffect(() => initPushNotificationRouting(navigate), [navigate]);
  useEffect(() => initAndroidBackButton({ navigate, getPath: () => window.location.pathname }), [navigate]);
  useEffect(() => initAppLifecycle(), []);
  useEffect(() => initNetworkStatus(), []);

  return (
    <>
      <PageTracker />
      <Routes>
      {/* ── Public entry sequence ── */}
      <Route path="/" element={<Lazy component={LandingPage} />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />

      {/* ── Public standalone ── */}
      <Route path="/intro-preview" element={<Lazy component={IntroPreviewPage} />} />
      <Route path="/intro-preview-v1" element={<Lazy component={IntroPreviewV1Page} />} />
      <Route path="/vision" element={<Lazy component={VisionPage} />} />
      <Route path="/agents" element={<Lazy component={AgentsPage} />} />
      <Route path="/live/:liveId/summary" element={<Lazy component={LiveSummaryPage} />} />
      <Route path="/live/:liveId/recap" element={<Lazy component={LiveRecapPage} />} />
      <Route path="/desktop" element={<Lazy component={DesktopLayout} />} />
      <Route path="/admin" element={<Navigate to="/admin/docs" replace />} />
      <Route path="/admin/docs" element={<AdminRoute><Lazy component={AdminDocsPage} /></AdminRoute>} />
      <Route path="/admin/business" element={<AdminRoute><Lazy component={AdminBusinessPage} /></AdminRoute>} />
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
        <Route path="/home" element={<Navigate to="/watch" replace />} />
        <Route path="/watch/:liveId" element={<ShareLiveRedirect />} />
        <Route path="/share/live/:liveId" element={<ShareLiveRedirect />} />
        <Route path="/live/:liveId" element={<PublicLiveRoute />} />
        <Route path="/discover" element={<Navigate to="/watch" replace />} />
        <Route path="/discover/:categorySlug" element={<Lazy component={DiscoverCategoryPage} />} />

        {/* Public */}
        <Route path="/watch"         element={<Lazy component={WatchPage} />} />
        <Route path="/explore"      element={<Lazy component={ExplorePage} />} />
        <Route path="/explore/live"     element={<Lazy component={AllLivesPage} />} />
        <Route path="/explore/upcoming" element={<Lazy component={AllUpcomingPage} />} />
        <Route path="/globe"         element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/map"           element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/globe-current" element={<Lazy component={CurrentGlobePage} />} />
        <Route path="/map-current"   element={<Lazy component={CurrentGlobePage} />} />
        <Route path="/globe-test-2"  element={<Lazy component={GlobeTest2Page} />} />
        <Route path="/globe-test-4"  element={<Lazy component={GlobeTest4Page} />} />
        <Route path="/globe-test-5"  element={<Lazy component={GlobeTest5Page} />} />
        <Route path="/globe-test-6"  element={<Lazy component={GlobeTest6Page} />} />
        <Route path="/globe-test-7"  element={<Lazy component={GlobeTest7Page} />} />
        <Route path="/globe-test-8"  element={<Lazy component={GlobeTest8Page} />} />
        <Route path="/globe-cesium"  element={<Lazy component={GlobeCesiumPage} />} />
        <Route path="/terms"       element={<Lazy component={TermsPage} />} />
        <Route path="/privacy"    element={<Lazy component={PrivacyPage} />} />
        <Route path="/guidelines" element={<Lazy component={CommunityGuidelinesPage} />} />
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
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <Lazy component={StudioPage} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio/:liveId"
          element={
            <ProtectedRoute>
              <Lazy component={StudioPage} />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Lazy component={NotFoundPage} />} />
      </Route>
    </Routes>
    </>
  );
}
