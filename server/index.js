// staj-sistem-v2/server/index.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ✅ swagger
import { setupSwagger } from "./src/swagger.js";

// ✅ auth middleware
import { authOptional, requireTeacher } from "./src/middleware/auth.js";

// ✅ routers (core)
import coursesRouter from "./src/routes/courses.js";
import periodsRouter from "./src/routes/periods.js";
import hospitalsRouter from "./src/routes/hospitals.js";
import studentsRouter from "./src/routes/students.js";
import unitsRouter from "./src/routes/units.js";
import assignmentsRouter from "./src/routes/assignments.js";
import lotteryRouter from "./src/routes/lottery.js";
import settingsRouter from "./src/routes/settings.js";
import hospitalContactsRouter from "./src/routes/hospitalContacts.js";
import scoringRouter from "./src/routes/scoring.js";
import authRoutes from "./src/routes/auth.js";

import systemSettingsRoutes from "./src/routes/systemSettings.js";
import evalTemplates from "./src/routes/evalTemplates.js";
import periodEval from "./src/routes/periodEval.js";
import reportTemplatesRouter from "./src/routes/reportTemplates.js";
import periodReportRouter from "./src/routes/periodReport.js";

// ✅ role-based routers
import studentRouter from "./src/routes/student/index.js";
import teacherRouter from "./src/routes/teacher/index.js";
import adminRouter from "./src/routes/admin/index.js";

// ✅ Teachers CRUD (admin ekranı kullanıyor: /api/teachers)
import teachersRouter from "./src/routes/teachers.js";

// ✅ seed
import { seedSystemSettings } from "./src/seed/settingsSeed.js";
import { seedAdminUser } from "./src/seed/seedAdminUser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ .env dosyasını server klasöründen KESİN yükle
dotenv.config({ path: path.join(__dirname, ".env") });

// (İstersen 1 kez kontrol yazdır — sonra silebilirsin)
console.log("[env-check]", {
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  HAS_DB: !!process.env.DATABASE_URL,
  HAS_ACCESS_SECRET: !!process.env.JWT_ACCESS_SECRET,
});

const app = express();

/* =========================
   ✅ CACHE / ETAG KAPAT
========================= */
app.disable("etag");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/* =========================
   MIDDLEWARES
========================= */
app.use(helmet());
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

/* =========================
   ✅ AUTH OPTIONAL (JWT varsa req.user doldur)
   ROUTE'LARDAN ÖNCE OLMASI ÖNEMLİ
========================= */
app.use(authOptional);

/* =========================
   HEALTH
========================= */
/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: API health check
 *     responses:
 *       200:
 *         description: OK
 */
app.get("/api/health", (req, res) => res.json({ ok: true }));

/* =========================
   ROUTES (CORE)
========================= */
app.use("/api/auth", authRoutes);

app.use("/api/courses", coursesRouter);
app.use("/api/periods", periodsRouter);
app.use("/api/hospitals", hospitalsRouter);
app.use("/api/students", studentsRouter);
app.use("/api/units", unitsRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/lottery", lotteryRouter);

app.use("/api/settings", settingsRouter);
app.use("/api", hospitalContactsRouter);

app.use("/api/scoring", scoringRouter);

app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/eval-templates", evalTemplates);
app.use("/api/period-eval", periodEval);

app.use("/api/report-templates", reportTemplatesRouter);
app.use("/api/period-report", periodReportRouter);

/* =========================
   ✅ ROUTES (ROLE-BASED)
========================= */
app.use("/api/student", studentRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/admin", adminRouter);

/* =========================
   ✅ Teachers CRUD (admin ekranı)
========================= */
app.use("/api/teachers", teachersRouter);

/* =========================
   ✅ Swagger (en sona yakın dursun)
========================= */
setupSwagger(app);

/* =========================
   ✅ Teacher panel route (korumalı test)
========================= */
app.get("/api/teacher/me", requireTeacher, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

/* =========================
   STARTUP (SEED + LISTEN)
========================= */
async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      await seedAdminUser();
      console.log("✅ Admin user seeded (non-production).");
    } else {
      console.log("ℹ️ Production mode: admin seed skipped.");
    }

    await seedSystemSettings();
    console.log("✅ System settings seeded.");

    const port = process.env.PORT || 4000;
    app.listen(port, () => console.log("🚀 API running on", port));
  } catch (err) {
    console.error("❌ Startup error:", err);
    process.exit(1);
  }
}

startServer();