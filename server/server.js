const { randomUUID } = require("crypto");
const cors = require("cors");
const express = require("express");

const app = express();
const port = 5000;
const nodeId = process.env.NODE_ID || "NODE-A";
const relayTarget = process.env.RELAY_TARGET;
const ttlMs = getPositiveNumber(process.env.SOS_TTL_MS, 300000);
const clockSkewMs = getPositiveNumber(process.env.SOS_CLOCK_SKEW_MS, 30000);
const seenMessages = new Set();
const priorityMapping = Object.freeze({
    TRAPPED: 100,
    MEDICAL: 90,
    FIRE: 85,
    MISSING: 80,
    WATER: 60,
    FOOD: 50
});
const defaultPriority = 40;
const requiredSosFields = [
    "messageId",
    "sourceNode",
    "type",
    "priority",
    "message",
    "location",
    "timestamp"
];

function getPositiveNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function calculatePriority(type) {
    const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";

    return priorityMapping[normalizedType] ?? defaultPriority;
}

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

function getMessageAge(sos) {
    const timestampMs = Date.parse(sos.timestamp);

    if (!Number.isFinite(timestampMs)) {
        return {
            error: "timestamp must be a valid ISO 8601 timestamp"
        };
    }

    const rawAgeMs = Date.now() - timestampMs;

    if (rawAgeMs < -clockSkewMs) {
        return {
            error: `timestamp is too far in the future; clock skew allowance is ${clockSkewMs}ms`
        };
    }

    return {
        ageMs: Math.max(0, rawAgeMs)
    };
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

    sos.priority = calculatePriority(sos.type);

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
    const messageAge = getMessageAge(sos);

    if (messageAge.error) {
        return res.status(400).json({
            success: false,
            error: messageAge.error,
            receivedBy: nodeId,
            messageId: sos.messageId,
            relayed: false
        });
    }

    if (messageAge.ageMs > ttlMs) {
        console.log(`[${nodeId}] Stale SOS rejected: ${sos.messageId}`);
        console.log(`[${nodeId}] Message age: ${messageAge.ageMs}ms`);
        console.log(`[${nodeId}] TTL: ${ttlMs}ms`);

        return res.status(410).json({
            success: false,
            stale: true,
            receivedBy: nodeId,
            messageId: sos.messageId,
            relayed: false
        });
    }

    console.log(`[${nodeId}] SOS is fresh: ${sos.messageId}`);
    console.log(`[${nodeId}] Message age: ${messageAge.ageMs}ms`);

    if (seenMessages.has(sos.messageId)) {
        console.log(`[${nodeId}] Duplicate SOS ignored: ${sos.messageId}`);

        return res.json({
            success: true,
            duplicate: true,
            stale: false,
            receivedBy: nodeId,
            messageId: sos.messageId,
            relayed: false
        });
    }

    seenMessages.add(sos.messageId);
    sos.priority = calculatePriority(sos.type);
    console.log(`[${nodeId}] Processing ${sos.messageId}`);
    console.log(`[${nodeId}] New SOS received: ${sos.messageId}`);
    console.log(`[${nodeId}] Added ${sos.messageId} to seen messages`);

    console.log(`[${nodeId}] Source: ${sos.sourceNode}`);
    console.log(`[${nodeId}] Type: ${sos.type}`);
    console.log(`[${nodeId}] Calculated priority: ${sos.priority}`);
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
        duplicate: false,
        stale: false,
        receivedBy: nodeId,
        messageId: sos.messageId,
        priority: sos.priority,
        relayed: Boolean(relayTarget)
    });
});

app.listen(port, "0.0.0.0", () => {
    console.log(`${nodeId} server running on http://0.0.0.0:${port}`);
});
