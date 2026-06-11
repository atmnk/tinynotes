export function isRecoveryFeatureEnabled() {
  return process.env.RECOVERY_FEATURE_ENABLED === "true"
}
