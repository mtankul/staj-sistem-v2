import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const router = Router();

/**
 * Hem yeni hem eski env ismini destekleyelim:
 * - tercih: JWT_ACCESS_SECRET
 * - fallback: JWT_SECRET
 */
function getJwtSecret() {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
}

function signAccessToken(payload) {
  const secret = getJwtSecret();
  if (!secret) throw new Error("JWT secret missing (JWT_ACCESS_SECRET or JWT_SECRET)");
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

/**
 * Eski kodda verifyPin util vardı; burada direkt bcrypt ile doğruluyoruz.
 * (pinHash null/undefined ise false döner)
 */
async function verifyPin(pin, pinHash) {
  if (!pinHash) return false;
  return bcrypt.compare(String(pin), String(pinHash));
}

/** admin login: identifier -> username */
async function loginAdmin(identifier, pin) {
  const u = await prisma.user.findUnique({
    where: { username: String(identifier).trim() },
    select: { id: true, pinHash: true, role: true, isActive: true },
  });

  if (!u || !u.isActive || u.role !== "ADMIN") return null;

  const ok = await verifyPin(pin, u.pinHash);
  if (!ok) return { error: "PIN hatalı", code: 401 };

  const access_token = signAccessToken({ type: "admin", userId: u.id, role: "ADMIN" });

  return {
    ok: true,
    access_token,
    user_type: "admin",
    // geriye uyum:
    accessToken: access_token,
    userType: "admin",
  };
}

/** student login: identifier -> username (default studentNo) */
async function loginStudent(identifier, pin) {
  const s = await prisma.student.findFirst({
    where: { username: String(identifier).trim() },
    select: { id: true, pinHash: true, periodId: true, mustChangePin: true },
  });

  if (!s) return null;

  const ok = await verifyPin(pin, s.pinHash);
  if (!ok) return { error: "PIN hatalı", code: 401 };

  const access_token = signAccessToken({
    type: "student",
    studentId: s.id,
    role: "STUDENT",
    periodId: s.periodId ?? null,
  });

  return {
    ok: true,
    access_token,
    user_type: "student",
    mustChangePin: !!s.mustChangePin,
    // geriye uyum:
    accessToken: access_token,
    userType: "student",
  };
}

/** teacher login: identifier -> phone */
async function loginTeacher(identifier, pin) {
  const t = await prisma.teacher.findFirst({
    where: { phone: String(identifier).trim(), isActive: true },
    select: { id: true, pinHash: true, isCoordinator: true, isObserver: true, isResponsible: true },
  });

  if (!t) return null;

  const ok = await verifyPin(pin, t.pinHash);
  if (!ok) return { error: "PIN hatalı", code: 401 };

  const access_token = signAccessToken({
    type: "teacher",
    teacherId: t.id,
    role: "OBSERVER",
    flags: {
      isCoordinator: !!t.isCoordinator,
      isObserver: !!t.isObserver,
      isResponsible: !!t.isResponsible,
    },
  });

  return {
    ok: true,
    access_token,
    user_type: "teacher",
    // geriye uyum:
    accessToken: access_token,
    userType: "teacher",
  };
}

/**
 * POST /api/auth/login
 * Yeni kullanım:
 *  { type:"admin"|"student"|"teacher", identifier, pin }
 *
 * Eski kullanım (geriye uyum):
 *  { username, pin }
 */
router.post("/login", async (req, res) => {
  try {
    const body = req.body || {};

    // yeni format
    let type = body.type;
    let identifier = body.identifier;

    // eski format
    if (!type && !identifier && body.username) {
      identifier = body.username;
    }

    const pin = body.pin;

    if (!identifier || !pin) {
      return res.status(400).json({ error: "identifier/username ve pin zorunlu" });
    }

    // 1) type verilmişse direkt o rol
    if (type) {
      if (type === "admin") {
        const r = await loginAdmin(identifier, pin);
        if (!r) return res.status(401).json({ error: "Admin kullanıcı bulunamadı / pasif" });
        if (r.error) return res.status(r.code || 401).json({ error: r.error });
        return res.json(r);
      }

      if (type === "student") {
        const r = await loginStudent(identifier, pin);
        if (!r) return res.status(401).json({ error: "Öğrenci bulunamadı" });
        if (r.error) return res.status(r.code || 401).json({ error: r.error });
        return res.json(r);
      }

      if (type === "teacher") {
        const r = await loginTeacher(identifier, pin);
        if (!r) return res.status(401).json({ error: "Gözlemci bulunamadı / pasif" });
        if (r.error) return res.status(r.code || 401).json({ error: r.error });
        return res.json(r);
      }

      return res.status(400).json({ error: "Geçersiz type" });
    }

    // 2) type yoksa (eski client): sırayla dene
    // Önce admin -> sonra student -> sonra teacher
    let r = await loginAdmin(identifier, pin);
    if (r) {
      if (r.error) return res.status(r.code || 401).json({ error: r.error });
      return res.json(r);
    }

    r = await loginStudent(identifier, pin);
    if (r) {
      if (r.error) return res.status(r.code || 401).json({ error: r.error });
      return res.json(r);
    }

    r = await loginTeacher(identifier, pin);
    if (r) {
      if (r.error) return res.status(r.code || 401).json({ error: r.error });
      return res.json(r);
    }

    return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  } catch (e) {
    console.error("AUTH /login error:", e);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;