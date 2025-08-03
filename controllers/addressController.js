const axios = require('axios')
const crypto = require("crypto");
const { getHash160 } = require("../utils/hashUtils");

function deterministicTxIndex(txid, blockHeight) {
    const hash = crypto.createHash("sha256").update(txid).digest("hex");
    const hashNum = parseInt(hash.slice(0, 12), 16);
    return blockHeight * 1e9 + (hashNum % 1e6);
}

const formatWitness = (witnessArr) => {
    if (!Array.isArray(witnessArr) || !witnessArr.length) return "";

    return witnessArr.map((item, idx) => {
        // converting the base64 to hex for witness data
        const hex = Buffer.from(item, 'base64').toString('hex');
        const length = hex.length / 2;
        let prefix = "";

        // removeing or modifying this prefix handling if it's not needed
        if (length < 0x4c) {
            prefix = length.toString(16).padStart(2, '0');
        } else if (length <= 0xff) {
            prefix = '4c' + length.toString(16).padStart(2, '0');
        } else if (length <= 0xffff) {
            prefix = '4d' + length.toString(16).padStart(4, '0').match(/../g).reverse().join('');
        } else {
            prefix = '4e' + length.toString(16).padStart(8, '0').match(/../g).reverse().join('');
        }

        // debugging, we can check the raw witness 
        console.log(`Witness ${idx}: ${item} => hex=${hex}, prefix=${prefix}`);

        // this will eturn the formatted witness with the length prefix added own logic can't replicate tthe blockchain.info
        return prefix + hex;
    }).join('');
};


// fetch address-related data
async function getAddressData(req, res) {
    const address = req.params.address;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    try {
        // fetching address information (transaction count)
        let addressInfoRes;
        try {
            addressInfoRes = await axios.get(`https://blockstream.info/api/address/${address}?limit=100`);
        } catch (error) {
            console.error('Failed to fetch address info:', error.message);
            addressInfoRes = { data: { chain_stats: { tx_count: 0 } } };
        }

        const totalTxs = addressInfoRes.data.chain_stats.tx_count;

        let allTxs = [];
        let lastSeenTxid = null;
        let fetchedCount = 0;

        // Fetch all transactions related to the address
        while (fetchedCount < totalTxs) {
            const url = lastSeenTxid
                ? `https://blockstream.info/api/address/${address}/txs/chain/${lastSeenTxid}`
                : `https://blockstream.info/api/address/${address}/txs`;

            const txsRes = await axios.get(url).catch(() => ({ data: [] }));
            if (!txsRes.data.length) break;

            allTxs.push(...txsRes.data);
            fetchedCount += txsRes.data.length;
            lastSeenTxid = txsRes.data[txsRes.data.length - 1].txid;
        }

        // fetching unspent transaction outputs (UTXOs)
        const utxosRes = await axios.get(`https://blockstream.info/api/address/${address}/utxo`)
            .catch(() => ({ data: [] }));
        const utxos = utxosRes.data;
        const utxoSet = new Set(utxos.map(u => `${u.txid}:${u.vout}`));

        // maping to track transaction data
        const spentMap = {};
        const txIndexMap = {};
        const blockTxCounter = {};

        allTxs.forEach((tx) => {
            const block = tx.status.block_height || 0;
            blockTxCounter[block] = (blockTxCounter[block] || 0) + 1;
            const index = deterministicTxIndex(tx.txid, block);
            txIndexMap[tx.txid] = index;

            tx.vin.forEach(input => {
                if (input.txid) {
                    const key = `${input.txid}:${input.vout}`;
                    spentMap[key] = spentMap[key] || [];
                    spentMap[key].push({
                        tx_index: index,
                        n: input.vout ?? 0
                    });
                }
            });
        });

        // Sort transactions by block height and timestamp
        const chronoTxs = [...allTxs].sort((a, b) => {
            const blockA = a.status.block_height || 0;
            const blockB = b.status.block_height || 0;
            if (blockA !== blockB) return blockA - blockB;

            const timeA = a.status.block_time || 0;
            const timeB = b.status.block_time || 0;
            return timeA - timeB;
        });

        let runningBalance = 0;
        const balanceMap = {};
        const resultMap = {};

        // calculate net effects and running balance for each transaction
        chronoTxs.forEach(tx => {
            let netEffect = 0;
            const isCoinbase = tx.vin.some(input => input.is_coinbase);

            const received = tx.vout.reduce((sum, out) =>
                out.scriptpubkey_address === address ? sum + out.value : sum, 0);

            const sent = tx.vin.reduce((sum, input) =>
                input.prevout?.scriptpubkey_address === address ? sum + input.prevout.value : sum, 0);

            if (isCoinbase) {
                netEffect = received;
            } else if (sent > 0 && received > 0) {
                netEffect = received - sent;
            } else if (sent > 0) {
                netEffect = -sent;
            } else {
                netEffect = received;
            }

            resultMap[tx.txid] = netEffect;
            runningBalance += netEffect;
            balanceMap[tx.txid] = runningBalance;
        });

        // process transaction data with inputs and outputs
        const processedTxs = allTxs.map(tx => {
            const blockHeight = tx.status.block_height || 0;
            const tx_index = txIndexMap[tx.txid] || deterministicTxIndex(tx.txid, blockHeight);
            const timestamp = tx.status.block_time || 0;

            return {
                hash: tx.txid,
                ver: tx.version,
                vin_sz: tx.vin.length,
                vout_sz: tx.vout.length,
                size: tx.size,
                weight: tx.weight || 0,
                fee: tx.fee || 0,
                relayed_by: "0.0.0.0", // blockchain.info always includes this
                lock_time: tx.locktime,
                tx_index, // generate similar to blockchain.info
                double_spend: false, // always false unless proven
                time: timestamp,
                block_index: blockHeight,
                block_height: blockHeight,
                inputs: tx.vin.map((input, idx) => {
                    const prev = input.prevout || {};
                    const key = input.txid ? `${input.txid}:${input.vout}` : null;
                    const witness = input.witness ? formatWitness(input.witness) : "";

                    return {
                        sequence: input.sequence,
                        witness,
                        script: input.scriptsig || "",
                        index: idx,
                        prev_out: {
                            type: 0,
                            spent: true,
                            value: prev.value || 0,
                            spending_outpoints: key ? (spentMap[key] || []) : [],
                            n: input.vout ?? 0,
                            tx_index: input.txid ? (txIndexMap[input.txid] || 0) : 0,
                            script: prev.scriptpubkey || "",
                            addr: prev.scriptpubkey_address || ""
                        }
                    };
                }),
                out: tx.vout.map((out, idx) => {
                    const key = `${tx.txid}:${idx}`;
                    const isUnspent = utxoSet.has(key);
                    return {
                        type: 0,
                        spent: !isUnspent,
                        value: out.value,
                        spending_outpoints: !isUnspent ? (spentMap[key] || []) : [],
                        n: idx,
                        tx_index,
                        script: out.scriptpubkey,
                        addr: out.scriptpubkey_address || ""
                    };
                }),
                result: resultMap[tx.txid] || 0,
                balance: balanceMap[tx.txid] || 0
            };
        }).slice(offset, offset + limit);

        const response = {
            hash160: getHash160(address),
            address,
            n_tx: totalTxs,
            n_unredeemed: utxos.length,
            total_received: addressInfoRes.data.chain_stats.funded_txo_sum,
            total_sent: addressInfoRes.data.chain_stats.spent_txo_sum,
            final_balance: addressInfoRes.data.chain_stats.funded_txo_sum - addressInfoRes.data.chain_stats.spent_txo_sum,
            txs: processedTxs
        };

        res.json(response);
        console.log('Fetched address data');
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error fetching address data",
            details: error.message
        });
    }
}

// new function that returns raw transaction hex data from a given txid
async function getRawTxHex(req, res) {
    const txid = req.params.txid;

    try {
        const response = await axios.get(`https://blockstream.info/api/tx/${txid}/hex`);
        res.type('text/plain').send(response.data);
    } catch (error) {
        console.error("Error  fetching raw tx hex:", error.message);
        res.status(500).json({ error: "Failed to fetch raw transaction hex", details: error.message });
    }
}
module.exports = { getAddressData, getRawTxHex };
