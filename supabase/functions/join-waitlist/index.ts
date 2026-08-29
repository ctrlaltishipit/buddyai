/**
 * join-waitlist — records an early-access signup and emails a confirmation.
 *
 * Called from the browser right after Google sign-in. The caller's JWT is
 * verified first, so the email is taken from the token rather than the request
 * body and nobody can sign someone else up.
 *
 * Secrets (set with `supabase secrets set`):
 *   RESEND_API_KEY   from resend.com
 *   WAITLIST_FROM    e.g. "Buddy <hello@buddyai.co.in>"  (domain must be verified)
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

function welcomeEmail(name: string, companion: string): { subject: string; html: string; text: string } {
  const who = name || "there";
  const buddy = COMPANIONS[companion] ?? "Sage";
  const subject = "You're on the list for Buddy";
  const text =
    `Hi ${who},\n\n` +
    `You're on the early-access list, and ${buddy} is waiting for you.\n\n` +
    `We're still building the app. As soon as access opens we'll email you ` +
    `at this address with your way in. Nothing else to do for now.\n\n` +
    `Thanks for being early.\n\nBuddy\nbuddyai.co.in\n`;
  const html = `<!doctype html><html><body style="margin:0;background:#0A0908;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0908;padding:40px 20px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141210;border:1px solid #262220;border-radius:16px;padding:40px">
        <tr><td>
          <div style="width:44px;height:44px;border-radius:46% 54% 55% 45%/53% 47% 53% 47%;background:linear-gradient(160deg,#FFD23F 25%,#FF7A1A 60%,#F24E1E 92%);margin-bottom:26px"></div>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#F7F3EA;font-weight:700">You're on the list.</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#B9B1A3">Hi ${who}, thanks for creating your buddy. <strong style="color:#F7F3EA">${buddy}</strong> is waiting for you.</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#B9B1A3">We're still building the app. The moment access opens, we'll email you at this address with your way in. There's nothing else you need to do.</p>
          <p style="margin:0 0 32px;font-size:16px;line-height:1.65;color:#B9B1A3">Thanks for being early.</p>
          <p style="margin:0;font-size:13px;color:#7D766B">Buddy · <a href="https://buddyai.co.in" style="color:#FF7A1A;text-decoration:none">buddyai.co.in</a><br>You got this because you signed up for early access.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
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

  // Only ever email once, even if they sign in again.
  if (existing?.welcomed_at) {
    return json({ ok: true, alreadyOnList: true, emailed: false });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("WAITLIST_FROM") ?? "Buddy <onboarding@resend.dev>";
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
