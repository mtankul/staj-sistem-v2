import { prisma } from "../prisma.js";

export async function seedSystemSettings() {
  const defaults = [
    {
      key: "grading_weights",
      value: {
        reportWeight: 50,
        observerWeight: 50,
        rot1Weight: 0.4,
        rot2Weight: 0.6,
      },
    },
    {
      key: "absence_rules",
      value: {
        practicePenalty: 5,
        theoryPenalty: 2.5,
        autoFailActive: false,
        failThresholdWeeks: null,
      },
    },
    {
      key: "lottery_defaults",
      value: {
        rot2PreferDifferentDay: false,
        rot2PreferDifferentHospital: true,
        fallbackPreferHospitalDifferent: true,
      },
    },
  ];

  for (const d of defaults) {
    await prisma.systemSetting.upsert({
      where: { key: d.key },
      update: {}, // varsa dokunma
      create: { key: d.key, value: d.value },
    });
  }
}