const express = require("express");
const router = express.Router();

const aasRunner = require("../../../controllers/aasRunner");

// ---------------------------------------------------------------------------
// Debug AAS server lifecycle (aas-server-runner proxy). The frontend never
// reaches the runner directly: everything goes through these endpoints.
// ---------------------------------------------------------------------------

// POST /runner/start  → deploy the AAS environment and start the debug server
router.post("/start", aasRunner.start);

// POST /runner/stop   → stop the debug server
router.post("/stop", aasRunner.stop);

// GET /runner/status  → { running, port, uptimeSeconds, model, debugUrl, ... }
router.get("/status", aasRunner.status);

// GET /runner/logs    → last stdout/stderr lines of the debug server
router.get("/logs", aasRunner.logs);

module.exports = router;
