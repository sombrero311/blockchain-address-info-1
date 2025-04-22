const axios = require("axios");
const { getHash160 } = require("../utils/hashUtils");

async function getAddressData(req, res) {
    const address = req.params.address;
    console.log(`Fetching data for address: ${address}`);

    try {
        const addressInfoPromise = axios.get(`https://blockstream.info/api/address/${address}`).catch(() => null);
        const txsPromise = axios.get(`https://blockstream.info/api/address/${address}/txs`).catch(() => null);
        const utxosPromise = axios.get(`https://blockstream.info/api/address/${address}/utxo`).catch(() => null);

        const [addressInfoRes, txsRes, utxosRes] = await Promise.all([addressInfoPromise, txsPromise, utxosPromise]);

        const addressInfoData = addressInfoRes?.data || {
            chain_stats: { tx_count: 0, funded_txo_sum: 0, spent_txo_sum: 0 },
            mempool_stats: { tx_count: 0, funded_txo_sum: 0, spent_txo_sum: 0 }
        };

        const txsData = txsRes?.data || [];
        const utxosData = utxosRes?.data || [];

        const json = {
            hash160: getHash160(address),
            address: address,
            n_tx: addressInfoData.chain_stats.tx_count,
            n_unredeemed: utxosData.length,
            total_received: addressInfoData.chain_stats.funded_txo_sum,
            total_sent: addressInfoData.chain_stats.spent_txo_sum,
            final_balance: addressInfoData.chain_stats.funded_txo_sum - addressInfoData.chain_stats.spent_txo_sum,
            txs: txsData.map(tx => ({
                hash: tx.txid,
                ver: tx.version,
                vin_sz: tx.vin.length,
                vout_sz: tx.vout.length,
                size: tx.size,
                weight: tx.weight,
                fee: tx.fee,
                relayed_by: "0.0.0.0",
                lock_time: tx.locktime,
                tx_index: parseInt(tx.txid.slice(0, 13), 16),
                double_spend: false,
                time: tx.status.block_time || Math.floor(Date.now() / 1000),
                block_index: tx.status.block_height,
                block_height: tx.status.block_height,
                inputs: tx.vin.map(input => ({
                    sequence: input.sequence,
                    witness: input.witness || "",
                    script: input.scriptsig || "",
                    index: input.vout,
                    prev_out: {
                        type: 0,
                        spent: true,
                        value: input.prevout?.value || 0,
                        spending_outpoints: [],
                        n: input.prevout?.n || 0,
                        tx_index: parseInt(input.txid?.slice(0, 13) || "0", 16),
                        script: input.prevout?.scriptpubkey || "",
                        addr: input.prevout?.scriptpubkey_address || ""
                    }
                })),
                out: tx.vout.map((out, idx) => ({
                    type: 0,
                    spent: false,
                    value: out.value,
                    spending_outpoints: [],
                    n: idx,
                    tx_index: parseInt(tx.txid.slice(0, 13), 16),
                    script: out.scriptpubkey,
                    addr: out.scriptpubkey_address
                })),
                result: tx.vout.reduce((acc, o) => o.scriptpubkey_address === address ? acc + o.value : acc, 0),
                balance: 0
            }))
        };

        res.json(json);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch address data.", details: err.message });
    }
}

module.exports = { getAddressData };
