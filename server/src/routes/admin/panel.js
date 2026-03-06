/**
 * CANONICAL: Admin Panel Routes
 * Location: server/src/routes/admin/panel.js
 * Base: /api/admin
 *
 * Endpoints:
 *  - GET /api/admin/me
 */

import { Router } from "express";

const router = Router();

/* ===============================
   SWAGGER
================================ */

/**
 * @openapi
 * /api/admin/me:
 *   get:
 *     tags: [Admin]
 *     summary: Get current admin profile
 *     description: Returns the authenticated admin user payload from the JWT/session.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not admin)
 */

function getUserType(u) {
  return (u?.role || u?.userType || u?.type || "").toString().toLowerCase();
}

function requireAdmin(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  const t = getUserType(u);
  if (t !== "admin") return res.status(403).json({ error: "Forbidden" });

  next();
}

router.get("/me", requireAdmin, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

export default router;