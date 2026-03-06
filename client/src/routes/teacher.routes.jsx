import React from "react";
import { Route } from "react-router-dom";

import TeacherDashboard from "../pages/TeacherDashboard.jsx";
import TeacherScoring from "../pages/TeacherScoring.jsx";
import TeacherReportScoring from "../pages/TeacherReportScoring.jsx";

/**
 * CANONICAL: Teacher route fragments
 * Used under: <Route path="/teacher/*" element={<TeacherShell/>}> ...here... </Route>
 *
 * Note:
 * - /teacher/report-scoring UI menüde sadece koordinatör görür.
 * - Server tarafı da coordinator check yapmalı.
 */
export function TeacherRoutes() {
  return (
    <>
      <Route index element={<TeacherDashboard />} />
      <Route path="scoring" element={<TeacherScoring />} />
      <Route path="report-scoring" element={<TeacherReportScoring />} />
    </>
  );
}