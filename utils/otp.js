export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const otpExpiryAfter = (mins = Number(process.env.OTP_EXP_MINUTES)) =>
  new Date(Date.now() + mins * 60 * 1000);

export const isOtpExpired = (expiry) => !expiry || expiry < new Date();
