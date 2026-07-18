const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const envPath = path.join(__dirname, ".env");
const defaultWhatsAppRecipient = "905380381234";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function handleConfig(req, res) {
  sendJson(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function normalizeRecipient(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return defaultWhatsAppRecipient;
  if (digits.length === 10 && digits.startsWith("5")) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `9${digits}`;
  return digits;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("5")) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `9${digits}`;
  return digits;
}

function generateCustomerCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `NXR-${Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
}

async function supabaseRest(pathname, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    const error = new Error("Supabase service role ayari yok.");
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || "Supabase REST hatasi");
    error.statusCode = response.status;
    error.meta = data;
    throw error;
  }
  return data;
}

async function getLoyaltyBusinessId() {
  if (process.env.LOYALTY_BUSINESS_ID) return process.env.LOYALTY_BUSINESS_ID;
  const rows = await supabaseRest("businesses?select=id&limit=1");
  return rows?.[0]?.id || null;
}

async function handleCustomerRegister(req, res) {
  try {
    const body = await readJsonBody(req);
    const fullName = String(body.fullName || "").trim();
    const phone = normalizePhone(body.phone);
    if (!fullName || !phone || body.kvkkAccepted !== true) {
      sendJson(res, 400, { ok: false, error: "Ad, telefon ve KVKK onayi zorunludur." });
      return;
    }
    const businessId = await getLoyaltyBusinessId();
    const existing = await supabaseRest(`customers?select=*&phone=eq.${encodeURIComponent(phone)}${businessId ? `&business_id=eq.${encodeURIComponent(businessId)}` : ""}&limit=1`);
    if (existing?.[0]) {
      sendJson(res, 200, { ok: true, customer: customerFromDb(existing[0]), existing: true });
      return;
    }
    const payload = {
      business_id: businessId,
      full_name: fullName,
      phone,
      customer_code: generateCustomerCode(),
      kvkk_accepted: true,
      campaign_opt_in: body.campaignOptIn === true,
      qr_created_at: new Date().toISOString()
    };
    const inserted = await supabaseRest("customers", { method: "POST", body: JSON.stringify(payload) });
    sendJson(res, 200, { ok: true, customer: customerFromDb(inserted[0]), existing: false });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message });
  }
}

function customerFromDb(row = {}) {
  return {
    id: row.id,
    customerCode: row.customer_code,
    fullName: row.full_name,
    phone: row.phone,
    points: Number(row.points || 0),
    totalPoints: Number(row.total_points || 0),
    rewardsEarned: Number(row.rewards_earned || 0),
    rewardsRedeemed: Number(row.rewards_redeemed || 0),
    totalPurchases: Number(row.total_purchases || 0),
    lastPurchaseAt: row.last_purchase_at || "",
    campaignOptIn: row.campaign_opt_in === true,
    kvkkAccepted: row.kvkk_accepted === true,
    qrCreatedAt: row.qr_created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function handleCustomerLookup(req, res, url) {
  try {
    const code = String(url.searchParams.get("code") || "").trim().toLocaleUpperCase("tr-TR");
    const phone = normalizePhone(url.searchParams.get("phone"));
    let query = "customers?select=*&limit=1";
    if (code) query += `&customer_code=eq.${encodeURIComponent(code)}`;
    else if (phone) query += `&phone=eq.${encodeURIComponent(phone)}`;
    else {
      sendJson(res, 400, { ok: false, error: "Kod veya telefon gerekli." });
      return;
    }
    const rows = await supabaseRest(query);
    sendJson(res, 200, { ok: true, customer: rows?.[0] ? customerFromDb(rows[0]) : null });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message });
  }
}

async function handleCustomerLoyaltyUpdate(req, res) {
  try {
    const body = await readJsonBody(req);
    const code = String(body.customerCode || "").trim().toLocaleUpperCase("tr-TR");
    if (!code) {
      sendJson(res, 400, { ok: false, error: "customerCode gerekli." });
      return;
    }
    const payload = {
      points: Math.max(0, Number(body.points || 0)),
      total_points: Math.max(0, Number(body.totalPoints || 0)),
      rewards_earned: Math.max(0, Number(body.rewardsEarned || 0)),
      rewards_redeemed: Math.max(0, Number(body.rewardsRedeemed || 0)),
      total_purchases: Math.max(0, Number(body.totalPurchases || 0)),
      last_purchase_at: body.lastPurchaseAt || null,
      updated_at: new Date().toISOString()
    };
    const updated = await supabaseRest(`customers?customer_code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    sendJson(res, 200, { ok: true, customer: updated?.[0] ? customerFromDb(updated[0]) : null });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message });
  }
}

async function sendWhatsAppText(message, recipient) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = normalizeRecipient(recipient);

  if (!token || !phoneNumberId) {
    const missing = [
      !token ? "WHATSAPP_TOKEN" : null,
      !phoneNumberId ? "WHATSAPP_PHONE_NUMBER_ID" : null
    ].filter(Boolean);
    const error = new Error(`Missing WhatsApp config: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: message
      }
    })
  });

  const responseText = await response.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    data = { raw: responseText };
  }

  if (!response.ok) {
    const error = new Error("Meta WhatsApp API request failed");
    error.statusCode = response.status;
    error.meta = data;
    throw error;
  }

  return data;
}

async function handleWhatsAppSend(req, res) {
  try {
    const body = await readJsonBody(req);
    const allowedTypes = ["critical-stock", "end-of-day"];

    if (!allowedTypes.includes(body.type)) {
      sendJson(res, 400, {
        ok: false,
        error: "Invalid notification type"
      });
      return;
    }

    if (typeof body.message !== "string" || !body.message.trim()) {
      sendJson(res, 400, {
        ok: false,
        error: "Message is required"
      });
      return;
    }

    const recipient = normalizeRecipient(body.to);
    const meta = await sendWhatsAppText(body.message.trim(), recipient);
    sendJson(res, 200, {
      ok: true,
      to: recipient,
      type: body.type,
      meta
    });
  } catch (error) {
    console.error("[WhatsApp] Send failed", {
      message: error.message,
      statusCode: error.statusCode || 500,
      meta: error.meta || null
    });
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message,
      meta: error.meta || null
    });
  }
}

loadEnvFile();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "POST" && pathname === "/api/food/whatsapp/send") {
    handleWhatsAppSend(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/customer/register") {
    handleCustomerRegister(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/customer/lookup") {
    handleCustomerLookup(req, res, url);
    return;
  }

  if (req.method === "POST" && pathname === "/api/customer/loyalty-update") {
    handleCustomerLoyaltyUpdate(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/config") {
    handleConfig(req, res);
    return;
  }

  if (pathname.startsWith("/assets/")) {
    sendFile(res, path.join(publicDir, pathname));
    return;
  }

  if (pathname === "/app.js" || pathname === "/styles.css" || pathname === "/supabase-client.js" || pathname === "/auth.js" || pathname === "/data-service.js" || pathname === "/ingredient-service.js" || pathname === "/recipe-service.js" || pathname === "/offline-sync.js" || pathname === "/import-export.js" || pathname === "/backup-service.js") {
    sendFile(res, path.join(publicDir, pathname));
    return;
  }

  if (pathname === "/" || pathname === "/demo/food" || pathname === "/demo/food/admin" || pathname === "/customer" || pathname === "/customer/register" || pathname === "/customer/me") {
    sendFile(res, path.join(publicDir, "index.html"));
    return;
  }

  res.writeHead(302, { Location: "/demo/food" });
  res.end();
});

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Nexora Food AI demo running at http://0.0.0.0:${PORT}/demo/food`);
  });
}

module.exports = { server, port: PORT, PORT };

