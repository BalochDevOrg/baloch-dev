import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

type OutboxRow = {
  id: string
  kind: "order_seller_email" | "order_seller_whatsapp" | "product_marketing" | "order_status_email" | "order_buyer_confirmation" | "new_order"
  payload: Record<string, unknown>
  status: string
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

function money(n: unknown) {
  const v = Number(n ?? 0)
  return `PKR ${v.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
}

function originFromReq(req: Request) {
  const env = Deno.env.get("PUBLIC_SITE_URL") ?? ""
  if (env) return env.replace(/\/$/, "")
  const origin = req.headers.get("origin")
  return origin ?? "https://balochexporthub.com"
}

async function sendResend(opts: { to: string; subject: string; html: string }) {
  const key = Deno.env.get("RESEND_API_KEY")
  if (!key) return { sent: false as const, reason: "RESEND_API_KEY is not configured in Supabase secrets" }
  const from = Deno.env.get("RESEND_FROM") ?? "Baloch Export Hub <noreply@balochexporthub.com>"
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { sent: false as const, reason: `Resend API ${res.status}: ${text}` }
    }
    return { sent: true as const }
  } catch (err) {
    return { sent: false as const, reason: err instanceof Error ? err.message : String(err) }
  }
}

async function sendWhatsApp(to: string, body: string) {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN")
  const twilioFrom = Deno.env.get("TWILIO_WHATSAPP_FROM")
  const metaToken = Deno.env.get("META_WHATSAPP_TOKEN")
  const metaPhoneId = Deno.env.get("META_WHATSAPP_PHONE_ID")

  const digits = to.replace(/[^\d+]/g, "")
  if (!digits) return { sent: false as const, reason: "Missing WhatsApp number" }

  if (twilioSid && twilioToken && twilioFrom) {
    const auth = btoa(`${twilioSid}:${twilioToken}`)
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        From: twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`,
        To: digits.startsWith("whatsapp:") ? digits : `whatsapp:${digits}`,
        Body: body,
      }),
    })
    if (!res.ok) return { sent: false as const, reason: `Twilio ${res.status}: ${await res.text()}` }
    return { sent: true as const }
  }

  if (metaToken && metaPhoneId) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${metaPhoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits.replace(/^\+/, ""),
        type: "text",
        text: { body },
      }),
    })
    if (!res.ok) return { sent: false as const, reason: `Meta WhatsApp ${res.status}: ${await res.text()}` }
    return { sent: true as const }
  }

  return { sent: false as const, reason: "No WhatsApp provider configured (Twilio or Meta)" }
}

function buyerOrderConfirmationEmailHtml(p: Record<string, unknown>, site: string) {
  const orderId = String(p.order_id ?? "")
  const orderCode = String(p.order_code ?? "")
  const token = String(p.tracking_token ?? "")
  const buyerName = String(p.buyer_name ?? "Valued Buyer")
  const storeName = String(p.store_name ?? "Baloch Export Hub Artisan Store")
  const storeSlug = String(p.store_slug ?? "sellers")
  const paymentMethod = String(p.payment_method ?? "Cash on Delivery").toUpperCase()
  const orderDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })

  const items = Array.isArray(p.items) ? (p.items as Array<Record<string, unknown>>) : []
  const addr = (p.address ?? {}) as Record<string, unknown>
  const city = String(addr.city ?? "Quetta")
  const state = String(addr.state ?? "Balochistan")
  const country = String(addr.country ?? "Pakistan")

  const trackUrl = `${site}/orders/track/${orderId}${token ? `?token=${token}` : ""}`
  const storeUrl = storeSlug && storeSlug !== "sellers" ? `${site}/store/${storeSlug}` : `${site}/sellers`
  const hubUrl = `${site}/`

  // Look for any tracking code in items or payload
  let trackingCode = p.tracking_code ? String(p.tracking_code) : ""
  if (!trackingCode) {
    const itemWithCode = items.find((i) => Boolean(i.tracking_code))
    if (itemWithCode) trackingCode = String(itemWithCode.tracking_code)
  }

  const itemsHtml = items.map((i) => {
    const imgTag = i.image
      ? `<img src="${String(i.image)}" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:8px;border:1px solid #E8E0D2;display:block;margin-right:12px;" />`
      : `<div style="width:54px;height:54px;border-radius:8px;background:#FAF7F2;border:1px solid #E8E0D2;display:inline-block;margin-right:12px;"></div>`
    const iStore = String(i.store_name ?? storeName)

    return `
      <tr style="border-bottom:1px solid #F0EAE1;">
        <td style="padding:14px 0;vertical-align:middle;width:66px;">
          ${imgTag}
        </td>
        <td style="padding:14px 0;vertical-align:middle;">
          <div style="font-size:14px;font-weight:600;color:#152722;line-height:1.3;">${String(i.name ?? "Handcrafted Item")}</div>
          <div style="font-size:12px;color:#889893;margin-top:2px;">Store: <strong style="color:#144237;">${iStore}</strong> · Qty: ${String(i.qty ?? 1)}</div>
        </td>
        <td style="padding:14px 0;text-align:right;vertical-align:middle;">
          <div style="font-size:14px;font-weight:700;color:#144237;font-family:monospace;">${money(i.total ?? i.price)}</div>
        </td>
      </tr>
    `
  }).join("")

  const trackingNotice = trackingCode
    ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:12px 16px;margin:18px 0;color:#92400E;font-size:13px;font-weight:600;">
        📦 Tracking Number: <span style="font-family:monospace;letter-spacing:1px;font-size:14px;color:#78350F;">${trackingCode}</span>
       </div>`
    : `<div style="background:#F6F2EA;border:1px solid #E8E0D2;border-radius:10px;padding:12px 16px;margin:18px 0;color:#566863;font-size:13px;">
        ℹ️ Your tracking number will be available when your parcel is dispatched.
       </div>`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation #${orderCode} — Baloch Export Hub</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#152722;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#FAF7F2;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;border:1px solid #E8E0D2;overflow:hidden;box-shadow:0 4px 12px rgba(20,66,55,0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background:#144237;padding:32px 28px;text-align:center;border-bottom:4px solid #D97706;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#D97706;text-transform:uppercase;margin-bottom:6px;">
                      ✦ BALOCH DEV PLATFORM ✦
                    </div>
                    <h1 style="margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#FFFFFF;font-family:Georgia,serif;">
                      BALOCH EXPORT HUB
                    </h1>
                    <div style="font-size:12px;color:#A3C6BF;margin-top:4px;">
                      Taking Balochi Creativity & Artisan Crafts to the World
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thank You Message -->
          <tr>
            <td style="padding:28px 28px 16px 28px;">
              <div style="display:inline-block;background:#EAF5F3;color:#144237;border:1px solid #B8DDD6;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">
                ✓ Order Placed Successfully
              </div>
              <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#144237;">
                Shukriya, ${buyerName}!
              </h2>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#566863;">
                Your order has been received and confirmed. The artisan store has been notified and will begin packaging your parcel with care.
              </p>
            </td>
          </tr>

          <!-- Order Summary Meta Box -->
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#F6F2EA;border-radius:12px;border:1px solid #E8E0D2;padding:16px;">
                <tr>
                  <td style="width:50%;vertical-align:top;padding:4px 8px;">
                    <span style="font-size:11px;text-transform:uppercase;font-weight:700;color:#889893;letter-spacing:0.5px;display:block;">Order Number</span>
                    <strong style="font-size:15px;color:#144237;font-family:monospace;letter-spacing:0.5px;">${orderCode}</strong>
                  </td>
                  <td style="width:50%;vertical-align:top;padding:4px 8px;">
                    <span style="font-size:11px;text-transform:uppercase;font-weight:700;color:#889893;letter-spacing:0.5px;display:block;">Order Date</span>
                    <strong style="font-size:13px;color:#152722;">${orderDate}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="width:50%;vertical-align:top;padding:8px 8px 4px 8px;">
                    <span style="font-size:11px;text-transform:uppercase;font-weight:700;color:#889893;letter-spacing:0.5px;display:block;">Payment Method</span>
                    <strong style="font-size:13px;color:#152722;">${paymentMethod}</strong>
                  </td>
                  <td style="width:50%;vertical-align:top;padding:8px 8px 4px 8px;">
                    <span style="font-size:11px;text-transform:uppercase;font-weight:700;color:#889893;letter-spacing:0.5px;display:block;">Delivery City</span>
                    <strong style="font-size:13px;color:#152722;">${city}, ${state}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tracking Notice -->
          <tr>
            <td style="padding:0 28px;">
              ${trackingNotice}
            </td>
          </tr>

          <!-- Primary Call To Action Button (Track My Parcel) -->
          <tr>
            <td style="padding:6px 28px 24px 28px;" align="center">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="width:100%;">
                <tr>
                  <td align="center">
                    <a href="${trackUrl}" target="_blank" style="display:block;background:#D97706;background:linear-gradient(135deg, #D97706, #B45309);color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:15px 28px;border-radius:12px;text-align:center;letter-spacing:0.5px;box-shadow:0 3px 6px rgba(217,119,6,0.25);">
                      📦 Track My Parcel & Status →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Ordered Section -->
          <tr>
            <td style="padding:0 28px;">
              <h3 style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#144237;border-bottom:2px solid #E8E0D2;padding-bottom:8px;">
                Items in This Order
              </h3>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Totals Section -->
          <tr>
            <td style="padding:16px 28px 24px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top:1px solid #E8E0D2;padding-top:14px;">
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#566863;">Subtotal</td>
                  <td style="padding:4px 0;font-size:13px;color:#152722;text-align:right;font-family:monospace;">${money(p.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:#566863;">Platform Shipping</td>
                  <td style="padding:4px 0;font-size:13px;color:#152722;text-align:right;font-family:monospace;">${money(p.shipping ?? 250)}</td>
                </tr>
                <tr style="border-top:2px solid #144237;">
                  <td style="padding:10px 0 0 0;font-size:16px;font-weight:800;color:#144237;">Order Total</td>
                  <td style="padding:10px 0 0 0;font-size:18px;font-weight:800;color:#144237;text-align:right;font-family:monospace;">${money(p.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Secondary Action Buttons: Visit Our Store & Visit Baloch Export Hub -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width:48%;padding-right:6px;">
                    <a href="${storeUrl}" target="_blank" style="display:block;background:#144237;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:13px;padding:12px 14px;border-radius:10px;text-align:center;">
                      🏪 Visit Our Store
                    </a>
                  </td>
                  <td style="width:48%;padding-left:6px;">
                    <a href="${hubUrl}" target="_blank" style="display:block;background:#F6F2EA;border:1px solid #E8E0D2;color:#144237;text-decoration:none;font-weight:600;font-size:13px;padding:12px 14px;border-radius:10px;text-align:center;">
                      🌐 Visit Baloch Export Hub
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback Direct URLs -->
          <tr>
            <td style="background:#FAF7F2;padding:20px 28px;border-top:1px solid #E8E0D2;font-size:11px;color:#889893;line-height:1.6;">
              <strong style="color:#566863;">Fallback Direct Links:</strong><br/>
              • Track Parcel: <a href="${trackUrl}" style="color:#144237;word-break:break-all;">${trackUrl}</a><br/>
              • Seller Store: <a href="${storeUrl}" style="color:#144237;word-break:break-all;">${storeUrl}</a><br/>
              • Platform Homepage: <a href="${hubUrl}" style="color:#144237;word-break:break-all;">${hubUrl}</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0D2C24;padding:24px 28px;text-align:center;color:#A3C6BF;font-size:11px;line-height:1.5;">
              <div style="font-weight:700;color:#FFFFFF;margin-bottom:4px;">Baloch Export Hub · A BalochDev Initiative</div>
              <div>Dedicated to preserving and promoting Balochi Doch embroidery, craft artistry and cultural exports worldwide.</div>
              <div style="margin-top:10px;color:#6C968E;">
                Need help with your parcel? Reach out through your buyer dashboard or contact platform support.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function orderEmailHtml(p: Record<string, unknown>) {
  const items = Array.isArray(p.items) ? (p.items as Array<Record<string, unknown>>) : []
  const addr = (p.address ?? {}) as Record<string, unknown>
  const rows = items
    .map(
      (i) =>
        `<tr>
      <td style="padding:8px 0">${String(i.name ?? "")}</td>
      <td style="padding:8px 0;text-align:center">${String(i.qty ?? "")}</td>
      <td style="padding:8px 0;text-align:right">${money(i.price)}</td>
      <td style="padding:8px 0;text-align:right">${money(i.total)}</td>
    </tr>`
    )
    .join("")
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <h1 style="font-size:22px">New Order — Baloch Export Hub</h1>
      <p>You received a new order for <strong>${String(p.store_name ?? "your store")}</strong>.</p>
      <h2 style="font-size:16px">Buyer</h2>
      <p>
        ${String(p.buyer_name ?? "")}<br/>
        ${String(p.buyer_email ?? "")}<br/>
        ${p.buyer_phone ? String(p.buyer_phone) : ""}
      </p>
      <p>
        ${String(addr.full_name ?? "")}<br/>
        ${String(addr.line1 ?? "")}, ${String(addr.city ?? "")}, ${String(addr.state ?? "")}<br/>
        ${String(addr.country ?? "")}
      </p>
      <h2 style="font-size:16px">Order ${String(p.order_code ?? "")}</h2>
      <p>Payment method: ${String(p.payment_method ?? "")}<br/>Current status: Submitted Order</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p>Subtotal: ${money(p.subtotal)}<br/>Shipping: ${money(p.shipping)}<br/><strong>Total: ${money(p.total)}</strong></p>
      <p>Please open your Seller Dashboard to process this order.</p>
    </div>`
}

function productEmailHtml(p: Record<string, unknown>, site: string, token: string) {
  const href = `${site}${String(p.href ?? "/")}`
  const unsub = `${site}/unsubscribe?token=${token}`
  const img = p.image
    ? `<img src="${String(p.image)}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px"/>`
    : ""
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <h1 style="font-size:22px">New Product Added to Baloch Export Hub</h1>
      ${img}
      <h2>${String(p.product_name ?? "")}</h2>
      <p>${String(p.store_name ?? "")}</p>
      <p>${String(p.description ?? "")}</p>
      <p><a href="${href}">View Product</a></p>
      <p style="font-size:12px;color:#666"><a href="${unsub}">Unsubscribe</a></p>
    </div>`
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const authHeader = req.headers.get("Authorization") ?? ""
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !anon || !service) return json({ error: "Supabase env missing" }, 500)

  // Verify authentication
  const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401)

  const admin = createClient(supabaseUrl, service)
  const { data: rows, error } = await admin
    .from("notification_outbox")
    .select("*")
    .in("status", ["queued", "pending"])
    .order("created_at", { ascending: true })
    .limit(40)

  if (error) return json({ error: error.message }, 500)

  const results: Array<{ id: string; status: string; error?: string }> = []
  const site = originFromReq(req)

  for (const row of (rows ?? []) as OutboxRow[]) {
    try {
      if (row.kind === "order_buyer_confirmation") {
        const to = String(row.payload.buyer_email ?? "")
        if (!to) {
          await admin
            .from("notification_outbox")
            .update({ status: "failed", error: "Missing buyer email", processed_at: new Date().toISOString() })
            .eq("id", row.id)
          results.push({ id: row.id, status: "failed", error: "Missing buyer email" })
          continue
        }
        const orderCode = String(row.payload.order_code ?? "")
        const send = await sendResend({
          to,
          subject: `Order Confirmation #${orderCode} — Baloch Export Hub`,
          html: buyerOrderConfirmationEmailHtml(row.payload, site),
        })
        const status = send.sent ? "sent" : "skipped_no_provider"
        await admin
          .from("notification_outbox")
          .update({ status, error: send.sent ? null : send.reason, processed_at: new Date().toISOString() })
          .eq("id", row.id)
        results.push({ id: row.id, status, error: send.sent ? undefined : send.reason })
      } else if (row.kind === "order_seller_email") {
        const to = String(row.payload.seller_email ?? "")
        if (!to) {
          await admin
            .from("notification_outbox")
            .update({ status: "failed", error: "Missing seller email", processed_at: new Date().toISOString() })
            .eq("id", row.id)
          results.push({ id: row.id, status: "failed", error: "Missing seller email" })
          continue
        }
        const send = await sendResend({
          to,
          subject: `New Order ${String(row.payload.order_code ?? "")} — Baloch Export Hub`,
          html: orderEmailHtml(row.payload),
        })
        const status = send.sent ? "sent" : "skipped_no_provider"
        await admin
          .from("notification_outbox")
          .update({ status, error: send.sent ? null : send.reason, processed_at: new Date().toISOString() })
          .eq("id", row.id)
        results.push({ id: row.id, status, error: send.sent ? undefined : send.reason })
      } else if (row.kind === "order_seller_whatsapp") {
        if (row.payload.whatsapp_verified !== true) {
          await admin
            .from("notification_outbox")
            .update({ status: "skipped_no_provider", error: "WhatsApp number is not verified", processed_at: new Date().toISOString() })
            .eq("id", row.id)
          results.push({ id: row.id, status: "skipped_no_provider" })
          continue
        }
        const items = Array.isArray(row.payload.items) ? (row.payload.items as Array<Record<string, unknown>>) : []
        const first = items[0] ?? {}
        const body = [
          "New Order — Baloch Export Hub",
          "",
          `Order: #${String(row.payload.order_code ?? "")}`,
          `Buyer: ${String(row.payload.buyer_name ?? "")}`,
          `Product: ${String(first.name ?? "See dashboard")}`,
          `Quantity: ${String(first.qty ?? "")}`,
          `Total: ${money(row.payload.total)}`,
          "",
          "Please open your seller dashboard to view the complete order.",
        ].join("\n")
        const send = await sendWhatsApp(String(row.payload.whatsapp ?? ""), body)
        const status = send.sent ? "sent" : "skipped_no_provider"
        await admin
          .from("notification_outbox")
          .update({ status, error: send.sent ? null : send.reason, processed_at: new Date().toISOString() })
          .eq("id", row.id)
        results.push({ id: row.id, status, error: send.sent ? undefined : send.reason })
      } else if (row.kind === "product_marketing") {
        const { data: subs } = await admin.from("email_subscribers").select("email, unsubscribe_token").eq("is_subscribed", true)
        const key = Deno.env.get("RESEND_API_KEY")
        if (!key) {
          await admin
            .from("notification_outbox")
            .update({ status: "skipped_no_provider", error: "RESEND_API_KEY is not configured", processed_at: new Date().toISOString() })
            .eq("id", row.id)
          results.push({ id: row.id, status: "skipped_no_provider", error: "RESEND_API_KEY is not configured" })
          continue
        }
        let failed = 0
        for (const sub of subs ?? []) {
          const send = await sendResend({
            to: sub.email,
            subject: `New Product Added to Baloch Export Hub — ${String(row.payload.product_name ?? "")}`,
            html: productEmailHtml(row.payload, site, sub.unsubscribe_token),
          })
          if (!send.sent) failed += 1
        }
        const status = failed && !(subs ?? []).length ? "skipped_no_provider" : "sent"
        await admin
          .from("notification_outbox")
          .update({
            status,
            error: (subs ?? []).length === 0 ? "No active subscribers" : failed ? `${failed} send(s) failed` : null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id)
        results.push({ id: row.id, status })
      } else if (row.kind === "new_order") {
        // Administrative notification mark
        await admin
          .from("notification_outbox")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", row.id)
        results.push({ id: row.id, status: "processed" })
      } else {
        await admin
          .from("notification_outbox")
          .update({ status: "failed", error: "Unknown kind", processed_at: new Date().toISOString() })
          .eq("id", row.id)
        results.push({ id: row.id, status: "failed" })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await admin
        .from("notification_outbox")
        .update({ status: "failed", error: message, processed_at: new Date().toISOString() })
        .eq("id", row.id)
      results.push({ id: row.id, status: "failed", error: message })
    }
  }

  return json({ ok: true, processed: results.length, results })
})
