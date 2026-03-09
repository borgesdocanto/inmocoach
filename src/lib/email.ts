// Remitente oficial
export const EMAIL_FROM = "Inmo Coach <coach@inmocoach.com.ar>";

// Footer estándar para todos los mails
export const EMAIL_FOOTER = `
  <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f3f4f6;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;line-height:1.6;margin:0;">
      Este es un email automático — por favor no respondas este mensaje.<br/>
      Para consultas escribí a <a href="mailto:hola@inmocoach.com.ar" style="color:#aa0000;text-decoration:none;">hola@inmocoach.com.ar</a>
    </p>
  </div>
`;

// Wrapper HTML base para todos los mails
export function emailWrapper(content: string): string {
  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;background:#ffffff;">
      <div style="height:3px;background:#aa0000;margin-bottom:32px;border-radius:2px;"></div>
      <div style="margin-bottom:24px;">
        <span style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#111827;">Inmo</span><span style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#aa0000;">Coach</span>
      </div>
      ${content}
      ${EMAIL_FOOTER}
    </div>
  `;
}
