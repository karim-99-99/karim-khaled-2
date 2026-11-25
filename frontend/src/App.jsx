import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireAuth, RequireGold, RequireRole } from "./components/Guards";

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
const Subscription = lazy(() => import("./pages/Subscription"));
const TeacherPanel = lazy(() => import("./pages/TeacherPanel"));
const TeacherTasks = lazy(() => import("./pages/TeacherTasks"));
const DailyTasks = lazy(() => import("./pages/DailyTasks"));
const TeacherSchedule = lazy(() => import("./pages/TeacherSchedule"));
const TeacherAvailability = lazy(() => import("./pages/TeacherAvailability"));
const TeacherStudents = lazy(() => import("./pages/TeacherStudents"));
const StudentReports = lazy(() => import("./pages/StudentReports"));
const RateClass = lazy(() => import("./pages/RateClass"));
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
          <Route path="/tests/teacher/:subjectId" element={<RequireAuth><RequireRole roles={["teacher", "admin"]}><TeacherTestSetup /></RequireRole></RequireAuth>} />
          <Route path="/exam/:examId" element={<RequireAuth><TestRunner /></RequireAuth>} />

          <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
          <Route path="/results/:examId" element={<RequireAuth><ResultReview /></RequireAuth>} />
          <Route path="/schedule" element={<RequireAuth><RequireGold><Schedule /></RequireGold></RequireAuth>} />
          <Route path="/daily-tasks" element={<RequireAuth><RequireGold><DailyTasks /></RequireGold></RequireAuth>} />
          <Route path="/smart-plan" element={<Navigate to="/" replace />} />
          <Route path="/smart-plan/*" element={<Navigate to="/" replace />} />
          <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />

          <Route path="/teacher" element={<RequireRole roles={["teacher", "admin"]}><TeacherPanel /></RequireRole>} />
          <Route path="/teacher/tasks" element={<RequireRole roles={["teacher", "admin"]}><TeacherTasks /></RequireRole>} />
          <Route path="/teacher/students" element={<RequireRole roles={["teacher", "admin"]}><TeacherStudents /></RequireRole>} />
          <Route path="/teacher/students/:studentId/reports" element={<RequireRole roles={["teacher", "admin"]}><StudentReports /></RequireRole>} />
          <Route path="/teacher/sessions/:sessionId/rate" element={<RequireRole roles={["teacher", "admin"]}><RateClass /></RequireRole>} />
          <Route path="/teacher/questions" element={<RequireRole roles={["teacher", "admin"]}><QuestionEditor /></RequireRole>} />
          <Route path="/teacher/schedule" element={<RequireRole roles={["teacher", "admin"]}><TeacherSchedule /></RequireRole>} />
          <Route path="/teacher/availability" element={<RequireRole roles={["teacher", "admin"]}><TeacherAvailability /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminPanel /></RequireRole>} />
        </Route>
      </Routes>
    </Suspense>
  );
}
