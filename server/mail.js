/** SMTP is configured entirely by the operator; no mail is sent during construction. */
export async function createSMTPMailer({ env = process.env, transport: suppliedTransport } = {}) {
  if (!suppliedTransport && (!env.SMTP_HOST || !env.SMTP_FROM)) throw new Error('SMTP_HOST and SMTP_FROM are required for password reset email.');
  const port = Number(env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a valid port.');
  if (env.SMTP_USER && !env.SMTP_PASSWORD) throw new Error('SMTP_PASSWORD is required when SMTP_USER is set.');
  if (!env.SMTP_USER && env.SMTP_PASSWORD) throw new Error('SMTP_USER is required when SMTP_PASSWORD is set.');
  const transport = suppliedTransport ?? (await import('nodemailer')).default.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465,
    requireTLS: port !== 465,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
    pool: true, maxConnections: 2, maxMessages: 50,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  return {
    async sendPasswordReset({ email, callsign, url }) {
      return transport.sendMail({
        from: env.SMTP_FROM, to: email,
        subject: 'Reset your Star Agent password',
        text: `Hello ${callsign},\n\nReset your Star Agent password using this link:\n${url}\n\nThis link expires in 30 minutes and can only be used once. If you did not request a reset, you can ignore this email.\n\nStar Agent never asks for your real name.`,
        disableFileAccess: true, disableUrlAccess: true,
      });
    },
    async verify() { return transport.verify(); },
    close() { transport.close?.(); },
  };
}
