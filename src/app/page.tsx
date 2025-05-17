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
  const lastUpdateTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<GeoPoint | null>(null);
  
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [currentPath, setCurrentPath] = useState<GeoPoint[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const [storedTrails, setStoredTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0-100
  const [playbackMarkerPosition, setPlaybackMarkerPosition] = useState<GeoPoint | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x to 5x
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        
        function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
          const R = 6371000; // Radius of Earth in meters
          const toRad = (deg: number) => deg * (Math.PI / 180);
          const dLat = toRad(lat2 - lat1);
          const dLng = toRad(lng2 - lng1);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            const newLat = pos.coords.latitude;
            const newLng = pos.coords.longitude;

            const newPoint: GeoPoint = {
              lat: newLat,
              lng: newLng,
              timestamp: now,
            };

            const lastPoint = lastPositionRef.current;
            const lastTime = lastUpdateTimeRef.current;

            const timePassed = now - lastTime;
            const distanceMoved = lastPoint
                ? getDistanceMeters(lastPoint.lat, lastPoint.lng, newLat, newLng)
                : Infinity;
            if (timePassed >= 2500 && distanceMoved >= 10) {
              setCurrentPosition(newPoint);
              setCurrentPath((prevPath) => [...prevPath, newPoint]);
              setMapCenter([newLat, newLng]);
              console.log("New filtered position:", newPoint);
              lastUpdateTimeRef.current = now;
              lastPositionRef.current = newPoint;
            } else {
              console.log("Skipped position - too soon or too close");
            }
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

  // Playback effect
  useEffect(() => {
    if (!selectedTrail || !isPlaying) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }
    const path = selectedTrail.path;
    let index = Math.floor((playbackProgress / 100) * (path.length - 1));
    playbackIntervalRef.current = setInterval(() => {
      index += 1;
      if (index >= path.length) {
        setIsPlaying(false);
        setPlaybackProgress(100);
        setPlaybackMarkerPosition(path[path.length - 1]);
        clearInterval(playbackIntervalRef.current!);
        playbackIntervalRef.current = null;
        return;
      }
      const progress = (index / (path.length - 1)) * 100;
      setPlaybackProgress(progress);
      setPlaybackMarkerPosition(path[index]);
      setMapCenter([path[index].lat, path[index].lng]);
    }, 1000 / playbackSpeed);
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [selectedTrail, isPlaying, playbackSpeed]);

  // When user selects a new trail, reset playback state
  const handleSelectTrail = useCallback((trail: Trail) => {
    if (isTracking) {
      handleStopTracking(); 
    }
    setSelectedTrail(trail);
    setMapCenter([trail.path[0].lat, trail.path[0].lng]);
    setMapZoom(TRACKING_ZOOM); 
    setPlaybackProgress(0);
    setPlaybackMarkerPosition(trail.path[0]);
    setIsPlaying(false);
    setPlaybackSpeed(1);
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
      <div className="fixed top-0 right-0 z-30 pointer-events-none">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-end px-2 sm:px-4 mt-2 sm:mt-4 pointer-events-auto gap-2 max-w-fit">
          <div className="flex gap-2 flex-wrap justify-end sm:w-auto">
            {!isTracking ? (
              <Button
                onClick={handleStartTracking}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md sm:w-auto"
              >
                <Play className="mr-2 h-5 w-5" /> Start Tracking
              </Button>
            ) : (
              <Button
                onClick={handleStopTracking}
                variant="destructive"
                className="shadow-md sm:w-auto"
              >
                <Square className="mr-2 h-5 w-5" /> Stop Tracking
              </Button>
            )}
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
      {/* Trail info and slider overlayed above the map */}
      {selectedTrail && (
        <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 w-11/12 max-w-2xl z-40 p-2 sm:p-4 bg-background/90 rounded-xl shadow-2xl backdrop-blur-sm pointer-events-auto">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 truncate">{selectedTrail.name}</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center text-xs text-muted-foreground mb-2 space-y-1 sm:space-y-0 sm:space-x-3">
            <span className="flex items-center"><CalendarClock size={14} className="mr-1"/> {format(new Date(selectedTrail.startTime), "PPp")}</span>
            <span className="flex items-center"><Route size={14} className="mr-1"/> {formatDuration(selectedTrail.endTime - selectedTrail.startTime)}</span>
            <span className="flex items-center"><Ruler size={14} className="mr-1"/> {formatTrailDistance(selectedTrail.distance)}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Button size="icon" variant="outline" onClick={() => setIsPlaying(p => !p)}>
              {isPlaying ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <span className="text-xs">Speed:</span>
            <select
              className="border rounded px-1 py-0.5 text-xs bg-background"
              value={playbackSpeed}
              onChange={e => setPlaybackSpeed(Number(e.target.value))}
            >
              {[1,2,3,4,5,6,7,8,9,10].map(s => (
                <option key={s} value={s}>{s}x</option>
              ))}
            </select>
            <Slider
              min={0}
              max={100}
              step={0.1}
              value={[playbackProgress]}
              onValueChange={handlePlaybackProgressChange}
              className="flex-1 mx-2 [&>span:first-child]:h-1 [&_[role=slider]]:bg-accent [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:border-2"
            />
          </div>
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
