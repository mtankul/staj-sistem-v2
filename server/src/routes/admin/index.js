/**
 * CANONICAL: Admin Router Aggregator
 * Location: server/src/routes/admin/index.js
 * Responsibilities:
 *   - Combines admin panel + report scoring routers
 *   - Mounted at /api/admin in server/index.js
 *
 * Swagger Tags:
 *   - Admin
 */

import { Router } from "express";

import panel from "./panel.js";
import reportScoring from "./reportScoring.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: Administrative management endpoints
 */

router.use(panel);
router.use("/report-scoring", reportScoring);

export default router;