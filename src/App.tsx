import { AlertCircle } from "lucide-react";
import { lazy } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "./contexts/AuthContext";
import { useFeature } from "./hooks/useFeatureFlags";

const HomeView = lazy(() => import("./views/HomeView"));
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

import { AdminGuard } from "./components/AdminGuard";
import { AdminLayout } from "./components/AdminLayout";
import { AuthGuard } from "./components/AuthGuard";

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

import { CookieConsent } from "./components/CookieConsent";
import { GlobalToastListener } from "./components/GlobalToastListener";
import { OfflineBanner } from "./components/OfflineBanner";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { AppShell } from './components/layout/AppShell';
import { AuthModalTrigger } from './components/layout/AuthModalTrigger';
import { FeatureGatingBlocks } from './components/layout/FeatureGatingBlocks';
import { PublicLayout } from './components/layout/PublicLayout';
import { RouteMetaHelper } from './components/layout/RouteMetaHelper';
const PricingView = lazy(() => import("./views/PricingView"));






















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
          </Route>

          {/* LOCKED ADMINISTRATIVE AREA */}
          <Route element={<AdminGuard><AdminLayout /></AdminGuard>}>
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
            <Route path="/admin/blog" element={<BlogManager />} />
            <Route path="/admin/notifications" element={<NotificationsManager />} />
          </Route>

          {/* AUTHENTICATED APP ROUTES (With App Shell) */}
          <Route element={<AuthGuard><AppShell /></AuthGuard>}>
            <Route path="/today" element={<TodayView />} />
            <Route path="/modules" element={<ModulesView />} />
            <Route path="/topic/:id" element={<TopicView />} />
            <Route path="/mock-exams" element={<MockExamsView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/bookmarks" element={<BookmarksView />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/referral" element={<ReferralView />} />
            <Route path="/quiz/:topicId" element={<QuizView />} />
            <Route path="*" element={<NotFoundView />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
