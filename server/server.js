const { randomUUID } = require("crypto");
const cors = require("cors");
const express = require("express");

const app = express();
const port = 5000;
const nodeId = process.env.NODE_ID || "NODE-A";
const requiredSosFields = [
    "messageId",
    "sourceNode",
    "type",
    "priority",
    "message",
    "location",
    "timestamp"
];

function validateSosMessage(sos) {
    if (!sos || typeof sos !== "object" || Array.isArray(sos)) {
        return "Request body must be a JSON object";
    }

    const missingField = requiredSosFields.find((field) => {
        return sos[field] === undefined || sos[field] === null || sos[field] === "";
    });

    if (missingField) {
        return `Missing required field: ${missingField}`;
    }

    if (typeof sos.location !== "object" || Array.isArray(sos.location)) {
        return "location must be an object";
    }

    return null;
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        node: nodeId,
        status: "online",
        phase: 1
    });
});

app.get("/test", (req, res) => {
    res.json({
        node: nodeId,
        message: `Hello from ${nodeId}`,
        communication: "Local Wi-Fi communication works"
    });
});

app.post("/sos", (req, res) => {
    const sos = {
        messageId: `SOS-${randomUUID()}`,
        sourceNode: nodeId,
        type: req.body?.type,
        priority: req.body?.priority,
        message: req.body?.message,
        location: req.body?.location,
        timestamp: new Date().toISOString()
    };
    const validationError = validateSosMessage(sos);

    if (validationError) {
        return res.status(400).json({
            success: false,
            error: validationError
        });
    }

    return res.status(201).json({
        success: true,
        messageId: sos.messageId,
        createdBy: nodeId,
        sos
    });
});

app.post("/receive-sos", (req, res) => {
    const validationError = validateSosMessage(req.body);

    if (validationError) {
        return res.status(400).json({
            success: false,
            error: validationError
        });
    }

    const sos = req.body;

    console.log("================================");
    console.log("SOS RECEIVED");
    console.log("================================");
    console.log(`Message ID: ${sos.messageId}`);
    console.log(`Source: ${sos.sourceNode}`);
    console.log(`Type: ${sos.type}`);
    console.log(`Priority: ${sos.priority}`);
    console.log(`Message: ${sos.message}`);
    console.log(`Location: ${sos.location.latitude}, ${sos.location.longitude}`);
    console.log(`Timestamp: ${sos.timestamp}`);
    console.log("================================");

    return res.json({
        success: true,
        receivedBy: nodeId,
        messageId: sos.messageId
    });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`${nodeId} server running on http://0.0.0.0:${port}`);
});
