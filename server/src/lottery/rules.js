export function getLotteryRules(period) {
  const r = period?.lotteryRules || {};
  return {
    rot2PreferDifferentDay: !!r.rot2PreferDifferentDay,
    rot2PreferDifferentHospital: !!r.rot2PreferDifferentHospital,
    fallbackPreferHospitalDifferent: r.fallbackPreferHospitalDifferent !== false, // seçili değilse false olacak
  };
}