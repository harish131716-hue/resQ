const { randomUUID } = require("crypto");
const cors = require("cors");
const express = require("express");

const app = express();
const port = 5000;
const nodeId = process.env.NODE_ID || "NODE-A";
const relayTarget = process.env.RELAY_TARGET;
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

    console.log(`[${nodeId}] SOS received: ${sos.messageId}`);
    console.log(`[${nodeId}] Source: ${sos.sourceNode}`);
    console.log(`[${nodeId}] Type: ${sos.type}`);
    console.log(`[${nodeId}] Priority: ${sos.priority}`);
    console.log(`[${nodeId}] Message: ${sos.message}`);
    console.log(`[${nodeId}] Location: ${sos.location.latitude}, ${sos.location.longitude}`);
    console.log(`[${nodeId}] Timestamp: ${sos.timestamp}`);

    if (relayTarget) {
        const relayUrl = `${relayTarget.replace(/\/$/, "")}/receive-sos`;

        console.log(`[${nodeId}] Relaying ${sos.messageId} to ${relayUrl}`);

        fetch(relayUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(sos)
        })
            .then(async (relayResponse) => {
                if (!relayResponse.ok) {
                    throw new Error(`HTTP ${relayResponse.status}`);
                }

                console.log(`[${nodeId}] Relay successful`);
            })
            .catch((error) => {
                console.error(`[${nodeId}] Relay failed: ${error.message}`);
            });
    }

    return res.json({
        success: true,
        receivedBy: nodeId,
        messageId: sos.messageId,
        relayed: Boolean(relayTarget)
    });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`${nodeId} server running on http://0.0.0.0:${port}`);
});
