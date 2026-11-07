import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireAuth, RequireRole } from "./components/Guards";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Courses = lazy(() => import("./pages/Courses"));
const SubjectHub = lazy(() => import("./pages/SubjectHub"));
const Lessons = lazy(() => import("./pages/Lessons"));
const LessonDetail = lazy(() => import("./pages/LessonDetail"));
const SectionDetail = lazy(() => import("./pages/SectionDetail"));
const Collections = lazy(() => import("./pages/Collections"));
const CollectionLessonDetail = lazy(() => import("./pages/CollectionLessonDetail"));
const TestsHub = lazy(() => import("./pages/TestsHub"));
const TestsPage = lazy(() => import("./pages/TestsPage"));
const SimulatorSetup = lazy(() => import("./pages/SimulatorSetup"));
const TeacherTestSetup = lazy(() => import("./pages/TeacherTestSetup"));
const TestRunner = lazy(() => import("./pages/TestRunner"));
const Results = lazy(() => import("./pages/Results"));
const ResultReview = lazy(() => import("./pages/ResultReview"));
const Schedule = lazy(() => import("./pages/Schedule"));
const SmartPlan = lazy(() => import("./pages/SmartPlan"));
const Subscription = lazy(() => import("./pages/Subscription"));
const TeacherPanel = lazy(() => import("./pages/TeacherPanel"));
const TeacherSchedule = lazy(() => import("./pages/TeacherSchedule"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const QuestionEditor = lazy(() => import("./pages/QuestionEditor"));
const Profile = lazy(() => import("./pages/Profile"));
const TelegramCallback = lazy(() => import("./pages/TelegramCallback"));
const About = lazy(() => import("./pages/legal/About"));
const Pricing = lazy(() => import("./pages/legal/Pricing"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const Contact = lazy(() => import("./pages/legal/Contact"));

function PageFallback() {
  return <div className="spinner">جاري التحميل…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/auth/telegram/callback" element={<TelegramCallback />} />

          {/* Public pages required for payment-provider (Stripe) review */}
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/courses" element={<RequireAuth><Courses /></RequireAuth>} />
          <Route path="/courses/:subjectId" element={<RequireAuth><SubjectHub /></RequireAuth>} />
          <Route path="/courses/:subjectId/lessons" element={<RequireAuth><Lessons /></RequireAuth>} />
          <Route path="/courses/:subjectId/collections" element={<RequireAuth><Collections /></RequireAuth>} />
          <Route path="/courses/:subjectId/collections/:lessonId/sub/:subLessonId" element={<RequireAuth><CollectionLessonDetail /></RequireAuth>} />
          <Route path="/courses/:subjectId/collections/:lessonId" element={<RequireAuth><CollectionLessonDetail /></RequireAuth>} />
          <Route path="/lessons/:lessonId" element={<RequireAuth><LessonDetail /></RequireAuth>} />
          <Route path="/sections/:sectionId" element={<RequireAuth><SectionDetail /></RequireAuth>} />

          <Route path="/tests" element={<RequireAuth><TestsPage /></RequireAuth>} />
          <Route path="/tests/simulator" element={<RequireAuth><SimulatorSetup /></RequireAuth>} />
          <Route path="/tests/simulator/:subjectId" element={<RequireAuth><SimulatorSetup /></RequireAuth>} />
          <Route path="/courses/:subjectId/tests" element={<RequireAuth><TestsHub /></RequireAuth>} />
          <Route path="/tests/teacher/:subjectId" element={<RequireAuth><TeacherTestSetup /></RequireAuth>} />
          <Route path="/exam/:examId" element={<RequireAuth><TestRunner /></RequireAuth>} />

          <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
          <Route path="/results/:examId" element={<RequireAuth><ResultReview /></RequireAuth>} />
          <Route path="/schedule" element={<RequireAuth><Schedule /></RequireAuth>} />
          <Route path="/smart-plan" element={<RequireAuth><SmartPlan /></RequireAuth>} />
          <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />

          <Route path="/teacher" element={<RequireRole roles={["teacher", "admin"]}><TeacherPanel /></RequireRole>} />
          <Route path="/teacher/questions" element={<RequireRole roles={["teacher", "admin"]}><QuestionEditor /></RequireRole>} />
          <Route path="/teacher/schedule" element={<RequireRole roles={["teacher", "admin"]}><TeacherSchedule /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminPanel /></RequireRole>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
