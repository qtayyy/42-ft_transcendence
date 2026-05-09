/** Per-route limits for sensitive auth POSTs (see @fastify/rate-limit, global: false). */
export const authRateLimit = {
  login: { max: 10, timeWindow: "1 minute" },
  signup: { max: 5, timeWindow: "1 minute" },
  forgotRequestOtp: { max: 5, timeWindow: "15 minutes" },
  forgotVerifyOtp: { max: 20, timeWindow: "1 minute" },
  forgotResetPassword: { max: 10, timeWindow: "1 minute" },
  verify2fa: { max: 15, timeWindow: "1 minute" },
  enable2faVerify: { max: 15, timeWindow: "1 minute" },
  changePassword: { max: 10, timeWindow: "1 minute" },
};
