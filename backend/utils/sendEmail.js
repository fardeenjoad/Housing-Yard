import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!to) throw new Error("Recipient email is missing");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const info = await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
  console.log("Email sent successfully", info.messageId);
  return info;
};
