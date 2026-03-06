/**
 * CANONICAL: Student Router Aggregator
 * Location: server/src/routes/student/index.js
 * Responsibilities:
 *   - Combines panel + reports routers
 *   - Mounted at /api/student in server/index.js
 *
 * Swagger note:
 *   - This file does NOT define endpoints itself.
 *   - Swagger paths are generated from ./panel.js and ./reports.js annotations.
 */

/**
 * @openapi
 * tags:
 *   - name: Student
 *     description: Student endpoints (mounted under /api/student)
 */

import { Router } from "express";
import panel from "./panel.js";
import reports from "./reports.js";

const router = Router();

router.use(panel);
router.use(reports);

export default router;