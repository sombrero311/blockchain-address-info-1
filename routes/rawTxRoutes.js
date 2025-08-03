const express = require("express");
const { getRawTxHex } = require("../controllers/addressController");

const router = express.Router();

// type of new page 
router.get("/api/rawtx/:txid" , getRawTxHex);

module.exports = router;