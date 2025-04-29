const { address: bjsAddress } = require('bitcoinjs-lib');

// this function is to extract hash160 from a Base58Check address;
function getHash160(addr) {
    try {
        const decoded = bjsAddress.fromBech32(addr); // handling Bech32
        if (decoded.data) {
            return decoded.data.length === 20 ? Buffer.from(decoded.data).toString('hex') : "";
        }
    } catch (bech32Error) {
        // not a Bech32 address, try Base58
        try {
            const decoded = bjsAddress.fromBase58Check(addr);
            return decoded.hash.toString('hex');
        } catch (base58Error) {
            return "";
        }
    }
}

module.exports = { getHash160 };
