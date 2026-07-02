const express = require('express');
const router = express.Router();

const session = require("./session");
const aas = require("../unrestricted/aas");
const aasRemote = require("../unrestricted/aasRemote");
const aasRunner = require("../unrestricted/aasRunner");

router.use("/session", session);
router.use("/aas", aas);
router.use("/aas-remote", aasRemote);
router.use("/runner", aasRunner);

module.exports = router;
