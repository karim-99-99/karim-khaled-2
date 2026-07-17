import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireAuth, RequireRole } from "./components/Guards";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Courses from "./pages/Courses";
import SubjectHub from "./pages/SubjectHub";
import Lessons from "./pages/Lessons";
import LessonDetail from "./pages/LessonDetail";
import Collections from "./pages/Collections";
import TestsHub from "./pages/TestsHub";
import SimulatorSetup from "./pages/SimulatorSetup";
import TeacherTestSetup from "./pages/TeacherTestSetup";
import TestRunner from "./pages/TestRunner";
import Results from "./pages/Results";
import ResultReview from "./pages/ResultReview";
import Schedule from "./pages/Schedule";
import Subscription from "./pages/Subscription";
import TeacherPanel from "./pages/TeacherPanel";
import TeacherSchedule from "./pages/TeacherSchedule";
import AdminPanel from "./pages/AdminPanel";
import QuestionEditor from "./pages/QuestionEditor";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/courses" element={<RequireAuth><Courses /></RequireAuth>} />
        <Route path="/courses/:subjectId" element={<RequireAuth><SubjectHub /></RequireAuth>} />
        <Route path="/courses/:subjectId/lessons" element={<RequireAuth><Lessons /></RequireAuth>} />
        <Route path="/courses/:subjectId/collections" element={<RequireAuth><Collections /></RequireAuth>} />
        <Route path="/lessons/:lessonId" element={<RequireAuth><LessonDetail /></RequireAuth>} />

        <Route path="/courses/:subjectId/tests" element={<RequireAuth><TestsHub /></RequireAuth>} />
        <Route path="/tests/simulator/:subjectId" element={<RequireAuth><SimulatorSetup /></RequireAuth>} />
        <Route path="/tests/teacher/:subjectId" element={<RequireAuth><TeacherTestSetup /></RequireAuth>} />
        <Route path="/exam/:examId" element={<RequireAuth><TestRunner /></RequireAuth>} />

        <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/results/:examId" element={<RequireAuth><ResultReview /></RequireAuth>} />
        <Route path="/schedule" element={<RequireAuth><Schedule /></RequireAuth>} />
        <Route path="/subscription" element={<RequireAuth><Subscription /></RequireAuth>} />

        <Route path="/teacher" element={<RequireRole roles={["teacher", "admin"]}><TeacherPanel /></RequireRole>} />
        <Route path="/teacher/questions" element={<RequireRole roles={["teacher", "admin"]}><QuestionEditor /></RequireRole>} />
        <Route path="/teacher/schedule" element={<RequireRole roles={["teacher", "admin"]}><TeacherSchedule /></RequireRole>} />
        <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminPanel /></RequireRole>} />
      </Route>
    </Routes>
  );
}
