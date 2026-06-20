exports.computeSafetyScore = ({ date = new Date(), isKnownSafeZone = false, womenSafetyMode = false }) => {
  let score = 75;
  const hour = date.getHours();
  if (hour >= 6 && hour < 20) score += 10;
  if (hour >= 23 || hour < 5) score -= 15;
  if (isKnownSafeZone) score += 5;
  if (womenSafetyMode && (hour >= 23 || hour < 5)) score -= 5;
  return Math.max(0, Math.min(100, score));
};

exports.computeRiskLevel = (score) => {
  if (score > 75) return 'LOW';
  if (score >= 50) return 'MEDIUM';
  return 'HIGH';
};
