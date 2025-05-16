import type { Trail } from '@/types';

const TRAILS_STORAGE_KEY = 'trailTrackerApp_trails';

export function getStoredTrails(): Trail[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const storedTrails = localStorage.getItem(TRAILS_STORAGE_KEY);
    return storedTrails ? JSON.parse(storedTrails) : [];
  } catch (error) {
    console.error('Error loading trails from localStorage:', error);
    return [];
  }
}

export function saveStoredTrails(trails: Trail[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(TRAILS_STORAGE_KEY, JSON.stringify(trails));
  } catch (error) {
    console.error('Error saving trails to localStorage:', error);
  }
}

// Helper function to calculate distance (Haversine formula)
export function calculateDistance(path: { lat: number, lng: number }[]): number {
  let totalDistance = 0;
  if (path.length < 2) return 0;

  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371e3; // Earth radius in meters

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i+1];

    const lat1 = p1.lat;
    const lon1 = p1.lng;
    const lat2 = p2.lat;
    const lon2 = p2.lng;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(rLat1) * Math.cos(rLat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDistance += R * c;
  }
  return totalDistance;
}
