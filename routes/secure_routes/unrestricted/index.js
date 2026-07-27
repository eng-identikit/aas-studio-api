const express = require("express");
const multer = require("multer");
const router = express.Router();

const session = require("./session");
const idtaCatalog = require("../../../controllers/idtaCatalog");
const extraction = require("../../../controllers/extraction");

// PDF in memoria (max 20 MB): il buffer va direttamente a pdf-parse.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use("/session", session);

router.get("/idta/catalog", idtaCatalog.getCatalog);
router.delete("/idta/catalog/cache", idtaCatalog.invalidateCache);

// Estrazione AI da PDF (Fase 1b)
router.post("/extract", upload.single("file"), extraction.extract);

module.exports = router;
