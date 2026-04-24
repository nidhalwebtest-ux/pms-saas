/**
 * Email utility — calls Resend's REST API directly.
 * No SMTP, no extra packages. Just fetch + your RESEND_API_KEY.
 *
 * Required env vars:
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx   (from resend.com dashboard)
 *   RESEND_FROM_EMAIL=OmRent <noreply@yourdomain.com>
 *
 * Sender address:
 *   - The default `onboarding@resend.dev` ONLY delivers to the email
 *     registered on the Resend account — every other recipient is dropped.
 *     If verification emails aren't arriving in production, this is almost
 *     always the cause: verify a domain in Resend and set
 *     RESEND_FROM_EMAIL to something like `OmRent <noreply@yourdomain.com>`.
 */

const RESEND_API = "https://api.resend.com/emails";
const FROM = process.env.RESEND_FROM_EMAIL ?? "OmRent <onboarding@resend.dev>";

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  verificationUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: "Verify your email — OmRent",
      html: verificationEmailHtml(verificationUrl),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Resend API error ${res.status} (from=${FROM}, to=${to}): ${body}`,
    );
  }
}

// ─── Invitation email ─────────────────────────────────────────────────────────

export async function sendInvitationEmail(
  to: string,
  inviteUrl: string,
  inviterName: string,
  orgName: string,
  roleLabel: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    FROM,
      to,
      subject: `You've been invited to join ${orgName} on OmRent`,
      html:    invitationEmailHtml(inviteUrl, inviterName, orgName, roleLabel),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Resend API error ${res.status} (from=${FROM}, to=${to}): ${body}`,
    );
  }
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function verificationEmailHtml(url: string): string {
  const year = new Date().getFullYear();
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email — OmRent</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">OmRent</h1>
              <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Property Management System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

              <h2 style="color:#111827;margin:0 0 12px;font-size:22px;font-weight:700;">Verify your email address</h2>

              <p style="color:#6b7280;margin:0 0 28px;font-size:15px;line-height:1.7;">
                Welcome to OmRent! One quick step — click the button below to verify your email address and activate your account.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${url}"
                       style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                      ✓ &nbsp;Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />

              <!-- Fallback link -->
              <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color:#2563eb;font-size:12px;word-break:break-all;margin:0 0 24px;">
                <a href="${url}" style="color:#2563eb;">${url}</a>
              </p>

              <!-- Warning -->
              <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;text-align:center;">
                This link expires in <strong style="color:#6b7280;">24 hours</strong>.<br />
                If you didn't create an OmRent account, you can safely ignore this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                © ${year} OmRent · Property Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Invitation HTML Template ─────────────────────────────────────────────────

function invitationEmailHtml(
  url: string,
  inviterName: string,
  orgName: string,
  roleLabel: string,
): string {
  const year = new Date().getFullYear();
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to join ${orgName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">OmRent</h1>
              <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Property Management System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

              <h2 style="color:#111827;margin:0 0 8px;font-size:22px;font-weight:700;">You've been invited! 🎉</h2>
              <p style="color:#6b7280;margin:0 0 24px;font-size:15px;line-height:1.7;">
                <strong style="color:#111827;">${inviterName}</strong> has invited you to join
                <strong style="color:#111827;">${orgName}</strong> on OmRent as a
                <strong style="color:#2563eb;">${roleLabel}</strong>.
              </p>

              <!-- Role badge -->
              <div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:28px;">
                Role: ${roleLabel}
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${url}"
                       style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />

              <!-- Fallback link -->
              <p style="color:#9ca3af;font-size:13px;margin:0 0 8px;">
                If the button doesn't work, copy and paste this link:
              </p>
              <p style="color:#2563eb;font-size:12px;word-break:break-all;margin:0 0 24px;">
                <a href="${url}" style="color:#2563eb;">${url}</a>
              </p>

              <!-- Warning -->
              <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;text-align:center;">
                This invitation expires in <strong style="color:#6b7280;">72 hours</strong>.<br />
                If you weren't expecting this, you can safely ignore this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                © ${year} OmRent · Property Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}