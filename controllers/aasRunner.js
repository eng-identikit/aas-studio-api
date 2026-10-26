const axios = require("axios");

// ---------------------------------------------------------------------------
// aas-server-runner proxy (debug AAS server lifecycle).
//
// The browser never talks to the runner directly: the frontend POSTs the AAS
// environment here, the API forwards it to the runner control API
// (AAS_RUNNER_URL, default http://localhost:6790), the runner spawns the debug
// server, and the response cascades back to the frontend.
// ---------------------------------------------------------------------------

const RUNNER_URL = (process.env.AAS_RUNNER_URL || "http://localhost:6790").replace(/\/+$/, "");
// /runner/start replies only when the debug server is ready — keep this above
// the runner's own readiness timeout (20s).
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Public URL the browser can use to reach the debug AAS server: the runner
 * host with the debug port. Correct as long as both runner ports are exposed
 * on the same host, which is how the service is deployed (compose/Docker).
 */
function debugUrl(port) {
  // Dietro un Ingress (Kubernetes) l'host del runner non è raggiungibile dal
  // browser: in quel caso l'URL pubblico del debug server arriva da env.
  if (process.env.AAS_DEBUG_PUBLIC_URL) return process.env.AAS_DEBUG_PUBLIC_URL.replace(/\/+$/, "");
  try {
    const u = new URL(RUNNER_URL);
    return `${u.protocol}//${u.hostname}:${port}`;
  } catch {
    return `http://localhost:${port}`;
  }
}

function withDebugUrl(data) {
  return { ...data, debugUrl: data && data.port ? debugUrl(data.port) : null };
}

/**
 * Forward a request to the runner control API. Maps failures onto the app's
 * envelope: 503 = runner unreachable, 502 = runner refused/errored.
 * Returns the runner's JSON payload, or null if a response was already sent.
 */
async function forward(res, { method, path, body, params }) {
  let r;
  try {
    r = await axios({
      method,
      url: `${RUNNER_URL}${path}`,
      data: body,
      params,
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
  } catch (err) {
    res.status(503).json({
      status: "Failure",
      message: `aas-server-runner non raggiungibile (${RUNNER_URL})`,
    });
    return null;
  }
  if (r.status < 200 || r.status >= 300) {
    const detail = r.data && r.data.detail ? String(r.data.detail) : `Runner: HTTP ${r.status}`;
    res.status(502).json({ status: "Failure", message: detail });
    return null;
  }
  return r.data;
}

/** POST /runner/start — body { environment, port? } */
exports.start = async (req, res) => {
  const { environment, port } = req.body || {};
  if (!environment || !environment.shells || Object.keys(environment.shells).length === 0) {
    return res.status(400).json({ status: "Failure", message: "environment.shells mancante o vuoto" });
  }
  const data = await forward(res, { method: "post", path: "/runner/start", body: { environment, port } });
  if (data) res.status(200).json({ status: "Success", data: withDebugUrl(data) });
};

/** POST /runner/stop */
exports.stop = async (req, res) => {
  const data = await forward(res, { method: "post", path: "/runner/stop" });
  if (data) res.status(200).json({ status: "Success", data: withDebugUrl(data) });
};

/** GET /runner/status */
exports.status = async (req, res) => {
  const data = await forward(res, { method: "get", path: "/runner/status" });
  if (data) res.status(200).json({ status: "Success", data: withDebugUrl(data) });
};

/** GET /runner/logs?tail=200 */
exports.logs = async (req, res) => {
  const tail = Number.parseInt(req.query.tail, 10) || 200;
  const data = await forward(res, { method: "get", path: "/runner/logs", params: { tail } });
  if (data) res.status(200).json({ status: "Success", data });
};
