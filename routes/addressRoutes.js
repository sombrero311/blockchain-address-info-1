const express = require("express");
const { getAddressData, getRawTxHex } = require("../controllers/addressController");

const router = express.Router();

router.get("/api/address/:address" , getAddressData);
router.get("/api/rawtx/:txid", getRawTxHex);

module.exports = router;
