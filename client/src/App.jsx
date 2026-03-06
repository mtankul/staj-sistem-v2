//\client\src/App.jsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginHubAntd from "./pages/LoginHubAntd.jsx";

import AdminShell from "./shells/AdminShell.jsx";
import TeacherShell from "./shells/TeacherShell.jsx";
import StudentShell from "./shells/StudentShell.jsx";

import { getToken, getUserType } from "./utils/authStorage";

import { AdminRoutes } from "./routes/admin.routes.jsx";
import { TeacherRoutes } from "./routes/teacher.routes.jsx";
import { StudentRoutes } from "./routes/student.routes.jsx";

function RequireAuth({ children, userType }) {
  const token = getToken();
  const type = (getUserType() || "").toLowerCase();
  const need = (userType || "").toLowerCase();

  if (!token) return <Navigate to="/login" replace />;
  if (need && type !== need) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginHubAntd />} />

        {/* ADMIN */}
        <Route
          path="/admin/*"
          element={
            <RequireAuth userType="admin">
              <AdminShell />
            </RequireAuth>
          }
        >
          {AdminRoutes()}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* STUDENT */}
        <Route
          path="/student/*"
          element={
            <RequireAuth userType="student">
              <StudentShell />
            </RequireAuth>
          }
        >
          {StudentRoutes()}
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Route>

        {/* TEACHER */}
        <Route
          path="/teacher/*"
          element={
            <RequireAuth userType="teacher">
              <TeacherShell />
            </RequireAuth>
          }
        >
          {TeacherRoutes()}
          <Route path="*" element={<Navigate to="/teacher" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}