require("dotenv").config();
const express = require("express");
const cors = require("cors");
const addressRoutes = require("./routes/addressRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(addressRoutes);  // the address routes

app.get("/", (req, res) => {
    res.send("Hello THERE!");
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
