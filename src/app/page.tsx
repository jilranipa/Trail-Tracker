"use client";

import type { NextPage } from "next";
import { useState, useCallback, useEffect } from "react";
import dynamic from 'next/dynamic';
import HistoryModal from "@/components/history-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getStoredTrails, saveStoredTrails, calculateDistance } from "@/lib/trail-storage";
import { History } from "lucide-react";
import { format } from "date-fns";
import { Toaster } from "@/components/ui/toaster";
import { TrackingControls } from "@/components/tracking-controls";
import { TrailPlayback } from "@/components/trail-playback";
import type { GeoPoint, Trail } from "@/types";

const MapDisplay = dynamic(() => import('@/components/map-display'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>,
});

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194]; // San Francisco [lat, lng]
const DEFAULT_ZOOM = 13;

const TrailTrackerPage: NextPage = () => {
  const { toast } = useToast();
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [currentPath, setCurrentPath] = useState<GeoPoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [storedTrails, setStoredTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [playbackMarkerPosition, setPlaybackMarkerPosition] = useState<GeoPoint | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initialize the app
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Restore tracking state
      const stored = localStorage.getItem("isTracking");
      const storedPath = localStorage.getItem("currentPath");
      const storedPosition = localStorage.getItem("currentPosition");

      if (stored === "true") {
        setIsTracking(true);
        if (storedPath) {
          const path = JSON.parse(storedPath) as GeoPoint[];
          setCurrentPath(path);
        }
        if (storedPosition) {
          const position = JSON.parse(storedPosition) as GeoPoint;
          setCurrentPosition(position);
          setMapCenter([position.lat, position.lng]);
        }
      }
    }
    setIsClient(true);
    setStoredTrails(getStoredTrails());

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
          setMapZoom(DEFAULT_ZOOM);
        },
        () => {
          setMapCenter(DEFAULT_CENTER);
          setMapZoom(DEFAULT_ZOOM);
        }
      );
    }
  }, []);

  // Save tracking state to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("isTracking", isTracking.toString());
      if (!isTracking) {
        localStorage.removeItem("currentPath");
        localStorage.removeItem("currentPosition");
      }
    }
  }, [isTracking]);

  // Save current path and position to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && isTracking) {
      if (currentPath.length > 0) {
        localStorage.setItem("currentPath", JSON.stringify(currentPath));
      }
      if (currentPosition) {
        localStorage.setItem("currentPosition", JSON.stringify(currentPosition));
      }
    }
  }, [isTracking, currentPath, currentPosition]);

  const handleStopTracking = useCallback(() => {
    setIsTracking(false);
    localStorage.removeItem("currentPath");
    localStorage.removeItem("currentPosition");
    if (currentPath.length > 1) {
      const startTime = currentPath[0].timestamp;
      const endTime = currentPath[currentPath.length - 1].timestamp;
      const distance = calculateDistance(currentPath);
      const newTrail: Trail = {
        id: `trail_${Date.now()}`,
        name: `Trail - ${format(new Date(startTime), "MMM dd, yyyy HH:mm")}`,
        startTime,
        endTime,
        path: [...currentPath],
        distance,
      };
      const updatedTrails = [...storedTrails, newTrail];
      setStoredTrails(updatedTrails);
      saveStoredTrails(updatedTrails);
      toast({ title: "Tracking Stopped", description: `Trail saved: ${newTrail.name}` });
    } else {
      toast({ title: "Tracking Stopped", description: "No significant path recorded." });
    }
    setCurrentPath([]);
    setCurrentPosition(null);
  }, [currentPath, storedTrails, toast]);

  const handleSelectTrail = useCallback((trail: Trail) => {
    if (isTracking) {
      handleStopTracking();
    }
    setSelectedTrail(trail);
    setShowHistoryModal(false);
    setMapCenter([trail.path[0].lat, trail.path[0].lng]);
    setPlaybackMarkerPosition(trail.path[0]);
  }, [isTracking, handleStopTracking]);

  const handleDeleteTrail = useCallback((trailId: string) => {
    const updatedTrails = storedTrails.filter(t => t.id !== trailId);
    setStoredTrails(updatedTrails);
    saveStoredTrails(updatedTrails);
    if (selectedTrail?.id === trailId) {
      setSelectedTrail(null);
      setPlaybackMarkerPosition(null);
    }
    toast({ title: "Trail Deleted", description: "The selected trail has been removed." });
  }, [storedTrails, selectedTrail, toast]);

  const handleStartTracking = () => {
    setIsTracking(true)
    setSelectedTrail(null)
  }

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <p>Loading Trail Tracker...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Controls and header overlayed above the map */}
      <div className="fixed top-0 right-0 z-30 pointer-events-none">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end px-2 sm:px-4 mt-2 sm:mt-4 pointer-events-auto gap-2 max-w-fit">
          <div className="flex gap-2 flex-wrap justify-end sm:w-auto">
            <TrackingControls
              isTracking={isTracking}
              onStartTracking={handleStartTracking}
              onStopTracking={() => {
                setIsTracking(false);
                handleStopTracking();
              }}
              onPositionUpdate={setCurrentPosition}
              onPathUpdate={setCurrentPath}
              onCenterChange={setMapCenter}
              onZoomChange={setMapZoom}
            />
            <Button
              variant="secondary"
              onClick={() => setShowHistoryModal(true)}
              className="shadow-md sm:w-auto"
            >
              <History className="mr-2 h-5 w-5" /> Past Trails
            </Button>
          </div>
        </div>
      </div>

      {/* Map covers the entire page */}
      <div className="absolute inset-0 z-10">
        <MapDisplay
          center={mapCenter}
          zoom={mapZoom}
          path={selectedTrail ? selectedTrail.path : currentPath}
          currentPositionMarker={selectedTrail ? playbackMarkerPosition : currentPosition}
          pathColor={selectedTrail ? "#FF0000" : "hsl(var(--primary))"}
        />
      </div>

      {/* Trail playback controls */}
      {selectedTrail && (
        <TrailPlayback
          trail={selectedTrail}
          onMarkerPositionChange={setPlaybackMarkerPosition}
          onCenterChange={setMapCenter}
        />
      )}

      {/* History modal */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        trails={storedTrails}
        onSelectTrail={handleSelectTrail}
        onDeleteTrail={handleDeleteTrail}
      />

      {/* Toast overlayed above everything */}
      <div className="fixed top-2 right-2 sm:top-6 sm:right-6 z-[9999] pointer-events-none">
        <Toaster />
      </div>

      {/* Title at bottom right */}
      <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-6 z-50 pointer-events-none">
        <div className="bg-background/80 px-3 py-2 rounded-lg shadow-lg text-xs sm:text-base font-bold text-primary pointer-events-auto">
          Trail Tracker
        </div>
      </div>

      {/* Hide Leaflet copyright */}
      <style jsx global>{`
        .leaflet-bottom.leaflet-right {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default TrailTrackerPage;
