import { useEffect, useState } from "react";
import { Activity, ArrowRight, CircleAlert, Radio, RefreshCw } from "lucide-react";

const MESH_NODES = [
  { id: "NODE-A", url: import.meta.env.VITE_NODE_A_URL || "http://localhost:5000", relayTo: "NODE-B" },
  { id: "NODE-B", url: import.meta.env.VITE_NODE_B_URL || "http://localhost:5001", relayTo: "NODE-C" },
  { id: "NODE-C", url: import.meta.env.VITE_NODE_C_URL || "http://localhost:5002", relayTo: null }
];

async function readNode(node) {
  try {
    const [healthResponse, sosResponse] = await Promise.all([
      fetch(`${node.url}/`),
      fetch(`${node.url}/sos`)
    ]);
    if (!healthResponse.ok || !sosResponse.ok) {
      throw new Error("Node request failed");
    }

    const health = await healthResponse.json();
    const sosFeed = await sosResponse.json();
    return {
      ...node,
      online: health.status === "online",
      receivedCount: sosFeed.incidents?.length || 0,
      incidents: sosFeed.incidents || []
    };
  } catch {
    return {
      ...node,
      online: false,
      receivedCount: 0,
      incidents: []
    };
  }
}

function hasForwardedMessage(source, destination) {
  const destinationIds = new Set(destination.incidents.map((incident) => incident.messageId));
  return source.incidents.some((incident) => destinationIds.has(incident.messageId));
}

function MeshNetwork() {
  const [nodes, setNodes] = useState(() => MESH_NODES.map((node) => ({
    ...node,
    online: false,
    receivedCount: 0,
    incidents: []
  })));
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshNetwork(showSpinner = false) {
    if (showSpinner) setIsRefreshing(true);
    const results = await Promise.all(MESH_NODES.map(readNode));
    setNodes(results);
    if (showSpinner) setIsRefreshing(false);
  }

  useEffect(() => {
    void refreshNetwork(true);
    const interval = window.setInterval(() => refreshNetwork(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  const onlineCount = nodes.filter((node) => node.online).length;

  return (
    <section className="mesh-network-panel">
      <div className="mesh-network-header">
        <div>
          <p className="section-kicker">NETWORK TOPOLOGY</p>
          <h2>Mesh network</h2>
          <p className="mesh-network-intro">Live node health and SOS propagation across configured relay targets.</p>
        </div>
        <button className="icon-button" type="button" onClick={() => refreshNetwork(true)} title="Refresh network status">
          <RefreshCw className={isRefreshing ? "spin" : ""} size={17} />
        </button>
      </div>

      <div className="mesh-summary">
        <span><span className="status-dot status-live" /> {onlineCount}/{nodes.length} nodes online</span>
        <span><Radio size={14} /> Polling every 5 seconds</span>
      </div>

      <div className="mesh-topology" aria-label="ResQMesh node topology">
        {nodes.map((node, index) => {
          const nextNode = nodes[index + 1];
          const activeLink = nextNode && hasForwardedMessage(node, nextNode);
          return (
            <div className="mesh-hop" key={node.id}>
              <article className={`mesh-node-card ${node.online ? "mesh-node-online" : "mesh-node-offline"}`}>
                <div className="mesh-node-card-top">
                  <span className="mesh-node-symbol">{node.id.slice(-1)}</span>
                  <span className={`mesh-node-status ${node.online ? "mesh-online" : "mesh-offline"}`}>
                    <span className="status-dot" /> {node.online ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
                <strong>{node.id}</strong>
                <div className="mesh-node-meta"><span><Activity size={12} /> {node.receivedCount} SOS received</span><code>{new URL(node.url).port || "80"}</code></div>
              </article>
              {nextNode && (
                <div className={`mesh-connection ${activeLink ? "mesh-connection-active" : ""}`}>
                  <div className="mesh-connection-line"><span className="mesh-signal" /></div>
                  <ArrowRight size={18} />
                  <small>{activeLink ? "SOS relayed" : `Relay to ${nextNode.id}`}</small>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {nodes.every((node) => !node.online) && (
        <div className="mesh-warning"><CircleAlert size={15} /> No configured mesh nodes are reachable.</div>
      )}
    </section>
  );
}

export default MeshNetwork;
