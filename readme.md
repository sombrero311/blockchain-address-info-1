This code fetches Bitcoin address data from Blockstream's API, including transaction history, UTXOs, balances, and formats it to mimic Blockchain.info's API style.
It calculates transaction effects (received/sent), running balances, and formats inputs, outputs, and witness data.
The final structured JSON response includes address details, transaction summaries, and paginated transaction lists.

By default the API return 51 transactions details. For more you can add a query at end of the url like this:
http://localhost:5000/api/address/{ADDRESS}?limit=100