import nodemailer, { Transporter } from 'nodemailer';
import { logger } from './logger';

/**
 * Mailer singleton.
 *
 * Comportamiento:
 *   - Si las credenciales del .env son reales → usa SMTP real (Gmail, Mailgun, etc.)
 *   - Si son placeholders (o faltan)          → usa Ethereal sandbox automáticamente
 *   - En modo Ethereal, loguea la URL de preview en consola para ver el correo enviado
 *
 * Nunca tira error al arrancar: si algo falla, se degrada a Ethereal.
 */

let transporter: Transporter | null = null;
let modoEthereal = false;

function esValorPlaceholder(valor?: string): boolean {
  if (!valor || valor.trim() === '') return true;
  const pistas = [
    'tu_correo',
    'tu_password',
    'placeholder',
    'example.com',
    'changeme',
    'xxx',
  ];
  const lower = valor.toLowerCase();
  return pistas.some((p) => lower.includes(p));
}

export async function inicializarMailer(): Promise<void> {
  if (transporter) return;

  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT ?? 587);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  // ── Modo sandbox: Ethereal ─────────────────────────────
  if (esValorPlaceholder(user) || esValorPlaceholder(pass)) {
    logger.warn(
      '📧 Mailer: credenciales placeholder detectadas. Usando Ethereal (sandbox).'
    );

    const cuentaTest = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: cuentaTest.user,
        pass: cuentaTest.pass,
      },
    });

    modoEthereal = true;
    logger.info(`📧 Mailer: Ethereal listo (usuario: ${cuentaTest.user})`);
    return;
  }

  // ── Modo real: SMTP configurado ────────────────────────
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true solo para 465
    auth: { user, pass },
  });

  // Verificar conexión (no bloqueante: si falla, seguimos con el transporter)
  try {
    await transporter.verify();
    logger.info(`📧 Mailer: conectado a ${host}:${port}`);
  } catch (error) {
    logger.error(
      `📧 Mailer: no se pudo verificar la conexión SMTP — ${(error as Error).message}`
    );
    logger.warn('📧 Mailer: intentará enviar igual. Si falla, revisar credenciales.');
  }
}

export interface OpcionesMail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function enviarMail(opts: OpcionesMail): Promise<void> {
  if (!transporter) {
    await inicializarMailer();
  }
  if (!transporter) {
    throw new Error('Mailer no inicializado');
  }

  const from =
    process.env.MAIL_FROM ||
    `"Agenda Caucana" <${process.env.MAIL_USER || 'no-reply@agendacaucana.local'}>`;

  const info = await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (modoEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info(`📧 [ETHEREAL] Preview del correo: ${previewUrl}`);
  }
}

export function estaEnModoEthereal(): boolean {
  return modoEthereal;
}