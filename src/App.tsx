import { AlertCircle } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "./contexts/AuthContext";
import { useFeature } from "./hooks/useFeatureFlags";
import { PreviewModeProvider } from "./preview/PreviewModeProvider";
import { defaultFlags } from "./hooks/useFeatureFlags";

// Landing route is eager (not lazy): it's the LCP/entry page, so lazy-loading it
// only adds a chunk round-trip and a Suspense skeleton->content swap that caused
// a large layout shift (CLS ~0.96). Static import keeps it in the entry bundle.
import HomeView from "./views/HomeView";
const ModulesView = lazy(() => import("./views/ModulesView"));
const MockExamsView = lazy(() => import("./views/MockExamsView"));
const AnalyticsView = lazy(() => import("./views/AnalyticsView"));
const AboutView = lazy(() => import("./views/AboutView"));
const QuizView = lazy(() => import("./views/QuizView"));
const TopicView = lazy(() => import("./views/TopicView"));
const BookmarksView = lazy(() => import("./views/BookmarksView"));
const ProfileView = lazy(() => import("./views/ProfileView"));
const NotFoundView = lazy(() => import("./views/NotFoundView"));
const TodayView = lazy(() => import("./views/TodayView"));
const ResetPasswordView = lazy(() => import("./views/ResetPasswordView"));
const PrivacyView = lazy(() => import("./views/PrivacyView"));
const TermsView = lazy(() => import("./views/TermsView"));
const RefundView = lazy(() => import("./views/RefundView"));
const ContactView = lazy(() => import("./views/ContactView"));
const ExamsSeoView = lazy(() => import("./views/ExamsSeoView"));
const BlogListView = lazy(() => import("./views/BlogListView"));
const BlogPostView = lazy(() => import("./views/BlogPostView"));
const QotdView = lazy(() => import("./views/QotdView"));
const ReferralView = lazy(() => import("./views/ReferralView"));
const A320SystemsView = lazy(() => import("./views/A320SystemsView"));
const StudySchedulerView = lazy(() => import("./views/StudySchedulerView"));
const StudyCalendarView = lazy(() => import("./views/schedule/StudyCalendarView"));

import { AdminGuard } from "./components/AdminGuard";
import { AuthGuard } from "./components/AuthGuard";
// AppShell (authed) and AdminLayout (admin) are never on the public/landing
// critical path, but were statically imported into the entry chunk. Lazy them
// so their trees (sidebar, widgets, notifications, admin nav) leave the entry
// bundle and load only when an authed/admin route mounts.
const AdminLayout = lazy(() => import("./components/AdminLayout").then(m => ({ default: m.AdminLayout })));

const AdminDashboard = lazy(() => import("./views/admin/AdminDashboard"));
const SubjectsManager = lazy(() => import("./views/admin/SubjectsManager"));
const ExamsManager = lazy(() => import("./views/admin/ExamsManager"));
const SubcategoriesManager = lazy(() => import("./views/admin/SubcategoriesManager"));
const QuestionsManager = lazy(() => import("./views/admin/QuestionsManager"));
const BulkImport = lazy(() => import("./views/admin/BulkImport"));
const UsersAnalytics = lazy(() => import("./views/admin/UsersAnalytics"));
const AdminActivity = lazy(() => import("./views/admin/AdminActivity"));
const AdminSettings = lazy(() => import("./views/admin/AdminSettings"));
const FeatureControl = lazy(() => import("./views/admin/FeatureControl"));
const BlogManager = lazy(() => import("./views/admin/BlogManager"));
const NotificationsManager = lazy(() => import("./views/admin/NotificationsManager"));
const RolesManager = lazy(() => import("./views/admin/RolesManager"));
const PricingManager = lazy(() => import("./views/admin/PricingManager"));
const SiteContentManager = lazy(() => import("./views/admin/SiteContentManager"));
const AiSettingsManager = lazy(() => import("./views/admin/AiSettingsManager"));
const FunnelAnalytics = lazy(() => import("./views/admin/FunnelAnalytics"));
const BillingManager = lazy(() => import("./views/admin/BillingManager"));
const FeaturePreviewRoute = lazy(() => import("./views/admin/FeaturePreviewRoute"));
const ExamCentreView = lazy(() => import("./views/ExamCentreView"));

import { CookieConsent } from "./components/CookieConsent";
import { GlobalToastListener } from "./components/GlobalToastListener";
import { OfflineBanner } from "./components/OfflineBanner";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { AuthModalTrigger } from './components/layout/AuthModalTrigger';
import { FeatureGatingBlocks } from './components/layout/FeatureGatingBlocks';
import { LoadingFallback } from './components/layout/LoadingFallback';
import { PublicLayout } from './components/layout/PublicLayout';
import { RouteMetaHelper } from './components/layout/RouteMetaHelper';
const AppShell = lazy(() => import('./components/layout/AppShell').then(m => ({ default: m.AppShell })));
const PricingView = lazy(() => import("./views/PricingView"));






















// Handles the /login deep link. Logged-out users see the home page with the
// sign-in modal opened; logged-in users are routed into the app so the URL
// never lands on the catch-all 404.
function LoginRoute() {
  const { user, openAuthModal } = useAuth();
  useEffect(() => {
    if (!user) openAuthModal("signin");
  }, [user, openAuthModal]);
  if (user) return <Navigate to="/today" replace />;
  return <HomeView />;
}

export default function App() {
  const maintenanceMode = useFeature("maintenanceMode");
  const { userData } = useAuth();

  if (maintenanceMode && userData?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="p-8 max-w-md text-center bg-paper border border-rule-strong rounded-xl shadow-sm">
          <AlertCircle className="w-12 h-12 text-muted-2 mx-auto mb-4" />
          <h1 className="text-xl font-serif text-ink mb-2">Scheduled Maintenance</h1>
          <p className="text-muted text-sm">
            Our systems are currently undergoing required maintenance. We will be back online shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <FeatureGatingBlocks />
      <RouteMetaHelper />
      <AuthModalTrigger />
      <CookieConsent />
      <GlobalToastListener />
      <PwaInstallPrompt />
      <OfflineBanner />
      <ErrorBoundary>
        <Routes>
          {/* PUBLIC ROUTES (No App Shell) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomeView />} />
            {/* /login: open the auth modal over home when logged out; once
                authenticated, send to the app instead of 404-ing on /login. */}
            <Route path="/login" element={<LoginRoute />} />
            {/* Common bookmark/alias → real authenticated home. */}
            <Route path="/dashboard" element={<Navigate to="/today" replace />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/pricing" element={<PricingView />} />
            <Route path="/reset-password" element={<ResetPasswordView />} />
            <Route path="/privacy" element={<PrivacyView />} />
            <Route path="/terms" element={<TermsView />} />
            <Route path="/refund" element={<RefundView />} />
            <Route path="/contact" element={<ContactView />} />
            <Route path="/exams/:examId" element={<ExamsSeoView />} />
            <Route path="/blog" element={<BlogListView />} />
            <Route path="/blog/:slug" element={<BlogPostView />} />
            <Route path="/qotd" element={<QotdView />} />
            <Route path="/a320-systems" element={<A320SystemsView />} />
            {/* Catch-all 404 lives in the PUBLIC layout so logged-out users and
                crawlers reach the real NotFound page. Inside AuthGuard it was
                trapped behind a misleading "Session Expired" redirect. */}
            <Route path="*" element={<NotFoundView />} />
          </Route>

          {/* LOCKED ADMINISTRATIVE AREA */}
          <Route element={<AdminGuard><Suspense fallback={<LoadingFallback />}><AdminLayout /></Suspense></AdminGuard>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/subjects" element={<SubjectsManager />} />
            <Route path="/admin/exams" element={<ExamsManager />} />
            <Route path="/admin/subcategories" element={<SubcategoriesManager />} />
            <Route path="/admin/questions" element={<QuestionsManager />} />
            <Route path="/admin/import" element={<BulkImport />} />
            <Route path="/admin/users" element={<UsersAnalytics />} />
            <Route path="/admin/activity" element={<AdminActivity />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/features" element={<FeatureControl />} />
            <Route
              path="/admin/features/preview/:featureKey"
              element={
                <PreviewModeProvider draftFlags={defaultFlags}>
                  <FeaturePreviewRoute />
                </PreviewModeProvider>
              }
            />
            <Route path="/admin/blog" element={<BlogManager />} />
            <Route path="/admin/notifications" element={<NotificationsManager />} />
            <Route path="/admin/roles" element={<RolesManager />} />
            <Route path="/admin/pricing" element={<PricingManager />} />
            <Route path="/admin/site-content" element={<SiteContentManager />} />
            <Route path="/admin/ai-settings" element={<AiSettingsManager />} />
            <Route path="/admin/funnel" element={<FunnelAnalytics />} />
            <Route path="/admin/billing" element={<BillingManager />} />
          </Route>

          {/* AUTHENTICATED APP ROUTES (With App Shell) */}
          <Route element={<AuthGuard><Suspense fallback={<LoadingFallback />}><AppShell /></Suspense></AuthGuard>}>
            <Route path="/today" element={<TodayView />} />
            <Route path="/modules" element={<ModulesView />} />
            <Route path="/topic/:id" element={<TopicView />} />
            <Route path="/mock-exams" element={<MockExamsView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/bookmarks" element={<BookmarksView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/referral" element={<ReferralView />} />
            <Route path="/study-plan" element={<StudySchedulerView />} />
            <Route path="/schedule" element={<StudyCalendarView />} />
            <Route path="/exam-centre" element={<ExamCentreView />} />
          </Route>

          {/* FULLSCREEN QUIZ (authed, NO App Shell — each quiz layout is its
              own full-viewport takeover with its own header/footer. Nesting it
              inside AppShell double-stacked the chrome, pushed the footer below
              the fold, and broke the immersive cockpit theme.) */}
          <Route
            path="/quiz/:topicId"
            element={
              <AuthGuard>
                <Suspense fallback={<LoadingFallback />}>
                  <QuizView />
                </Suspense>
              </AuthGuard>
            }
          />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
