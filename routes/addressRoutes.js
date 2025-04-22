const express = require("express");
const { getAddressData } = require("../controllers/addressController");

const router = express.Router();

router.get("/api/address/:address", getAddressData);

module.exports = router;
