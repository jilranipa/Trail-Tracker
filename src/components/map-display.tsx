
"use client";

import type { GeoPoint } from "@/types";
import type { FC } from "react";
import { useEffect, useMemo } from "react"; // Correctly import useMemo and useEffect
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from 'leaflet';

// Leaflet icon setup for Next.js/Webpack
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl.src,
    iconUrl: iconUrl.src,
    shadowUrl: shadowUrl.src,
  });
}


interface MapDisplayProps {
  center: [number, number]; // [lat, lng]
  zoom: number;
  path?: GeoPoint[];
  currentPositionMarker?: GeoPoint | null;
  pathColor?: string;
}

// Component to handle map view updates
const MapUpdater: FC<{ center: LatLngExpression; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    // map.setView(center, zoom);
    map.panTo(center);
  }, [center, zoom, map]);
  return null;
};

const MapDisplay: FC<MapDisplayProps> = ({
  center,
  zoom,
  path,
  currentPositionMarker,
  pathColor = "hsl(var(--primary))",
}) => {
  const containerStyle: React.CSSProperties = useMemo(() => ({
    width: "100%",
    height: "100%",
    borderRadius: "0.0rem",
  }), []);

  const polylinePositions: LatLngExpression[] = path
    ? path.map(p => [p.lat, p.lng] as LatLngExpression)
    : [];

  const markerPosition: LatLngExpression | null = currentPositionMarker
    ? [currentPositionMarker.lat, currentPositionMarker.lng]
    : null;

  const markerColor = pathColor === '#FF0000' ? '#FF0000' : '#0000FF'; // Red for playback, Blue for live

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={containerStyle}
      scrollWheelZoom={true}
    >
      <MapUpdater center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polylinePositions.length > 0 && (
        <Polyline positions={polylinePositions} pathOptions={{ color: pathColor, weight: 5, opacity: 0.8 }} />
      )}
      {markerPosition && (
        <CircleMarker
          center={markerPosition}
          radius={8}
          pathOptions={{
            color: 'white',
            weight: 2,
            fillColor: markerColor,
            fillOpacity: 1,
          }}
        >
           <Tooltip permanent direction="top" offset={[0, -10]} opacity={0.8}>
            Current Position
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
};

export default MapDisplay;
