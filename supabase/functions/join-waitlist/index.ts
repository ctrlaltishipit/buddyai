/**
 * join-waitlist — records an early-access signup and emails a confirmation.
 *
 * Called from the browser right after Google sign-in. The caller's JWT is
 * verified first, so the email is taken from the token rather than the request
 * body and nobody can sign someone else up.
 *
 * Secrets (set with `supabase secrets set`):
 *   RESEND_API_KEY   from resend.com
 *   WAITLIST_FROM    e.g. "buddy <hello@buddyai.co.in>"  (domain must be verified)
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COMPANIONS: Record<string, string> = {
  sage: "Sage", sol: "Sol", ember: "Ember",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const LOGO = "https://www.buddyai.co.in/buddy-email-logo.png";

/**
 * Kept deliberately flat: one wrapper table, one content cell. Gmail collapses
 * mail behind a "show trimmed content" toggle when the markup nests deeply,
 * which is what split the first version into two grey boxes on mobile.
 */
function welcomeEmail(name: string, companion: string): { subject: string; html: string; text: string } {
  const who = name || "there";
  const buddy = COMPANIONS[companion] ?? "Sage";
  const subject = `You're on the list, ${who}`;

  const text =
    `Hi ${who},\n\n` +
    `Thanks for creating your buddy. ${buddy} is yours, and will be waiting when we open the doors.\n\n` +
    `We're building buddy for the moments when you want to talk and nobody is free. The late nights. ` +
    `The days that went sideways. The good news you want to tell someone straight away.\n\n` +
    `You're on the list now. We'll email you the moment your access is ready, and there is nothing ` +
    `else you need to do.\n\n` +
    `Look after yourself until then.\n\n` +
    `Deekshitha\nFounder, buddy.ai\n\n` +
    `You're getting this because you signed up for early access at buddyai.co.in\n`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF7F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F1;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#FFFFFF;border:1px solid #ECE6DC;border-radius:16px;">
<tr><td style="padding:40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#141210;">
<img src="${LOGO}" width="64" height="64" alt="buddy" style="display:block;border:0;outline:none;width:64px;height:64px;margin:0 0 24px;">
<h1 style="margin:0 0 20px;font-size:25px;line-height:1.25;font-weight:700;color:#141210;">You're on the list.</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3D3833;">Hi ${who},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3D3833;">Thanks for creating your buddy. <strong style="color:#141210;">${buddy}</strong> is yours, and will be waiting when we open the doors.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3D3833;">We're building buddy for the moments when you want to talk and nobody is free. The late nights. The days that went sideways. The good news you want to tell someone straight away.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#3D3833;">You're on the list now. We'll email you the moment your access is ready, and there is nothing else you need to do.</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#3D3833;">Look after yourself until then.</p>
<p style="margin:0;font-size:16px;line-height:1.5;color:#141210;font-weight:600;">Deekshitha</p>
<p style="margin:0 0 32px;font-size:14px;line-height:1.5;color:#6B645A;">Founder, buddy.ai</p>
<p style="margin:0;padding-top:22px;border-top:1px solid #ECE6DC;font-size:12.5px;line-height:1.6;color:#A39C90;">You're getting this because you signed up for early access at <a href="https://www.buddyai.co.in" style="color:#E8590C;text-decoration:none;">buddyai.co.in</a>.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  return { subject, html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Not signed in" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Identity comes from the verified token, never from the request body.
  const { data: userData, error: userErr } = await admin.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  const user = userData?.user;
  if (userErr || !user?.email) return json({ error: "Not signed in" }, 401);

  let body: { companion?: string; display_name?: string; source?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body is optional */
  }

  const companion = ["sage", "sol", "ember"].includes(body.companion ?? "")
    ? body.companion!
    : "sage";
  const displayName =
    (body.display_name ?? "").trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

  const { data: existing } = await admin
    .from("waitlist")
    .select("user_id, welcomed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error: upsertErr } = await admin.from("waitlist").upsert(
    {
      user_id: user.id,
      email: user.email,
      display_name: displayName || null,
      companion,
      source: body.source ?? null,
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) return json({ error: "Could not save your spot" }, 500);

  // Someone who comes back and creates their buddy again should hear from us
  // again, otherwise the flow ends in silence. Cap it at one email a day so a
  // repeat click (or abuse) can't turn the waitlist into a spam cannon.
  const RESEND_AFTER_MS = 24 * 60 * 60 * 1000;
  const lastWelcomed = existing?.welcomed_at ? Date.parse(existing.welcomed_at) : 0;
  if (lastWelcomed && Date.now() - lastWelcomed < RESEND_AFTER_MS) {
    return json({ ok: true, alreadyOnList: true, emailed: false });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM") ?? "buddy <onboarding@resend.dev>";
  let emailed = false;

  if (resendKey) {
    const { subject, html, text } = welcomeEmail(displayName.split(" ")[0], companion);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [user.email], subject, html, text }),
    });
    emailed = res.ok;
    if (!res.ok) console.error("resend failed", res.status, await res.text());
  } else {
    console.warn("RESEND_API_KEY unset; skipping welcome email");
  }

  if (emailed) {
    await admin.from("waitlist").update({ welcomed_at: new Date().toISOString() }).eq("user_id", user.id);
  }

  return json({ ok: true, alreadyOnList: Boolean(existing), emailed });
});
