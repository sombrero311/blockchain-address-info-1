require("dotenv").config();
const express = require("express");
const cors = require("cors");
const addressRoutes = require("./routes/addressRoutes");
const rawTxRoutes = require("./routes/rawTxRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(addressRoutes);  // the address routes
app.use(rawTxRoutes); // new route

//aws  testing
app.get("/", (req, res) => {
    res.send("Hello THERE!");
});
//aws  testing
app.get("/check", (req, res) => {
    res.send("Checking!");
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
