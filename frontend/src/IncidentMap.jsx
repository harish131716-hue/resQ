import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function isValidCoordinate(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function popupContent(incident) {
  return `
    <div class="map-popup">
      <strong>${escapeHtml(incident.type)}</strong>
      <span>Priority ${escapeHtml(incident.priority)}</span>
      <p>${escapeHtml(incident.message)}</p>
      <small>Source: ${escapeHtml(incident.sourceNode)}</small>
      <small>Received by: ${escapeHtml(incident.receivedBy)}</small>
      <small>${escapeHtml(new Date(incident.timestamp).toLocaleString())}</small>
      <small>${escapeHtml(incident.location.latitude)}, ${escapeHtml(incident.location.longitude)}</small>
    </div>
  `;
}

function IncidentMap({ incidents }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const markerLayer = useRef(null);

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) {
      return undefined;
    }

    mapInstance.current = L.map(mapElement.current, {
      zoomControl: false,
      worldCopyJump: true
    }).setView([20, 0], 2);

    L.control.zoom({ position: "bottomright" }).addTo(mapInstance.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(mapInstance.current);
    markerLayer.current = L.layerGroup().addTo(mapInstance.current);
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.current?.invalidateSize();
    });
    resizeObserver.observe(mapElement.current);
    requestAnimationFrame(() => mapInstance.current?.invalidateSize());

    return () => {
      resizeObserver.disconnect();
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markerLayer.current) {
      return;
    }

    markerLayer.current.clearLayers();
    const locatedIncidents = incidents.filter((incident) => (
      isValidCoordinate(incident.location?.latitude) &&
      isValidCoordinate(incident.location?.longitude)
    ));
    const markerIcon = L.divIcon({
      className: "incident-marker",
      html: "<span></span>",
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    locatedIncidents.forEach((incident) => {
      L.marker([incident.location.latitude, incident.location.longitude], { icon: markerIcon })
        .bindPopup(popupContent(incident))
        .addTo(markerLayer.current);
    });

    if (locatedIncidents.length === 1) {
      const incident = locatedIncidents[0];
      mapInstance.current.setView([
        incident.location.latitude,
        incident.location.longitude
      ], 13);
    } else if (locatedIncidents.length > 1) {
      const bounds = L.latLngBounds(locatedIncidents.map((incident) => [
        incident.location.latitude,
        incident.location.longitude
      ]));
      mapInstance.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    }
  }, [incidents]);

  return <div className="incident-map" ref={mapElement} aria-label="SOS incident map" />;
}

export default IncidentMap;
