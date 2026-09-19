import { useEffect, useState } from "react";
import IncidentMap from "./IncidentMap";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Flame,
  HeartPulse,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Signal,
  Siren,
  UserRound,
  UsersRound,
  Waves
} from "lucide-react";

const API_ROOT = "/api";
const SOS_TYPES = [
  { value: "TRAPPED", label: "Trapped", icon: UserRound, tone: "coral" },
  { value: "MEDICAL", label: "Medical", icon: HeartPulse, tone: "rose" },
  { value: "FIRE", label: "Fire", icon: Flame, tone: "amber" },
  { value: "WATER", label: "Water", icon: Waves, tone: "cyan" },
  { value: "FOOD", label: "Food", icon: Package, tone: "lime" },
  { value: "MISSING", label: "Missing", icon: UsersRound, tone: "violet" }
];

const priorityLabels = {
  100: { label: "Critical", className: "priority-critical" },
  90: { label: "High", className: "priority-high" },
  85: { label: "High", className: "priority-high" },
  80: { label: "High", className: "priority-high" },
  60: { label: "Medium", className: "priority-medium" },
  50: { label: "Low", className: "priority-low" }
};

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));
}

function getPriorityMeta(priority) {
  return priorityLabels[priority] || {
    label: priority >= 80 ? "High" : priority >= 60 ? "Medium" : "Low",
    className: priority >= 80 ? "priority-high" : priority >= 60 ? "priority-medium" : "priority-low"
  };
}

async function fetchJson(path, options) {
  const response = await fetch(`${API_ROOT}${path}`, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

function App() {
  const [selectedType, setSelectedType] = useState("TRAPPED");
  const [message, setMessage] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [incidents, setIncidents] = useState([]);
  const [nodeStatus, setNodeStatus] = useState({ node: "—", online: false, phase: "—" });
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return Promise.resolve(null);
    }

    setLocationStatus("detecting");

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setDetectedLocation(location);
          setLocationStatus("detected");
          resolve(location);
        },
        () => {
          setDetectedLocation(null);
          setLocationStatus("unavailable");
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 10000
        }
      );
    });
  }

  async function loadDashboard(showSpinner = false) {
    if (showSpinner) setIsRefreshing(true);
    try {
      const [health, incidentFeed] = await Promise.all([
        fetchJson("/"),
        fetchJson("/sos")
      ]);
      setNodeStatus({ node: health.node, online: health.status === "online", phase: health.phase });
      setIncidents(incidentFeed.incidents || []);
    } catch (error) {
      setNodeStatus((current) => ({ ...current, online: false }));
      setNotice({ kind: "error", text: "Backend unavailable. Start the ResQMesh server on port 5000." });
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void detectLocation();
    loadDashboard(true);
    const interval = window.setInterval(() => loadDashboard(), 5000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleSend(event) {
    event.preventDefault();
    setIsSending(true);
    setNotice(null);

    try {
      const currentLocation = detectedLocation || await detectLocation();
      const created = await fetchJson("/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          priority: 0,
          message: message.trim() || "Urgent assistance required",
          location: {
            latitude: currentLocation?.latitude ?? null,
            longitude: currentLocation?.longitude ?? null,
            label: locationNote.trim() || (currentLocation ? "Browser location" : "Location unavailable")
          }
        })
      });
      setNotice({ kind: "success", text: `SOS ${created.messageId} sent with priority ${created.sos.priority}.` });
      setMessage("");
      setLocationNote("");
      await loadDashboard();
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      setIsSending(false);
    }
  }

  const selectedLabel = SOS_TYPES.find((type) => type.value === selectedType)?.label;

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><Siren size={21} strokeWidth={2.4} /></div>
            <div>
              <p className="brand-name">ResQ<span>Mesh</span></p>
              <p className="brand-subtitle">OFFLINE RESPONSE NETWORK</p>
            </div>
          </div>
          <div className="network-pill">
            <span className={`status-dot ${nodeStatus.online ? "status-live" : "status-offline"}`} />
            <span>{nodeStatus.online ? "Local network online" : "Network offline"}</span>
            <span className="network-divider" />
            <span className="mono-text">{nodeStatus.node}</span>
          </div>
        </header>

        <main className="page-content">
          <section className="hero-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> INCIDENT COMMAND</p>
              <h1>Keep the signal<br /><em>alive.</em></h1>
              <p className="hero-copy">A focused view of local distress signals, built for the moments when every second and every hop matters.</p>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-icon"><Signal size={18} /></span>
              <div>
                <p>Mesh node</p>
                <strong>{nodeStatus.node}</strong>
              </div>
              <ArrowUpRight className="hero-stat-arrow" size={18} />
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="panel sos-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">SURVIVOR CHANNEL</p>
                  <h2>Send an SOS</h2>
                </div>
                <div className="live-badge"><span className="status-dot status-live" /> READY</div>
              </div>
              <p className="panel-intro">Choose the signal that best describes the emergency. Your node will assign its response priority automatically.</p>

              <form onSubmit={handleSend}>
                <div className="field-label-row">
                  <label>Emergency type</label>
                  <span className="selected-type">{selectedLabel}</span>
                </div>
                <div className="type-grid">
                  {SOS_TYPES.map(({ value, label, icon: Icon, tone }) => (
                    <button
                      className={`type-button tone-${tone} ${selectedType === value ? "type-selected" : ""}`}
                      key={value}
                      type="button"
                      onClick={() => setSelectedType(value)}
                    >
                      <Icon size={19} />
                      <span>{label}</span>
                      {selectedType === value && <CheckCircle2 className="selected-check" size={15} />}
                    </button>
                  ))}
                </div>

                <label className="input-label" htmlFor="message">What is happening?</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe the situation briefly..."
                  rows="3"
                />
                <div className={`location-status location-${locationStatus}`} role="status">
                  <MapPin size={15} />
                  {locationStatus === "detecting" && <span>Detecting location...</span>}
                  {locationStatus === "detected" && <span>Location detected: {detectedLocation.latitude.toFixed(5)}, {detectedLocation.longitude.toFixed(5)}</span>}
                  {(locationStatus === "unavailable" || locationStatus === "idle") && <span>Location unavailable</span>}
                  <button type="button" onClick={() => void detectLocation()}>Detect again</button>
                </div>
                <label className="input-label" htmlFor="location">Location note <span className="optional-label">optional</span></label>
                <div className="input-with-icon">
                  <MapPin size={17} />
                  <input
                    id="location"
                    value={locationNote}
                    onChange={(event) => setLocationNote(event.target.value)}
                    placeholder="Landmark, street, or area"
                  />
                </div>
                <button className="send-button" type="submit" disabled={isSending || !nodeStatus.online}>
                  {isSending ? <RefreshCw className="spin" size={19} /> : <Send size={19} />}
                  <span>{isSending ? "Sending signal..." : "Send SOS"}</span>
                  {!isSending && <ChevronRight size={18} />}
                </button>
              </form>
              {notice && (
                <div className={`notice notice-${notice.kind}`} role="status">
                  {notice.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{notice.text}</span>
                </div>
              )}
            </section>

            <section className="panel incidents-panel">
              <div className="panel-heading incident-heading">
                <div>
                  <p className="section-kicker">RESPONDER VIEW</p>
                  <h2>Active incidents <span className="incident-count">{incidents.length}</span></h2>
                </div>
                <button className="icon-button" type="button" onClick={() => loadDashboard(true)} title="Refresh incidents">
                  <RefreshCw className={isRefreshing ? "spin" : ""} size={17} />
                </button>
              </div>
              <div className="feed-meta"><span className="feed-live"><span className="status-dot status-live" /> LIVE FEED</span><span>Polling every 5 seconds</span></div>
              <div className="incident-list">
                {incidents.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><Radio size={24} /></div>
                    <strong>No active incidents</strong>
                    <span>New SOS signals will appear here.</span>
                  </div>
                ) : incidents.map((incident) => {
                  const priority = getPriorityMeta(incident.priority);
                  return (
                    <article className="incident-card" key={incident.messageId}>
                      <div className="incident-card-top">
                        <span className={`priority-chip ${priority.className}`}><span /> {priority.label}</span>
                        <span className="incident-time">{formatTime(incident.timestamp)}</span>
                      </div>
                      <div className="incident-main">
                        <div className="incident-symbol"><ShieldAlert size={20} /></div>
                        <div>
                          <div className="incident-type-row"><h3>{incident.type}</h3><span className="priority-number">P{incident.priority}</span></div>
                          <p className="incident-message">{incident.message}</p>
                        </div>
                      </div>
                      <div className="incident-details">
                        <span><strong>ID</strong> <code>{incident.messageId}</code></span>
                        <span><strong>FROM</strong> {incident.sourceNode}</span>
                        <span><strong>RECEIVED BY</strong> {incident.receivedBy || nodeStatus.node}</span>
                        {Number.isFinite(incident.location?.latitude) && Number.isFinite(incident.location?.longitude) && (
                          <span><strong>LOC</strong> {incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}</span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="panel map-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">GEOSPATIAL VIEW</p>
                <h2>Incident map</h2>
              </div>
              <div className="map-count"><MapPin size={14} /> {incidents.filter((incident) => Number.isFinite(incident.location?.latitude) && Number.isFinite(incident.location?.longitude)).length} located</div>
            </div>
            <p className="panel-intro map-intro">Markers come directly from the local incident feed. Select a marker to inspect the full SOS record.</p>
            <IncidentMap incidents={incidents} />
          </section>

          <section className="network-strip">
            <div className="network-strip-title"><Activity size={17} /><span>Network status</span></div>
            <div className="network-node"><span className="node-avatar">A</span><div><strong>NODE-A</strong><small>Origin node</small></div><span className="status-dot status-live" /></div>
            <div className="route-line"><span /><span /><span /></div>
            <div className="network-node"><span className="node-avatar node-active">B</span><div><strong>{nodeStatus.node}</strong><small>Current node · Phase {nodeStatus.phase}</small></div><span className={`status-dot ${nodeStatus.online ? "status-live" : "status-offline"}`} /></div>
            <div className="route-line route-muted"><span /><span /><span /></div>
            <div className="network-node"><span className="node-avatar">C</span><div><strong>NODE-C</strong><small>Relay endpoint</small></div><span className="status-dot status-live" /></div>
          </section>
        </main>
        <footer><span>RESQMESH / PHASE 7</span><span>LOCAL-FIRST · NO CLOUD DEPENDENCY</span></footer>
      </div>
    </div>
  );
}

export default App;
