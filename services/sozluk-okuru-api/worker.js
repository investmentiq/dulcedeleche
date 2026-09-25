const BASE = "https://api.eksisozluk.com";
const USER_AGENT = "eksisozluk-android/144";
const APP_UUID = "c8ecd738-dc33-45a4-a977-ae8e2a51c644";
const MODULUS = BigInt("0xe1c34ed4c19a8c1edf4f1b99d5b0be952c0cba86fb6204c7e38d675a04c0f810e5c396dd606c8022b4c291a48baf08a6806e6b1d3da2ccfab39f5ac6468aa6395d95c083244c5d05c2667e4930eed3dcc5db2ef2eff3a467d15a34e413043a024b5b76cf7f160ba630cc0e1bfc64eb73f1457cc9d5c3818f8085a5b3190d60c22ca5bb4b11671019a6bbe9ed6718f5b12a0374bc5e93da5be125a1e7bdaf6c2daf6ff95da07089442c5d8ac886cd68dd33a32d1b9daecc875140f19ffc0453c7d9a20876fbe12327191dc21265db1df20887b1749891994ea8fec94bc0a12a059471c3cd42523e9fb35bc662062057d63d714839ce6c59b350f91b6b2d8ac9a3");

const ALLOWED_ORIGINS = new Set([
  "https://mglabs.investilogiusa.com",
  "http://127.0.0.1:8765",
  "http://localhost:8765"
]);

let authCache;

function modPow(base, exponent, modulus) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % modulus;
    exponent >>= 1n;
    base = (base * base) % modulus;
  }
  return result;
}

function nonZeroBytes(size) {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    do crypto.getRandomValues(bytes.subarray(i, i + 1)); while (bytes[i] === 0);
  }
  return bytes;
}

function rsaPkcs1(message) {
  const data = new TextEncoder().encode(message);
  if (data.length > 245) throw new Error("Auth payload too large");
  const encoded = new Uint8Array(256);
  encoded[1] = 2;
  encoded.set(nonZeroBytes(256 - data.length - 3), 2);
  encoded[255 - data.length] = 0;
  encoded.set(data, 256 - data.length);

  let value = 0n;
  for (const byte of encoded) value = (value << 8n) | BigInt(byte);
  let encrypted = modPow(value, 65537n, MODULUS);

  const output = new Uint8Array(256);
  for (let i = 255; i >= 0; i--) {
    output[i] = Number(encrypted & 255n);
    encrypted >>= 8n;
  }

  let binary = "";
  for (const byte of output) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function apiSecret(serverTime, clientSecret) {
  const day = Math.floor(Math.random() * 5000) + 1;
  const hour = Math.floor(Math.random() * 5000) + 1;
  const minute = Math.floor(Math.random() * 10000) + 1;
  const adjusted = serverTime - day * 86400000 - hour * 3600000 - minute * 60000;
  const pool = Array.from({ length: 6 }, () => crypto.randomUUID().replaceAll("-", "")).join("");
  const length = Math.floor(Math.random() * 41) + 40;
  return rsaPkcs1(`${pool.slice(0, length)}-${APP_UUID}-${length * length}-${adjusted}-${day}-${hour}-${minute}-${USER_AGENT}-${clientSecret}`);
}

async function decode(response) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Ekşi API invalid response (${response.status})`);
  }
  if (!response.ok) throw new Error(`Ekşi API ${response.status}`);
  if (payload.Success === false) throw new Error(String(payload.Message || "Ekşi API request failed"));
  return payload.Data ?? payload;
}

async function authenticate() {
  if (authCache && authCache.expires > Date.now() + 60000) return authCache;

  const timeResponse = await fetch(`${BASE}/v2/clientsettings/time`, {
    headers: { "User-Agent": USER_AGENT }
  });
  const serverTime = Number(await decode(timeResponse));

  const secret = crypto.randomUUID();
  const body = new URLSearchParams({
    DeviceModel: "Google sdk_gphone_x86_64",
    Platform: "g",
    Version: "2.4.10",
    Build: "144",
    "Api-Secret": apiSecret(serverTime, secret),
    "Client-Secret": secret,
    ClientUniqueId: crypto.randomUUID()
  });

  const tokenResponse = await fetch(`${BASE}/v2/account/anonymoustoken`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Client-Secret": secret,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const tokenData = await decode(tokenResponse);
  const token = String(tokenData.access_token || tokenData.AccessToken || "");
  if (!token) throw new Error("Anonymous Ekşi session could not be opened");

  authCache = {
    token,
    secret,
    expires: Date.now() + Number(tokenData.expires_in || tokenData.ExpiresIn || 1800) * 1000
  };
  return authCache;
}

async function apiRequest(path, init, retry = true) {
  const auth = await authenticate();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Bearer ${auth.token}`,
      "Client-Secret": auth.secret,
      ...(init?.headers || {})
    }
  });
  if (response.status === 401 && retry) {
    authCache = undefined;
    return apiRequest(path, init, false);
  }
  return decode(response);
}

function clampPage(value) {
  const n = Number(value || 1);
  return Math.min(250, Math.max(1, Number.isFinite(n) ? Math.floor(n) : 1));
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(request, value, status = 200, maxAge = 20) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${maxAge}`,
      ...corsHeaders(request)
    }
  });
}

async function handleApi(url) {
  const path = url.pathname.replace(/\/+$/, "");
  const page = clampPage(url.searchParams.get("page"));

  if (path === "/v1/health") {
    return { data: { ok: true, service: "mgl-sozluk-api", time: new Date().toISOString() }, maxAge: 0 };
  }

  if (path === "/v1/feed") {
    const kind = ["popular", "today", "debe"].includes(url.searchParams.get("kind"))
      ? url.searchParams.get("kind")
      : "popular";
    let data;
    if (kind === "debe") data = await apiRequest(`/v2/index/debe/?p=${page}`);
    else if (kind === "today") data = await apiRequest(`/v2/index/today?p=${page}`);
    else data = await apiRequest(`/v2/index/popular/?p=${page}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Filters: [] })
    });
    return { data, maxAge: 45 };
  }

  if (path === "/v1/search") {
    const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
    if (!q) throw new Response("Missing q", { status: 400 });
    const data = await apiRequest(`/v2/index/search/?p=${page}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Keywords: q, SortOrder: 1, FavoritedOnly: false, NiceOnly: false })
    });
    return { data, maxAge: 30 };
  }

  if (path === "/v1/topic") {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw new Response("Invalid id", { status: 400 });
    return { data: await apiRequest(`/v2/topic/${id}?p=${page}`), maxAge: 20 };
  }

  if (path === "/v1/entry") {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw new Response("Invalid id", { status: 400 });
    return { data: await apiRequest(`/v2/entry/${id}`), maxAge: 30 };
  }

  if (path === "/v1/user") {
    const nick = (url.searchParams.get("nick") || "").trim().slice(0, 80);
    if (!nick) throw new Response("Missing nick", { status: 400 });
    return { data: await apiRequest(`/v2/user/${encodeURIComponent(nick)}/`), maxAge: 120 };
  }

  throw new Response("Not found", { status: 404 });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== "GET") {
      return json(request, { ok: false, error: "Method not allowed" }, 405, 0);
    }

    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(request, { ok: false, error: "Origin not allowed" }, 403, 0);
    }

    try {
      const result = await handleApi(new URL(request.url));
      return json(request, { ok: true, data: result.data }, 200, result.maxAge);
    } catch (error) {
      if (error instanceof Response) {
        return json(request, { ok: false, error: await error.text() }, error.status, 0);
      }
      return json(request, {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown upstream error"
      }, 502, 0);
    }
  }
};
