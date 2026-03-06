import React from "react";
import { Route, useOutletContext } from "react-router-dom";

import Dashboard from "../pages/Dashboard.jsx";
import Courses from "../pages/Courses.jsx";
import Periods from "../pages/Periods.jsx";
import Hospitals from "../pages/Hospitals.jsx";
import Students from "../pages/Students.jsx";
import Units from "../pages/Units.jsx";
import Assignments from "../pages/Assignments.jsx";
import Lottery from "../pages/Lottery.jsx";
import Settings from "../pages/Settings.jsx";
import Teachers from "../pages/Teachers.jsx";
import Scoring from "../pages/Scoring.jsx";

import EvaluationSetup from "../pages/EvaluationSetup.jsx";
import EvalTemplates from "../pages/EvalTemplates.jsx";

import ReportSetup from "../pages/ReportSetup.jsx";
import ReportTemplates from "../pages/ReportTemplates.jsx";
import ReportScoring from "../pages/ReportScoring.jsx";

function TeachersRoute() {
  const { periods, hospitals, periodId, setPeriodId, reloadCommon } = useOutletContext();

  return (
    <Teachers
      periodId={periodId}
      setPeriodId={setPeriodId}
      periods={periods}
      hospitals={hospitals}
      reloadCommon={reloadCommon}
    />
  );
}

/**
 * CANONICAL: Admin route fragments
 * Used under: <Route path="/admin/*" element={<AdminShell/>}> ...here... </Route>
 */
export function AdminRoutes() {
  return (
    <>
      <Route index element={<Dashboard />} />

      <Route path="courses" element={<Courses />} />
      <Route path="periods" element={<Periods />} />
      <Route path="hospitals" element={<Hospitals />} />
      <Route path="students" element={<Students />} />
      <Route path="units" element={<Units />} />

      <Route path="assignments" element={<Assignments />} />
      <Route path="lottery" element={<Lottery />} />

      <Route path="teachers" element={<TeachersRoute />} />

      <Route path="scoring" element={<Scoring />} />

      <Route path="evaluation" element={<EvaluationSetup />} />
      <Route path="eval-templates" element={<EvalTemplates />} />

      <Route path="report-setup" element={<ReportSetup />} />
      <Route path="report-templates" element={<ReportTemplates />} />
      <Route path="report-scoring" element={<ReportScoring />} />

      <Route path="settings" element={<Settings />} />
    </>
  );
}