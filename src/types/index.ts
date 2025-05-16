export interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface Trail {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  path: GeoPoint[];
  distance?: number; // in meters
}
