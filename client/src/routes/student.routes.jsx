//\client\src\routes/student.routes.jsx

import React from "react";
import { Route } from "react-router-dom";

import StudentDashboard from "../pages/StudentDashboard.jsx";
import StudentWeeklyReport from "../pages/StudentWeeklyReport.jsx";

/**
 * CANONICAL: Student route fragments
 * Used under: <Route path="/student/*" element={<StudentShell/>}> ...here... </Route>
 */
export function StudentRoutes() {
  return (
    <>
      <Route index element={<StudentDashboard />} />
      <Route path="report" element={<StudentWeeklyReport />} />
    </>
  );
}