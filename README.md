# ResQMesh

## Phase 2: Disaster message protocol and basic SOS

Phase 1 networking is preserved. Phase 2 adds a structured SOS message that NODE-A can create and manually send to NODE-B over the same local Wi-Fi network or mobile hotspot.

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

Use `NODE-B` instead of `NODE-A` when running the same server code on another computer. No source file changes are needed.

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

`POST /receive-sos` accepts the complete SOS message, validates all required fields, logs it on the receiving terminal, and returns an acknowledgement. Malformed messages receive HTTP `400`.

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

NODE-B should print the received message details in its server terminal and return the acknowledgement. This phase does not automatically forward, deduplicate, route, expire, queue, store, or persist SOS messages.

## Troubleshooting

- **Windows Firewall:** Allow Node.js through Windows Defender Firewall on private networks, or create an inbound TCP rule for port `5000` if your environment requires it.
- **Different networks:** Confirm both laptops are connected to the same Wi-Fi network or the same mobile hotspot. Guest networks may isolate clients.
- **Wi-Fi client isolation:** Disable AP/client isolation in the hotspot or access point settings, or test with a network that permits device-to-device traffic.
- **Incorrect IPv4 address:** Run `ipconfig` again and use the IPv4 address belonging to the active Wi-Fi or hotspot adapter, not a disconnected adapter or `127.0.0.1`.
- **Listening only on localhost:** Confirm the startup code uses `app.listen(5000, "0.0.0.0", ...)`. This server does.
- **Port unavailable:** Check whether another process uses port `5000`. Stop that process or free the port before running `npm start`; do not change the Phase 1 port unless you also update the test URLs.
- **SOS sender cannot connect:** Use NODE-B's Wi-Fi IPv4 address in the sender URL, confirm `/receive-sos` is listening on Laptop B, and check Windows Firewall for Node.js or TCP port `5000`.

## Phase 2 acceptance checklist

- [ ] NODE-A starts successfully
- [ ] NODE-B starts successfully
- [ ] Both devices are on the same local Wi-Fi
- [ ] NODE-A can reach NODE-B
- [ ] NODE-A creates a unique SOS message
- [ ] SOS follows the defined JSON structure
- [ ] NODE-A sends SOS to NODE-B
- [ ] NODE-B validates and receives it
- [ ] NODE-B logs the SOS
- [ ] NODE-B sends acknowledgement
- [ ] NODE-A receives acknowledgement
- [ ] Phase 1 endpoints still work

Only after every checklist item passes should implementation proceed to Phase 3.
