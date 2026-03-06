// server/src/middleware/auth.js
import jwt from "jsonwebtoken";

/** Token'ı header veya cookie'den çek */
function getToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);

  // cookie ile geliyorsa (axios credentials: true + server cookieParser)
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  if (req.cookies?.token) return req.cookies.token;

  return null;
}

/** payload içinden userType/type normalize et */
function getUserType(payload) {
  const t = payload?.userType ?? payload?.type ?? payload?.role;
  return (t || "").toString().toLowerCase();
}

/** payload içinden teacherId normalize et */
function getTeacherId(payload) {
  return payload?.teacherId ?? payload?.id ?? payload?.userId ?? null;
}

/** JWT varsa req.user doldurur, yoksa next() */
export function authOptional(req, res, next) {
  const token = getToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // normalize ederek set edelim
    const userType = getUserType(payload);
    const teacherId = getTeacherId(payload);

    req.user = {
      ...payload,
      userType,   // normalize edilmiş
      teacherId,  // normalize edilmiş
    };
  } catch (e) {
    req.user = null;
  }

  next();
}

/** Herhangi bir kullanıcı gerekir */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

/** Teacher gerekir */
export function requireTeacher(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "Unauthorized" });

  // normalize userType üzerinden kontrol
  if ((u.userType || "").toLowerCase() !== "teacher") {
    // Debug için çok işe yarar:
    console.log("[requireTeacher] Forbidden. payload =", u);
    return res.status(403).json({ error: "Forbidden (not teacher)" });
  }

  if (!u.teacherId) {
    console.log("[requireTeacher] teacherId missing. payload =", u);
    return res.status(401).json({ error: "teacherId missing in token" });
  }

  next();
}