# ResQMesh

## Phase 6: Backend priority engine

Phases 1-5 are preserved. Phase 6 calculates SOS urgency from its `type` after validation, freshness, and deduplication checks. The calculated priority is written into the SOS before it is logged, acknowledged, or relayed.

The Phase 1 project contains only:

```text
ResQMesh/
├── server/
│   ├── server.js
│   ├── package.json
│   └── test-send-sos.js
└── README.md
```

The server listens on port `5000` and binds to `0.0.0.0`, so it can receive requests through the host computer's LAN IPv4 address.


## Phase 10: Mesh network visualization

The dashboard includes a frontend-only mesh topology section. It polls each configured node's existing `GET /` and `GET /sos` endpoints, showing node ID, online/offline status, and received SOS count. Directed links represent the configured MVP path `NODE-A -> NODE-B -> NODE-C`. A link becomes active when matching `messageId` values appear in the downstream node feed, indicating that the SOS propagated successfully.

The default local node URLs are:

```text
NODE-A: http://localhost:5000
NODE-B: http://localhost:5001
NODE-C: http://localhost:5002
```

For a multi-laptop setup, configure the frontend before starting Vite:

```powershell
$env:VITE_NODE_A_URL = "http://NODE-A-IP:5000"
$env:VITE_NODE_B_URL = "http://NODE-B-IP:5000"
$env:VITE_NODE_C_URL = "http://NODE-C-IP:5000"
npm run dev
```

The existing SOS map, clustering, GPS, relay, TTL, deduplication, and priority behavior are unchanged.
## Install and start

Open a terminal in the `server` directory:

```cmd
cd server
npm install
npm start
```

By default, the node identity is `NODE-A`.

### Set the node identity on Windows

Windows CMD:

```cmd
set NODE_ID=NODE-A
npm start
```

Windows PowerShell:

```powershell
$env:NODE_ID = "NODE-A"
npm start
```

Use `NODE-B` or `NODE-C` instead of `NODE-A` when running the same server code on another computer. No source file changes are needed.

## Phase 1 test: two computers

1. Connect Laptop A and Laptop B to the same Wi-Fi network or mobile hotspot.
2. On Laptop A, open a terminal in `server`, set `NODE_ID=NODE-A`, and run `npm start`.
3. On Laptop A, run:

   ```cmd
   ipconfig
   ```

   Find Laptop A's IPv4 address for the connected Wi-Fi adapter, such as `192.168.1.25`.
4. On Laptop A, open [http://localhost:5000/test](http://localhost:5000/test). It should return JSON from `NODE-A`.
5. On Laptop B, open `http://<NODE-A-LAN-IP>:5000/test`, replacing `<NODE-A-LAN-IP>` with Laptop A's IPv4 address. For example:

   ```text
   http://192.168.1.25:5000/test
   ```

6. Laptop B should receive JSON similar to:

   ```json
   {
     "node": "NODE-A",
     "message": "Hello from NODE-A",
     "communication": "Local Wi-Fi communication works"
   }
   ```

`localhost` on Laptop B refers to Laptop B itself. It does not refer to Laptop A, so Laptop B must use Laptop A's LAN IPv4 address.

The health endpoint is available at `/` and returns the current node identity, online status, and phase number. The Phase 1 `/test` endpoint remains available.

## Phase 2 SOS endpoints

`POST /sos` creates a new SOS on the current node. Send JSON containing `type`, `priority`, `message`, and `location`:

```json
{
   "type": "TRAPPED",
   "priority": 100,
   "message": "Person trapped under rubble",
   "location": {
      "latitude": 11.0168,
      "longitude": 76.9558
   }
}
```

The server adds a unique UUID-based `messageId`, the configured `sourceNode`, and an ISO timestamp. The resulting message has this structure:

```json
{
   "messageId": "SOS-uuid",
   "sourceNode": "NODE-A",
   "type": "TRAPPED",
   "priority": 100,
   "message": "Person trapped under rubble",
   "location": {
      "latitude": 11.0168,
      "longitude": 76.9558
   },
   "timestamp": "2026-09-19T12:00:00.000Z"
}
```

`POST /receive-sos` accepts the complete SOS message, validates all required fields, logs it on the receiving terminal, optionally relays it once, and returns an acknowledgement. Malformed messages receive HTTP `400`.

## Phase 3: three-node relay test

Connect all three laptops to the same Wi-Fi network or mobile hotspot. Run the same server code from the `server` directory on each laptop. Use each laptop's active Wi-Fi IPv4 address from `ipconfig`; do not use `localhost` in a different laptop's URL.

### NODE-C: receiver only

Windows CMD:

```cmd
set NODE_ID=NODE-C
set RELAY_TARGET=
npm start
```

PowerShell:

```powershell
$env:NODE_ID = "NODE-C"
Remove-Item Env:RELAY_TARGET -ErrorAction SilentlyContinue
npm start
```

NODE-C has no relay target, so it only validates, logs, and acknowledges the SOS.

### NODE-B: automatic relay

Find NODE-C's LAN IPv4 address with `ipconfig`, then set it as NODE-B's relay target. Replace `10.0.0.30` with the actual NODE-C address.

Windows CMD:

```cmd
set NODE_ID=NODE-B
set RELAY_TARGET=http://10.0.0.30:5000
npm start
```

PowerShell:

```powershell
$env:NODE_ID = "NODE-B"
$env:RELAY_TARGET = "http://10.0.0.30:5000"
npm start
```

When NODE-B receives a valid SOS, it automatically POSTs the same SOS object to `RELAY_TARGET/receive-sos`. No manual forwarding action is used.

### NODE-A: create and send the SOS

Start NODE-A without `RELAY_TARGET`:

Windows CMD:

```cmd
set NODE_ID=NODE-A
set RELAY_TARGET=
npm start
```

PowerShell:

```powershell
$env:NODE_ID = "NODE-A"
Remove-Item Env:RELAY_TARGET -ErrorAction SilentlyContinue
npm start
```

In a second NODE-A terminal, find NODE-B's LAN IPv4 address and send one test SOS:

```cmd
npm run send-sos -- http://10.0.0.20:5000/receive-sos
```

Replace `10.0.0.20` with NODE-B's actual address. The message path is:

```text
NODE-A /sos -> NODE-B /receive-sos -> NODE-C /receive-sos
```

The original `messageId`, `sourceNode`, `type`, `priority`, `message`, `location`, and `timestamp` are sent unchanged from NODE-B to NODE-C.

## Phase 4 deduplication behavior

Deduplication is based only on `messageId`, using an in-memory JavaScript `Set`. It is not persisted across restarts and does not use message text, source node, timestamp, or IP address.

For a new message, the node:

1. Validates the SOS.
2. Adds its `messageId` to the Set before attempting relay.
3. Logs and processes the SOS.
4. Relays it once when `RELAY_TARGET` is configured.

For a duplicate message, the node logs `Duplicate SOS ignored`, does not process or relay it, and returns:

```json
{
   "success": true,
   "duplicate": true,
   "receivedBy": "NODE-B",
   "messageId": "SOS-001",
   "relayed": false
}
```

Invalid messages are rejected with HTTP `400` before they can enter the Set.

### Test the exact same SOS twice

With NODE-B running and NODE-C configured as its relay target, create one packet from NODE-A:

```powershell
$sos = @{
   messageId = "SOS-TEST-001"
   sourceNode = "NODE-A"
   type = "TRAPPED"
   priority = 100
   message = "Person trapped under rubble"
   location = @{ latitude = 11.0168; longitude = 76.9558 }
   timestamp = "2026-09-19T12:00:00.000Z"
} | ConvertTo-Json -Depth 5
```

Send that exact `$sos` variable to NODE-B twice, replacing the IP address:

```powershell
Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $sos
Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $sos
```

Expected first response:

```json
{
   "success": true,
   "duplicate": false,
   "receivedBy": "NODE-B",
   "messageId": "SOS-TEST-001",
   "relayed": true
}
```

Expected second response:

```json
{
   "success": true,
   "duplicate": true,
   "receivedBy": "NODE-B",
   "messageId": "SOS-TEST-001",
   "relayed": false
}
```

NODE-B should log one new SOS and one relay attempt, followed by `Duplicate SOS ignored`. NODE-C should receive and log the same `SOS-TEST-001` once. Sending the same packet directly to NODE-C twice should produce one new message and one duplicate response there as well.

## Phase 5 TTL and stale-message handling

Phase 5 checks the SOS `timestamp` before deduplication and relay. The default time-to-live is five minutes:

```text
SOS_TTL_MS=300000
```

Set `SOS_TTL_MS` before `npm start` to use another TTL. For example, a one-minute TTL in PowerShell:

```powershell
$env:SOS_TTL_MS = "60000"
```

The timestamp must be a valid ISO 8601 value. A message older than the configured TTL returns HTTP `410`, is not added to the deduplication Set, and is not relayed. A fresh first message continues through normal processing; a fresh repeat is handled by Phase 4 deduplication.

To allow small laptop clock differences, timestamps up to 30 seconds in the future are accepted and treated as age `0`. Configure that allowance with `SOS_CLOCK_SKEW_MS`; timestamps farther in the future are rejected with HTTP `400`. The original timestamp is never changed during relay.

### Phase 5 tests

Run NODE-B with a relay target and the default five-minute TTL:

```powershell
$env:NODE_ID = "NODE-B"
$env:RELAY_TARGET = "http://NODE-C-IP:5000"
Remove-Item Env:SOS_TTL_MS -ErrorAction SilentlyContinue
npm start
```

Create test packets in a separate PowerShell terminal. Replace `NODE-B-IP` with NODE-B's LAN address:

```powershell
$fresh = @{
   messageId = "SOS-FRESH-001"
   sourceNode = "NODE-A"
   type = "TRAPPED"
   priority = 100
   message = "Fresh SOS"
   location = @{ latitude = 11.0168; longitude = 76.9558 }
   timestamp = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 5

Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $fresh
Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $fresh
```

The first response has `stale: false`, `duplicate: false`, and `relayed: true`. The second has `stale: false`, `duplicate: true`, and `relayed: false`.

Test a stale message:

```powershell
$old = @{
   messageId = "SOS-OLD-001"
   sourceNode = "NODE-A"
   type = "TRAPPED"
   priority = 100
   message = "Old SOS"
   location = @{ latitude = 11.0168; longitude = 76.9558 }
   timestamp = (Get-Date).ToUniversalTime().AddMinutes(-6).ToString("o")
} | ConvertTo-Json -Depth 5

Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $old
```

This returns HTTP `410` with `stale: true` and `relayed: false`. The server logs the message age and TTL, and NODE-C does not receive it.

Test an invalid timestamp:

```powershell
$invalid = $fresh -replace '"timestamp":"[^"]+"', '"timestamp":"not-a-timestamp"'
try {
   Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $invalid
} catch {
   $_.Exception.Response.StatusCode.value__
}
```

This returns HTTP `400` and does not relay. A timestamp a few seconds in the future is accepted under the default 30-second clock-skew allowance; use `AddSeconds(10)` in the fresh packet to test that case.

## Phase 6 priority engine

The backend uses one centralized mapping:

| SOS type | Priority |
| --- | ---: |
| `TRAPPED` | 100 |
| `MEDICAL` | 90 |
| `FIRE` | 85 |
| `MISSING` | 80 |
| `WATER` | 60 |
| `FOOD` | 50 |

Unknown types receive the default priority `40`. Type matching ignores surrounding whitespace and letter case, while the original `type` text is preserved in the relayed SOS. A client-provided priority is always replaced by the calculated value.

The processing order is:

1. Validate the SOS structure and required `messageId`.
2. Validate the timestamp and TTL.
3. Check the in-memory deduplication Set.
4. Calculate priority for a new, fresh message.
5. Process and relay the same SOS object with the calculated priority.

Priority is not calculated for invalid, stale, or duplicate messages.

### Phase 6 priority tests

Run NODE-B with NODE-C as its relay target:

```powershell
$env:NODE_ID = "NODE-B"
$env:RELAY_TARGET = "http://NODE-C-IP:5000"
npm start
```

In another PowerShell terminal, send a fresh packet with an intentionally incorrect priority. Replace `NODE-B-IP` with NODE-B's LAN address:

```powershell
$sos = @{
   messageId = "SOS-PRIORITY-TRAPPED"
   sourceNode = "NODE-A"
   type = "TRAPPED"
   priority = 10
   message = "Person trapped under rubble"
   location = @{ latitude = 11.0168; longitude = 76.9558 }
   timestamp = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 5

Invoke-RestMethod http://NODE-B-IP:5000/receive-sos -Method Post -ContentType "application/json" -Body $sos
```

The response must contain `priority: 100`, and NODE-C must receive the same message with `priority: 100`. Repeat with new `messageId` values and these types to verify the mapping: `MEDICAL` -> `90`, `FIRE` -> `85`, `MISSING` -> `80`, `WATER` -> `60`, and `FOOD` -> `50`.

For an unknown type, set `type = "OTHER"`; the response and relay must contain `priority: 40`. Send the exact same packet twice to verify that the first response has `duplicate: false` and the second has `duplicate: true`, `relayed: false`, without recalculating priority. Use an old timestamp to verify stale messages do not calculate priority or relay.

## Phase 2 end-to-end test

Both laptops must be connected to the same Wi-Fi network or mobile hotspot. Ensure Node.js 18 or newer is installed because the sender uses the built-in `fetch` API.

### Laptop B: start the receiver

From the `server` directory on Laptop B:

Windows CMD:

```cmd
set NODE_ID=NODE-B
npm start
```

PowerShell:

```powershell
$env:NODE_ID = "NODE-B"
npm start
```

Run `ipconfig` on Laptop B and note its active Wi-Fi IPv4 address, for example `10.0.0.25`.

### Laptop A: start the sender node

From the `server` directory on Laptop A:

Windows CMD:

```cmd
set NODE_ID=NODE-A
npm start
```

PowerShell:

```powershell
$env:NODE_ID = "NODE-A"
npm start
```

In a second terminal on Laptop A, send one test SOS to Laptop B. Replace the example address with Laptop B's IPv4 address:

```cmd
npm run send-sos -- http://10.0.0.25:5000/receive-sos
```

The sender calls NODE-A's local `/sos`, then explicitly POSTs that one created message to NODE-B. NODE-A should print:

```text
SOS SENT
Message ID: SOS-...
Received by: NODE-B
```

NODE-B should print the received message details in its server terminal and return the acknowledgement. Phase 4 now deduplicates repeated `messageId` values before any relay.

## Troubleshooting

- **Windows Firewall:** Allow Node.js through Windows Defender Firewall on private networks, or create an inbound TCP rule for port `5000` if your environment requires it.
- **Different networks:** Confirm both laptops are connected to the same Wi-Fi network or the same mobile hotspot. Guest networks may isolate clients.
- **Wi-Fi client isolation:** Disable AP/client isolation in the hotspot or access point settings, or test with a network that permits device-to-device traffic.
- **Incorrect IPv4 address:** Run `ipconfig` again and use the IPv4 address belonging to the active Wi-Fi or hotspot adapter, not a disconnected adapter or `127.0.0.1`.
- **Listening only on localhost:** Confirm the startup code uses `app.listen(5000, "0.0.0.0", ...)`. This server does.
- **Port unavailable:** Check whether another process uses port `5000`. Stop that process or free the port before running `npm start`; do not change the Phase 1 port unless you also update the test URLs.
- **SOS sender cannot connect:** Use NODE-B's Wi-Fi IPv4 address in the sender URL, confirm `/receive-sos` is listening on Laptop B, and check Windows Firewall for Node.js or TCP port `5000`.
- **Relay cannot connect:** Confirm `RELAY_TARGET` uses NODE-C's current LAN IPv4 address and port `5000`. NODE-B logs the failure and still acknowledges NODE-A; this phase does not retry or store the message.
- **Unexpected relay:** Clear `RELAY_TARGET` on NODE-A and NODE-C. Only NODE-B should have `RELAY_TARGET` configured.

## Phase 6 acceptance checklist

- [ ] NODE-A, NODE-B, and NODE-C start successfully
- [ ] All devices are on the same local Wi-Fi
- [ ] NODE-A can reach NODE-B
- [ ] NODE-A creates a unique SOS message
- [ ] NODE-B validates and receives it
- [ ] NODE-B automatically relays the SOS to NODE-C
- [ ] NODE-C validates and logs the SOS
- [ ] NODE-B logs relay success
- [ ] NODE-A receives the NODE-B acknowledgement
- [ ] NODE-C receives an acknowledgement request and responds
- [ ] The SOS fields remain unchanged across the relay
- [ ] Relay failure does not crash NODE-B
- [ ] First SOS response has `duplicate: false`
- [ ] Repeated identical SOS has `duplicate: true`
- [ ] Duplicate SOS is not relayed again
- [ ] NODE-C deduplicates repeated SOS messages
- [ ] Deduplication resets after a server restart
- [ ] TRAPPED priority is calculated as 100
- [ ] MEDICAL priority is calculated as 90
- [ ] FIRE priority is calculated as 85
- [ ] MISSING priority is calculated as 80
- [ ] WATER priority is calculated as 60
- [ ] FOOD priority is calculated as 50
- [ ] Unknown types use priority 40
- [ ] Incorrect client priority is replaced
- [ ] Relayed priority remains unchanged at NODE-C
- [ ] Stale and duplicate messages do not calculate priority
- [ ] Phase 1 endpoints still work

Only after every checklist item passes should implementation proceed to Phase 7.

## Phase 7: ResQMesh responder dashboard

Phase 7 adds a React + Vite + Tailwind frontend in `frontend/`. The dashboard uses the existing Express backend; it does not create a separate backend or use cloud services.

The frontend provides:

- A ResQMesh emergency-response header and local node status.
- SOS type selection for Trapped, Medical, Fire, Water, Food, and Missing.
- A message and location-note field.
- A real `Send SOS` action that calls `POST /sos`.
- A responder incident feed backed by `GET /sos`.
- Priority badges using the Phase 6 calculated priority.
- Polling every five seconds for node health and incidents.

When `POST /sos` creates a frontend SOS, it now enters the same processing pipeline as `POST /receive-sos`: validation, freshness, deduplication, priority calculation, in-memory storage, and automatic relay to `RELAY_TARGET/receive-sos`. The generated `messageId`, `sourceNode`, calculated priority, timestamp, and location are preserved across relay hops. The backend keeps the incident feed in memory for this phase. Existing Phase 1-6 routes and processing remain unchanged. No database, authentication, maps, WebSockets, clustering, or advanced analytics are included.

### Run Phase 7 locally

Terminal 1, from the workspace root:

```powershell
$env:NODE_ID = "NODE-A"
npm --prefix .\server start
```

Terminal 2, from the workspace root:

```powershell
npm --prefix .\frontend run dev -- --host 0.0.0.0
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies `/api` requests to the backend on port `5000`.

To verify the API directly:

```powershell
Invoke-RestMethod http://localhost:5000/
Invoke-RestMethod http://localhost:5000/sos
```

Choose an SOS type, enter a message and location note, and select `Send SOS`. The backend calculates priority from the type, and the new incident appears in the responder feed. For example, `TRAPPED` is returned and displayed with priority `100`, while `MEDICAL` is displayed with priority `90`.

## Phase 8: GPS auto-detection and incident map

Phase 8 uses the browser's `navigator.geolocation` API. Opening the dashboard requests location permission normally. The survivor form shows `Detecting location...`, `Location detected`, or `Location unavailable`. The optional location note remains a descriptive label; latitude and longitude are never manually entered.

When location is available, `POST /sos` receives the existing location object with detected `latitude` and `longitude`. When permission is denied or unavailable, the SOS can still be sent with `latitude` and `longitude` set to `null` and a `Location unavailable` label. Such incidents remain visible in the feed but are not plotted until valid coordinates are available.

The responder dashboard includes a Leaflet map. Markers come only from valid coordinates in the existing `GET /sos` incident feed. Selecting a marker shows the SOS type, priority, message, source node, received-by node, timestamp, and coordinates. No marker coordinates are hardcoded.

For local browser testing, `http://localhost:5173` is treated as a secure context by most browsers and can request geolocation. Browsers may block geolocation on a plain HTTP LAN address; use localhost for the test or serve the frontend over HTTPS when testing from another device.

## Phase 9: SOS geographic clustering

The responder map groups nearby incident coordinates in the frontend using a 500-meter default radius. Set `VITE_CLUSTER_RADIUS_METERS` before starting Vite to change it. Cluster markers show the number of SOS incidents and the highest priority in the group. Selecting a cluster lists its incidents; selecting an individual marker shows the existing incident details. The grouping radius contracts as the map zoom increases, so distinct nearby incidents separate when zoomed in. Exact-overlap coordinates remain one cluster because they have no geographic distance between them.
