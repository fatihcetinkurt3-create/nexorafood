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

  if (req.method === "GET" && pathname === "/api/config") {
    handleConfig(req, res);
    return;
  }

  if (pathname.startsWith("/assets/")) {
    sendFile(res, path.join(publicDir, pathname));
    return;
  }

  if (pathname === "/app.js" || pathname === "/styles.css" || pathname === "/supabase-client.js" || pathname === "/auth.js" || pathname === "/data-service.js" || pathname === "/offline-sync.js" || pathname === "/import-export.js" || pathname === "/backup-service.js") {
    sendFile(res, path.join(publicDir, pathname));
    return;
  }

  if (pathname === "/" || pathname === "/demo/food" || pathname === "/demo/food/admin") {
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

