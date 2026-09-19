import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CLUSTER_RADIUS_METERS = Number(import.meta.env.VITE_CLUSTER_RADIUS_METERS) > 0
  ? Number(import.meta.env.VITE_CLUSTER_RADIUS_METERS)
  : 500;

function isValidCoordinate(value) {
  return Number.isFinite(Number(value));
}

function coordinateValue(value) {
  return Number(value);
}

function distanceMeters(first, second) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = (second.latitude - first.latitude) * Math.PI / 180;
  const longitudeDelta = (second.longitude - first.longitude) * Math.PI / 180;
  const latitudeOne = first.latitude * Math.PI / 180;
  const latitudeTwo = second.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getClusterRadius(zoom) {
  if (zoom <= 14) {
    return CLUSTER_RADIUS_METERS;
  }

  return CLUSTER_RADIUS_METERS * (2 ** (14 - zoom));
}

function groupIncidents(locatedIncidents, radiusMeters) {
  const remaining = [...locatedIncidents];
  const clusters = [];

  while (remaining.length > 0) {
    const seed = remaining.shift();
    const members = [seed];
    const center = {
      latitude: seed.location.latitude,
      longitude: seed.location.longitude
    };

    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      if (distanceMeters(center, candidate.location) <= radiusMeters) {
        members.push(candidate);
        remaining.splice(index, 1);
      }
    }

    clusters.push(members);
  }

  return clusters;
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

function clusterPopupContent(incidents) {
  const highestPriority = Math.max(...incidents.map((incident) => incident.priority));
  const rows = incidents.map((incident) => `
    <li>
      <strong>${escapeHtml(incident.type)}</strong> · P${escapeHtml(incident.priority)}
      <br>${escapeHtml(incident.message)}
      <small>${escapeHtml(incident.messageId)}</small>
    </li>
  `).join("");

  return `
    <div class="map-popup cluster-popup">
      <strong>${incidents.length} SOS incidents</strong>
      <span>Highest priority: ${highestPriority}</span>
      <ul>${rows}</ul>
      <small>Zoom in to separate nearby markers.</small>
    </div>
  `;
}

function IncidentMap({ incidents }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const markerLayer = useRef(null);
  const incidentsRef = useRef([]);
  const hasFittedRef = useRef(false);

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

    const renderMarkers = () => {
      if (!mapInstance.current || !markerLayer.current) {
        return;
      }

      markerLayer.current.clearLayers();
      const locatedIncidents = incidentsRef.current
        .filter((incident) => (
          isValidCoordinate(incident.location?.latitude) &&
          isValidCoordinate(incident.location?.longitude)
        ))
        .map((incident) => ({
          ...incident,
          location: {
            ...incident.location,
            latitude: coordinateValue(incident.location.latitude),
            longitude: coordinateValue(incident.location.longitude)
          }
        }));
      const clusters = groupIncidents(locatedIncidents, getClusterRadius(mapInstance.current.getZoom()));
      const markerIcon = L.divIcon({
        className: "incident-marker",
        html: "<span></span>",
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      clusters.forEach((cluster) => {
        if (cluster.length === 1) {
          const incident = cluster[0];
          L.marker([incident.location.latitude, incident.location.longitude], { icon: markerIcon })
            .bindPopup(popupContent(incident))
            .addTo(markerLayer.current);
          return;
        }

        const center = cluster.reduce((coordinates, incident) => ({
          latitude: coordinates.latitude + incident.location.latitude / cluster.length,
          longitude: coordinates.longitude + incident.location.longitude / cluster.length
        }), { latitude: 0, longitude: 0 });
        const highestPriority = Math.max(...cluster.map((incident) => incident.priority));
        const clusterIcon = L.divIcon({
          className: "incident-cluster-marker",
          html: `<span>${cluster.length}</span><b>P${highestPriority}</b>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });

        L.marker([center.latitude, center.longitude], { icon: clusterIcon })
          .bindPopup(clusterPopupContent(cluster))
          .addTo(markerLayer.current);
      });
    };

    mapInstance.current.on("zoomend", renderMarkers);
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.current?.invalidateSize();
    });
    resizeObserver.observe(mapElement.current);
    requestAnimationFrame(() => mapInstance.current?.invalidateSize());

    return () => {
      resizeObserver.disconnect();
      mapInstance.current?.off("zoomend", renderMarkers);
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markerLayer.current) {
      return;
    }

    incidentsRef.current = incidents;
    const locatedIncidents = incidents.filter((incident) => (
      isValidCoordinate(incident.location?.latitude) &&
      isValidCoordinate(incident.location?.longitude)
    ));

    markerLayer.current.clearLayers();
    mapInstance.current.fire("zoomend");

    if (!hasFittedRef.current && locatedIncidents.length === 1) {
      const incident = locatedIncidents[0];
      hasFittedRef.current = true;
      mapInstance.current.setView([
        coordinateValue(incident.location.latitude),
        coordinateValue(incident.location.longitude)
      ], 13);
    } else if (!hasFittedRef.current && locatedIncidents.length > 1) {
      hasFittedRef.current = true;
      const bounds = L.latLngBounds(locatedIncidents.map((incident) => [
        coordinateValue(incident.location.latitude),
        coordinateValue(incident.location.longitude)
      ]));
      mapInstance.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    }
  }, [incidents]);

  return <div className="incident-map" ref={mapElement} aria-label="SOS incident map" />;
}

export default IncidentMap;
