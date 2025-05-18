import { useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import type { GeoPoint } from "@/types";
import { useToast } from "@/hooks/use-toast";

const TRACKING_ZOOM = 16;

interface TrackingControlsProps {
    isTracking: boolean;
    onStartTracking: () => void;
    onStopTracking: () => void;
    onPositionUpdate: (position: GeoPoint) => void;
    onPathUpdate: (updateFn: (prev: GeoPoint[]) => GeoPoint[]) => void;
    onCenterChange: (center: [number, number]) => void;
    onZoomChange: (zoom: number) => void;
}

export function TrackingControls({
    isTracking,
    onStartTracking,
    onStopTracking,
    onPositionUpdate,
    onPathUpdate,
    onCenterChange,
    onZoomChange,
}: TrackingControlsProps) {
    const { toast } = useToast();
    const lastUpdateTimeRef = useRef<number>(0);
    const lastPositionRef = useRef<GeoPoint | null>(null);
    const watchIdRef = useRef<number | null>(null);

    const handleStartTracking = useCallback(() => {
        if (!navigator.geolocation) {
            toast({
                title: "Error",
                description: "Geolocation is not supported by your browser.",
                variant: "destructive"
            });
            return;
        }

        onStartTracking();

        navigator.geolocation.getCurrentPosition(
            (position) => {                const initialPos: GeoPoint = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    timestamp: Date.now(),
                };
                // Force immediate center and zoom update
                onCenterChange([initialPos.lat, initialPos.lng]);
                onZoomChange(TRACKING_ZOOM);
                // Short delay to ensure map has updated
                setTimeout(() => {
                    onPositionUpdate(initialPos);
                    onPathUpdate(() => [initialPos]);
                }, 100);

                function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
                    const R = 6371000;
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
                            onPositionUpdate(newPoint);
                            onPathUpdate(prev => [...prev, newPoint]);
                            onCenterChange([newLat, newLng]);
                            lastUpdateTimeRef.current = now;
                            lastPositionRef.current = newPoint;
                        }
                    },
                    (error) => {
                        console.error("Error watching position:", error);
                        toast({
                            title: "Geolocation Error",
                            description: error.message,
                            variant: "destructive"
                        });
                        handleStopTracking();
                    },
                    { enableHighAccuracy: true, timeout: 1000, maximumAge: 0 }
                );

                toast({ title: "Tracking Started", description: "Your path is now being recorded." });
            },
            (error) => {
                toast({
                    title: "Permission Denied",
                    description: "Please enable location access to start tracking.",
                    variant: "destructive"
                });
            }
        );
    }, [onStartTracking, onPositionUpdate, onPathUpdate, onCenterChange, onZoomChange, toast]);

    const handleStopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        onStopTracking();
    }, [onStopTracking]);

    return (
        <Button
            onClick={isTracking ? handleStopTracking : handleStartTracking}
            variant={isTracking ? "destructive" : "default"}
            className="shadow-md sm:w-auto"
        >
            {isTracking ? (
                <>
                    <Square className="mr-2 h-5 w-5" /> Stop Tracking
                </>
            ) : (
                <>
                    <Play className="mr-2 h-5 w-5" /> Start Tracking
                </>
            )}
        </Button>
    );
}
