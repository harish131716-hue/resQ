const express = require("express");

const app = express();

app.get("/test", (req, res) => {
    res.json({
        node: "NODE-A",
        message: "Hello from NODE-A!",
        status: "Local Wi-Fi communication works!"
    });
});

app.listen(5000, "0.0.0.0", () => {
    console.log("NODE-A server running on port 5000");
});