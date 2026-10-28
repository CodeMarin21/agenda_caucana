/**
 * Plantilla HTML del correo de recuperación de contraseña.
 *
 * Diseño:
 *   - Coherente con identidad visual (terracota #C8743E + crema #F5EFE6 + tinta #1F1B16)
 *   - Responsive básico (funciona en Gmail, Outlook, Apple Mail)
 *   - Incluye versión texto plano (fallback para clientes sin HTML)
 *   - Estilos inline obligatorios (los clientes de correo no cargan CSS externo)
 */

export interface PlantillaResetOpts {
  nombreUsuario: string;   // "Mateo" o "jugador123"
  url: string;             // URL completa con token
  minutosValidez: number;  // ej. 30
}

export function plantillaResetPassword(opts: PlantillaResetOpts): {
  html: string;
  text: string;
} {
  const { nombreUsuario, url, minutosValidez } = opts;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar contraseña — Agenda Caucana</title>
</head>
<body style="margin:0;padding:0;background-color:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F1B16;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F5EFE6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(31,27,22,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#C8743E;padding:24px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#F5EFE6;letter-spacing:0.5px;">
                Agenda Caucana
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#1F1B16;">
                Hola, ${escapeHtml(nombreUsuario)}
              </h2>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1F1B16;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Agenda Caucana</strong>.
              </p>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1F1B16;">
                Haz clic en el siguiente botón para crear una nueva contraseña:
              </p>

              <!-- Botón -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="background-color:#C8743E;border-radius:8px;">
                    <a href="${escapeHtml(url)}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#F5EFE6;text-decoration:none;border-radius:8px;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6B6560;">
                O copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#C8743E;word-break:break-all;">
                ${escapeHtml(url)}
              </p>

              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#1F1B16;">
                <strong>Este enlace expira en ${minutosValidez} minutos.</strong>
              </p>

              <p style="margin:0 0 0;font-size:14px;line-height:1.6;color:#1F1B16;">
                Si tú no solicitaste este cambio, ignora este correo. Tu contraseña actual sigue siendo válida.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F5EFE6;padding:20px 28px;border-top:1px solid #E5DDD0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6B6560;text-align:center;">
                Este es un correo automático, por favor no respondas.<br>
                Agenda Caucana — Popayán, Cauca, Colombia
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Agenda Caucana — Restablecer contraseña

Hola, ${nombreUsuario}:

Recibimos una solicitud para restablecer la contraseña de tu cuenta.

Abre este enlace en tu navegador para crear una nueva contraseña:

${url}

Este enlace expira en ${minutosValidez} minutos.

Si tú no solicitaste este cambio, ignora este correo. Tu contraseña actual sigue siendo válida.

— Agenda Caucana
  `.trim();

  return { html, text };
}

/**
 * Escapa caracteres HTML para prevenir inyección.
 * Los valores que vienen del usuario (nombre) o de la URL
 * NUNCA deben insertarse crudos en el HTML del correo.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}