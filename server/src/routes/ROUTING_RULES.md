# Routing Rules (Canonical Map)

## Student (ONLY these are canonical)
- Panel / profile / PIN
  - server/src/routes/student/panel.js
  - Endpoints:
    - GET  /api/student/me
    - POST /api/student/pin/change

- Weekly report
  - server/src/routes/student/reports.js
  - Endpoints:
    - GET  /api/student/questions?periodId=...
    - GET  /api/student/report-week?periodId=...&weekNo=...
    - PUT  /api/student/report-week
    - POST /api/student/report-week/submit

- Aggregator
  - server/src/routes/student/index.js
  - Imports ONLY:
    - ./panel.js
    - ./reports.js

- Global mount
  - server/index.js
  - app.use("/api/student", studentRouter)

## Teacher (ONLY these are canonical)
- Panel / attendance / students
  - server/src/routes/teacher/panel.js
  - Endpoints:
    - GET  /api/teacher/me
    - GET  /api/teacher/students
    - PUT  /api/teacher/attendance
    - PUT  /api/teacher/attendance/bulk-theory

- Reports / Evaluation
  - server/src/routes/teacher/reports.js
  - Endpoints:
    - GET  /api/teacher/eval-form-snapshot
    - GET  /api/teacher/eval-form
    - PUT  /api/teacher/eval-item
    - GET  /api/teacher/reports
    - GET  /api/teacher/eval
    - PUT  /api/teacher/eval/upsert

- Report Scores (Coordinator only)
  - server/src/routes/teacher/reportScores.js
  - Endpoints:
    - GET  /api/teacher/report-scores
    - GET  /api/teacher/report-scores/detail
    - PUT  /api/teacher/report-scores/upsert

- Aggregator
  - server/src/routes/teacher/index.js
  - Imports ONLY:
    - ./panel.js
    - ./reports.js
    - ./reportScores.js (mounted under /report-scores)

- Global mount
  - server/index.js
  - app.use("/api/teacher", teacherRouter)

## Admin (ONLY these are canonical)
- Panel / profile
  - server/src/routes/admin/panel.js
  - Endpoints:
    - GET /api/admin/me

- Report Scoring
  - server/src/routes/admin/reportScoring.js
  - Endpoints:
    - GET  /api/admin/report-scoring/list
    - GET  /api/admin/report-scoring/detail
    - PUT  /api/admin/report-scoring/grade

- Aggregator
  - server/src/routes/admin/index.js
  - Imports ONLY:
    - ./panel.js
    - ./reportScoring.js (mounted under /report-scoring)

- Global mount
  - server/index.js
  - app.use("/api/admin", adminRouter)

## Deprecated
Any older role-based routes MUST live under:
- server/src/routes/_deprecated/
Do not mount them in server/index.js.