import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function enviarCorreo(
  destinatario: string,
  asunto: string,
  html: string
): Promise<void> {
  await transporter.sendMail({
    from: `"Agenda Caucana" <${process.env.MAIL_USER}>`,
    to: destinatario,
    subject: asunto,
    html,
  });
}