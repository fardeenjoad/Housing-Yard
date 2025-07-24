import twilio from "twilio";
import "dotenv/config";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const sendOtp = async (mobile, otp) => {
  try {
    return client.messages.create({
      body: `You verification OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${mobile}`,
    });
    console.log("OTP sent successfully", message.sid);
  } catch (error) {
    console.error("Twilio error:", error);
    throw new Error("Failed to send OTP");
  }
};
