const sourceUrl = process.env.SOURCE_URL || "http://localhost:5000";
const targetUrl = process.argv[2] || process.env.TARGET_URL || "http://localhost:5000/receive-sos";

const sosInput = {
    type: "TRAPPED",
    priority: 100,
    message: "Person trapped under rubble",
    location: {
        latitude: 11.0168,
        longitude: 76.9558
    }
};

async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(`${response.status} ${JSON.stringify(data)}`);
    }

    return data;
}

async function sendSos() {
    const created = await postJson(`${sourceUrl}/sos`, sosInput);
    const acknowledgement = await postJson(targetUrl, created.sos);

    console.log("SOS SENT");
    console.log(`Message ID: ${acknowledgement.messageId}`);
    console.log(`Received by: ${acknowledgement.receivedBy}`);
}

sendSos().catch((error) => {
    console.error(`SOS send failed: ${error.message}`);
    process.exitCode = 1;
});
