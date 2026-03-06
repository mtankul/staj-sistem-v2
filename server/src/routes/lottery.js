import { Router } from "express";
import { prisma } from "../prisma.js";

const router = Router();

const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normSexEK(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "e" || s === "erkek" || s === "m" || s === "male") return "E";
  if (s === "k" || s === "kadın" || s === "kadin" || s === "f" || s === "female") return "K";
  return null;
}

function getRules(period) {
  const r = period?.lotteryRules || {};
  return {
    rot2PreferDifferentDay: !!r.rot2PreferDifferentDay,
    rot2PreferDifferentHospital: !!r.rot2PreferDifferentHospital,
    fallbackPreferHospitalDifferent: !!r.fallbackPreferHospitalDifferent,
  };
}

function allowedDays(period) {
  const d = period?.practiceDays;
  if (Array.isArray(d) && d.length) {
    return DAY_ORDER.filter((x) => d.includes(x));
  }
  return ["MON", "TUE", "WED", "THU", "FRI"];
}

/** quota + gender check (unit/day bazında) */
function canPlace({ student, unit, dayOfWeek, capMap }) {
  const ug = normSexEK(unit.genderRule);
  const us = normSexEK(student.sex);
  if (ug && us && ug !== us) return { ok: false, reason: "gender" };

  const quota = Number(unit.dailyQuota ?? 0);
  if (quota > 0) {
    const k = `${dayOfWeek}__${unit.id}`;
    const used = capMap.get(k) || 0;
    if (used >= quota) return { ok: false, reason: "quota" };
  }

  return { ok: true };
}

/** hospital-day load map: hospitalId__day => count */
function hdKey(hospitalId, dayOfWeek) {
  return `${hospitalId}__${dayOfWeek}`;
}

/** Önceliği BOZMADAN shuffle: aynı (hospitalPriority, unitPriority) grubunun içinde karıştır */
function stableShuffleWithinPriority(units, rand) {
  // units zaten orderBy ile (hospital.priorityOrder, unit.priorityOrder, name) geliyor
  const groups = [];
  let cur = [];
  let lastKey = null;

  for (const u of units) {
    const k = `${u.hospital?.priorityOrder ?? 999}__${u.priorityOrder ?? 999}`;
    if (lastKey === null || k === lastKey) {
      cur.push(u);
    } else {
      groups.push({ key: lastKey, items: cur });
      cur = [u];
    }
    lastKey = k;
  }
  if (cur.length) groups.push({ key: lastKey, items: cur });

  const out = [];
  for (const g of groups) {
    out.push(...shuffle(g.items, rand));
  }
  return out;
}

/** unit pool */
async function buildUnitPool(rand) {
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: { hospital: true },
    orderBy: [
      { hospital: { priorityOrder: "asc" } },
      { priorityOrder: "asc" },
      { name: "asc" },
    ],
  });

  // ✅ öncelikleri koru, sadece aynı öncelik grubunda karıştır
  return stableShuffleWithinPriority(units, rand);
}

/** Rot2 skoru + dengeleme */
function scoreRot2({ rules, rot1, candidate }) {
  let score = 0;

  if (rules.rot2PreferDifferentHospital && rot1) {
    if (candidate.hospitalId !== rot1.hospitalId) score += 20;
  }
  if (rules.rot2PreferDifferentDay && rot1) {
    if (candidate.dayOfWeek !== rot1.dayOfWeek) score += 10;
  }

  if (rot1 && rules.fallbackPreferHospitalDifferent) {
    const hd = candidate.hospitalId !== rot1.hospitalId;
    const dd = candidate.dayOfWeek !== rot1.dayOfWeek;
    if (hd && dd) score += 100;
    else if (hd) score += 50;
    else if (dd) score += 10;
  }

  // öncelik desteği
  score += Math.max(0, 20 - Number(candidate.hospitalPriority || 99));
  score += Math.max(0, 10 - Number(candidate.unitPriority || 99));

  return score;
}

/** Rot1 için “en iyi aday” seçimi:
 * (hospitalPriority, unitPriority, hospitalDayLoad) minimize eder
 * Böylece aynı hastanede günler dengelenir.
 */
function pickBestCandidateRot1({ candidates }) {
  // candidates: {dayOfWeek, unit, hospitalPriority, unitPriority, hospitalDayLoad}
  candidates.sort((a, b) => {
    if (a.hospitalPriority !== b.hospitalPriority) return a.hospitalPriority - b.hospitalPriority;
    if (a.unitPriority !== b.unitPriority) return a.unitPriority - b.unitPriority;
    if (a.hospitalDayLoad !== b.hospitalDayLoad) return a.hospitalDayLoad - b.hospitalDayLoad;
    return 0;
  });
  return candidates[0] || null;
}

async function generate(periodId, opts) {
  const seed = Number(opts.seed ?? Date.now());
  const rand = mulberry32(seed);

  const period = await prisma.period.findUnique({ where: { id: String(periodId) } });
  if (!period) throw new Error("Dönem bulunamadı");

  const rules = getRules(period);
  const days = allowedDays(period);
  const rotationCount = Number(period.rotationCount ?? 1);

  // öğrenciler (kura etkisi)
  let students = await prisma.student.findMany({
    where: { periodId: String(periodId) },
    orderBy: { studentNo: "asc" },
  });
  students = shuffle(students, rand);

  // birimler
  const unitPool = await buildUnitPool(rand);

  // preview plan
  const plan = [];

  // capacity maps (unit/day bazında)
  const cap1 = new Map();
  const cap2 = new Map();

  // hospital-day load (hastane/gün bazında) → gün dengeleme için
  const hd1 = new Map(); // hospitalId__day => count
  const hd2 = new Map();

  /* =========================
     ROT1
  ========================= */
  if (opts.includeRot1) {
    for (const s of students) {
      const candidates = [];

      for (const unit of unitPool) {
        const hospitalPriority = unit.hospital?.priorityOrder ?? 999;
        const unitPriority = unit.priorityOrder ?? 999;

        for (const dayOfWeek of days) {
          const ok = canPlace({ student: s, unit, dayOfWeek, capMap: cap1 });
          if (!ok.ok) continue;

          const load = hd1.get(hdKey(unit.hospitalId, dayOfWeek)) || 0;

          candidates.push({
            dayOfWeek,
            unit,
            hospitalId: unit.hospitalId,
            unitId: unit.id,
            hospitalPriority,
            unitPriority,
            hospitalDayLoad: load,
          });
        }
      }

      if (!candidates.length) {
        plan.push({ periodId, studentId: s.id, rotationNo: 1, error: "Rot1: Uygun kontenjan bulunamadı" });
        continue;
      }

      const pick = pickBestCandidateRot1({ candidates });

      // commit
      const k = `${pick.dayOfWeek}__${pick.unitId}`;
      cap1.set(k, (cap1.get(k) || 0) + 1);

      const hk = hdKey(pick.hospitalId, pick.dayOfWeek);
      hd1.set(hk, (hd1.get(hk) || 0) + 1);

      plan.push({
        periodId,
        studentId: s.id,
        rotationNo: 1,
        dayOfWeek: pick.dayOfWeek,
        hospitalId: pick.hospitalId,
        unitId: pick.unitId,
        method: "LOTTERY",
      });
    }
  }

  /* =========================
     ROT2
  ========================= */
  if (rotationCount >= 2 && opts.includeRot2) {
    // rot1 map
    const rot1Map = new Map();
    const previewRot1 = plan.filter((x) => x.rotationNo === 1 && !x.error);
    if (previewRot1.length) {
      for (const a of previewRot1) rot1Map.set(a.studentId, a);
    } else {
      const dbRot1 = await prisma.studentAssignment.findMany({
        where: { periodId: String(periodId), rotationNo: 1 },
        select: { studentId: true, dayOfWeek: true, hospitalId: true, unitId: true },
      });
      for (const a of dbRot1) rot1Map.set(a.studentId, a);
    }

    const rulesOn =
      rules.rot2PreferDifferentDay ||
      rules.rot2PreferDifferentHospital ||
      rules.fallbackPreferHospitalDifferent;

    for (const s of students) {
      const rot1 = rot1Map.get(s.id) || null;

      const candidates = [];
      for (const unit of unitPool) {
        const hospitalPriority = unit.hospital?.priorityOrder ?? 999;
        const unitPriority = unit.priorityOrder ?? 999;

        for (const dayOfWeek of days) {
          const ok = canPlace({ student: s, unit, dayOfWeek, capMap: cap2 });
          if (!ok.ok) continue;

          const base = {
            dayOfWeek,
            hospitalId: unit.hospitalId,
            unitId: unit.id,
            hospitalPriority,
            unitPriority,
          };

          const baseScore = rulesOn ? scoreRot2({ rules, rot1, candidate: base }) : 0;

          // ✅ gün dengeleme: aynı hastanede o gün ne kadar doluysa o kadar “ceza”
          const load = hd2.get(hdKey(unit.hospitalId, dayOfWeek)) || 0;

          candidates.push({
            ...base,
            score: baseScore - load * 2, // yük arttıkça skoru düşür → dengeler
            hospitalDayLoad: load,
          });
        }
      }

      if (!candidates.length) {
        plan.push({ periodId, studentId: s.id, rotationNo: 2, error: "Rot2: Uygun kontenjan bulunamadı" });
        continue;
      }

      // yüksek skor + eşitlikte öncelik + dayLoad
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.hospitalPriority !== b.hospitalPriority) return a.hospitalPriority - b.hospitalPriority;
        if (a.unitPriority !== b.unitPriority) return a.unitPriority - b.unitPriority;
        if (a.hospitalDayLoad !== b.hospitalDayLoad) return a.hospitalDayLoad - b.hospitalDayLoad;
        return 0;
      });

      const pick = candidates[0];

      // commit
      const k = `${pick.dayOfWeek}__${pick.unitId}`;
      cap2.set(k, (cap2.get(k) || 0) + 1);

      const hk = hdKey(pick.hospitalId, pick.dayOfWeek);
      hd2.set(hk, (hd2.get(hk) || 0) + 1);

      plan.push({
        periodId,
        studentId: s.id,
        rotationNo: 2,
        dayOfWeek: pick.dayOfWeek,
        hospitalId: pick.hospitalId,
        unitId: pick.unitId,
        method: "LOTTERY",
      });
    }
  }

  return { period, rules, days, plan, seed };
}

/* =========================
   PREVIEW
========================= */
// POST /api/lottery/preview { periodId, includeRot1=true, includeRot2=true, seed? }
router.post("/preview", async (req, res) => {
  try {
    const { periodId, includeRot1 = true, includeRot2 = true, seed } = req.body || {};
    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

    const out = await generate(String(periodId), { includeRot1, includeRot2, seed });
    res.json({ ok: true, seed: out.seed, rules: out.rules, days: out.days, plan: out.plan });
  } catch (e) {
    res.status(500).json({ error: e.message || "preview hata" });
  }
});

/* =========================
   APPLY
========================= */
// POST /api/lottery/apply { periodId, includeRot1=true, includeRot2=true, replace=true, seed? }
router.post("/apply", async (req, res) => {
  try {
    const { periodId, includeRot1 = true, includeRot2 = true, replace = true, seed } = req.body || {};
    if (!periodId) return res.status(400).json({ error: "periodId zorunlu" });

    if (replace) {
      const rotList = [];
      if (includeRot1) rotList.push(1);
      if (includeRot2) rotList.push(2);
      await prisma.studentAssignment.deleteMany({
        where: { periodId: String(periodId), rotationNo: { in: rotList } },
      });
    }

    const out = await generate(String(periodId), { includeRot1, includeRot2, seed });

    const good = out.plan.filter((x) => !x.error);
    const bad = out.plan.filter((x) => x.error);

    if (good.length) {
      await prisma.studentAssignment.createMany({
        data: good.map((x) => ({
          periodId: x.periodId,
          studentId: x.studentId,
          rotationNo: x.rotationNo,
          dayOfWeek: x.dayOfWeek,
          hospitalId: x.hospitalId,
          unitId: x.unitId,
          method: "LOTTERY",
        })),
      });
    }

    res.json({ ok: true, seed: out.seed, inserted: good.length, errors: bad });
  } catch (e) {
    res.status(500).json({ error: e.message || "apply hata" });
  }
});

export default router;