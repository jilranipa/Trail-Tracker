"use client";

import type { NextPage } from "next";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from 'next/dynamic';
import HistoryModal from "@/components/history-modal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { getStoredTrails, saveStoredTrails, calculateDistance } from "@/lib/trail-storage";
import type { GeoPoint, Trail } from "@/types";
import { Play, Square, History, Route, CalendarClock, Ruler } from "lucide-react";
import { format } from "date-fns";
import { Toaster } from "@/components/ui/toaster";

const MapDisplay = dynamic(() => import('@/components/map-display'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>,
});

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194]; // San Francisco [lat, lng]
const DEFAULT_ZOOM = 13;
const TRACKING_ZOOM = 16;

const TrailTrackerPage: NextPage = () => {
  const { toast } = useToast();
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);

  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [currentPath, setCurrentPath] = useState<GeoPoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const [storedTrails, setStoredTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0-100
  const [playbackMarkerPosition, setPlaybackMarkerPosition] = useState<GeoPoint | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setStoredTrails(getStoredTrails());

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setMapCenter(userLocation);
          setMapZoom(DEFAULT_ZOOM);
          console.log("User location:", position.coords);
        },
        () => {
          setMapCenter(DEFAULT_CENTER);
          setMapZoom(DEFAULT_ZOOM);
        }
      );
    }
  }, []);
  
  const handleStartTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: "Error", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      return;
    }

    setSelectedTrail(null); 
    setPlaybackMarkerPosition(null);
    setCurrentPath([]);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const initialPos: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
        };
        setCurrentPosition(initialPos);
        setCurrentPath([initialPos]);
        setMapCenter([initialPos.lat, initialPos.lng]);
        setMapZoom(TRACKING_ZOOM);
        setIsTracking(true);
        toast({ title: "Tracking Started", description: "Your path is now being recorded." });

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const newPoint: GeoPoint = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: Date.now(),
            };
            setCurrentPosition(newPoint);
            setCurrentPath((prevPath) => [...prevPath, newPoint]);
            setMapCenter([newPoint.lat, newPoint.lng]);
            console.log("New position:", newPoint);
          },
          (error) => {
            console.error("Error watching position:", error);
            toast({ title: "Geolocation Error", description: error.message, variant: "destructive" });
            setIsTracking(false); 
          },
          { enableHighAccuracy: true, timeout: 1000, maximumAge: 0 }
        );
      },
      (error) => {
        toast({ title: "Permission Denied", description: "Please enable location access to start tracking.", variant: "destructive" });
      }
    );
  }, [toast]);

  const handleStopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);

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
    setMapCenter([trail.path[0].lat, trail.path[0].lng]);
    setMapZoom(TRACKING_ZOOM); 
    setPlaybackProgress(0);
    setPlaybackMarkerPosition(trail.path[0]);
    setShowHistoryModal(false);
    toast({ title: "Trail Selected", description: `Viewing ${trail.name}` });
  }, [isTracking, handleStopTracking, toast]);

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

  const handlePlaybackProgressChange = (value: number[]) => {
    if (selectedTrail) {
      const progress = value[0];
      setPlaybackProgress(progress);
      const pathIndex = Math.floor((progress / 100) * (selectedTrail.path.length - 1));
      const targetPoint = selectedTrail.path[pathIndex];
      setPlaybackMarkerPosition(targetPoint);
      setMapCenter([targetPoint.lat, targetPoint.lng]);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
  };
  
  const formatTrailDistance = (distance?: number) => {
    if (distance === undefined) return "N/A";
    if (distance < 1000) return `${distance.toFixed(0)} m`;
    return `${(distance / 1000).toFixed(2)} km`;
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
      <div className="fixed top-0 left-0 w-full z-30 pointer-events-none">
        <div className="flex flex-col w-full">
          <div className="bg-background/80 p-3 rounded-lg shadow-lg w-fit mt-4 ml-4 pointer-events-auto">
            <h1 className="text-2xl font-bold text-primary">Trail Tracker</h1>
          </div>
          <div className="flex gap-2 justify-end w-full px-4 mt-2 pointer-events-auto">
            {!isTracking ? (
              <Button onClick={handleStartTracking} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                <Play className="mr-2 h-5 w-5" /> Start Tracking
              </Button>
            ) : (
              <Button onClick={handleStopTracking} variant="destructive" className="shadow-md">
                <Square className="mr-2 h-5 w-5" /> Stop Tracking
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowHistoryModal(true)} className="shadow-md">
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
      {/* Trail info and slider overlayed above the map */}
      {selectedTrail && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-2xl z-40 p-4 bg-background/90 rounded-xl shadow-2xl backdrop-blur-sm pointer-events-auto">
          <h3 className="text-lg font-semibold text-foreground mb-1 truncate">{selectedTrail.name}</h3>
          <div className="flex items-center text-xs text-muted-foreground mb-2 space-x-3">
            <span className="flex items-center"><CalendarClock size={14} className="mr-1"/> {format(new Date(selectedTrail.startTime), "PPp")}</span>
            <span className="flex items-center"><Route size={14} className="mr-1"/> {formatDuration(selectedTrail.endTime - selectedTrail.startTime)}</span>
            <span className="flex items-center"><Ruler size={14} className="mr-1"/> {formatTrailDistance(selectedTrail.distance)}</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={0.1}
            value={[playbackProgress]}
            onValueChange={handlePlaybackProgressChange}
            className="[&>span:first-child]:h-1 [&_[role=slider]]:bg-accent [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:border-2"
          />
          <p className="text-center text-xs text-muted-foreground mt-1">
            {playbackMarkerPosition ? `${format(new Date(playbackMarkerPosition.timestamp), "HH:mm:ss")}` : 'Adjust slider to view path points'}
          </p>
        </div>
      )}
      {/* History modal overlayed above the map */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        trails={storedTrails}
        onSelectTrail={handleSelectTrail}
        onDeleteTrail={handleDeleteTrail}
      />
      {/* Toast overlayed above everything */}
      <div className="fixed top-6 right-6 z-[9999] pointer-events-none">
        <Toaster />
      </div>
    </div>
  );
};

export default TrailTrackerPage;
