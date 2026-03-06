# Client Routing Rules (Canonical Map)

## 0) Global
- Entry:
  - client/src/main.jsx
  - Renders: <AppConfigProvider><App/></AppConfigProvider>

- App Router (ONLY canonical)
  - client/src/App.jsx
  - Routes:
    - /login              -> <LoginHubAntd />
    - /admin/*            -> <AdminShell /> + AdminRoutes()
    - /teacher/*          -> <TeacherShell /> + TeacherRoutes()
    - /student/*          -> <StudentShell /> + StudentRoutes()
  - Auth gate:
    - RequireAuth reads ONLY from:
      - client/src/utils/authStorage.js (getToken/getUserType)

## 1) Admin (canonical)
- Shell:
  - client/src/shells/AdminShell.jsx
  - MUST:
    - Render <Outlet />
    - Provide Outlet context:
      - { periods, hospitals, periodId, setPeriodId, reloadCommon }
    - Handle logout via clearAuth()

- Routes (ONLY canonical):
  - client/src/routes/admin.routes.jsx
  - Route list:
    - /admin                      -> Dashboard
    - /admin/courses              -> Courses
    - /admin/periods              -> Periods
    - /admin/hospitals            -> Hospitals
    - /admin/students             -> Students
    - /admin/units                -> Units
    - /admin/teachers             -> Teachers (via TeachersRoute + useOutletContext)
    - /admin/assignments          -> Assignments
    - /admin/lottery              -> Lottery
    - /admin/scoring              -> Scoring
    - /admin/evaluation           -> EvaluationSetup
    - /admin/eval-templates       -> EvalTemplates
    - /admin/report-setup         -> ReportSetup
    - /admin/report-templates     -> ReportTemplates
    - /admin/report-scoring       -> ReportScoring
    - /admin/settings             -> Settings

## 2) Teacher (canonical)
- Shell:
  - client/src/shells/TeacherShell.jsx
  - MUST:
    - Render <Outlet />
    - Fetch /teacher/me on load
    - Show coordinator-only menu item based on me.isCoordinator
    - Logout via clearAuth()

- Routes (ONLY canonical):
  - client/src/routes/teacher.routes.jsx
  - Route list:
    - /teacher                -> TeacherDashboard
    - /teacher/scoring        -> TeacherScoring
    - /teacher/report-scoring -> TeacherReportScoring (UI may hide menu if not coordinator)

## 3) Student (canonical)
- Shell:
  - client/src/shells/StudentShell.jsx
  - MUST:
    - Render <Outlet />
    - Fetch /student/me on load
    - Enforce PIN change modal if me.mustChangePin === true
    - Logout via clearAuth()

- Routes (ONLY canonical):
  - client/src/routes/student.routes.jsx
  - Route list:
    - /student          -> StudentDashboard
    - /student/report   -> StudentWeeklyReport

## 4) Auth Storage (canonical)
- Location:
  - client/src/utils/authStorage.js
- Canonical keys:
  - token:
    - accessToken OR token OR access_token (read)
  - user type:
    - userType OR user_type (read)
- Logout MUST clear all known variants.

## 5) Deprecated / Old client routing
Any old routing logic MUST be moved under:
- client/src/_deprecated/
and MUST NOT be imported by App.jsx or any Shell.

## 6) Coding Rules
- App.jsx:
  - MUST NOT import pages directly (except Login)
  - MUST import ONLY shells + route aggregators (routes/*.routes.jsx)
- Shells:
  - MUST NOT define <Route> trees
  - MUST render <Outlet />
- routes/*.routes.jsx:
  - MUST define the route trees only
  - May use wrapper components (TeachersRoute) to consume Outlet context