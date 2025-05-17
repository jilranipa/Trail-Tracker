import { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { format } from "date-fns";
import { Play, Square, Route, CalendarClock, Ruler } from "lucide-react";
import type { GeoPoint, Trail } from "@/types";
import { formatDuration, formatTrailDistance } from '@/lib/utils';

interface TrailPlaybackProps {
    trail: Trail;
    onMarkerPositionChange: (position: GeoPoint) => void;
    onCenterChange: (center: [number, number]) => void;
}

export function TrailPlayback({ trail, onMarkerPositionChange, onCenterChange }: TrailPlaybackProps) {
    const [playbackProgress, setPlaybackProgress] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentMarker, setCurrentMarker] = useState<GeoPoint>(trail.path[0]);
    const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Reset playback when trail changes
    useEffect(() => {
        setPlaybackProgress(0);
        setIsPlaying(false);
        setPlaybackSpeed(1);
        setCurrentMarker(trail.path[0]);
        onMarkerPositionChange(trail.path[0]);
        onCenterChange([trail.path[0].lat, trail.path[0].lng]);
    }, [trail, onMarkerPositionChange, onCenterChange]);

    // Playback effect
    useEffect(() => {
        if (!isPlaying) {
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
            }
            return;
        }

        const path = trail.path;
        const totalDuration = path[path.length - 1].timestamp - path[0].timestamp;
        const startTime = Date.now();
        const trailStartTime = path[0].timestamp;

        playbackIntervalRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTime) * playbackSpeed;
            const currentTime = trailStartTime + elapsed;

            const nextPointIndex = path.findIndex(p => p.timestamp > currentTime);

            if (nextPointIndex === -1) {
                setPlaybackProgress(100);
                const lastPoint = path[path.length - 1];
                setCurrentMarker(lastPoint);
                onMarkerPositionChange(lastPoint);
                onCenterChange([lastPoint.lat, lastPoint.lng]);
                setIsPlaying(false);
                clearInterval(playbackIntervalRef.current!);
                playbackIntervalRef.current = null;
                return;
            }

            const point = path[Math.max(0, nextPointIndex - 1)];
            setCurrentMarker(point);
            onMarkerPositionChange(point);
            onCenterChange([point.lat, point.lng]);
            setPlaybackProgress(((point.timestamp - trailStartTime) / totalDuration) * 100);
        }, 100);

        return () => {
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
            }
        };
    }, [isPlaying, playbackSpeed, trail, onMarkerPositionChange, onCenterChange]);

    const handlePlaybackProgressChange = (value: number[]) => {
        const progress = value[0];
        setPlaybackProgress(progress);
        const pathIndex = Math.floor((progress / 100) * (trail.path.length - 1));
        const targetPoint = trail.path[pathIndex];
        setCurrentMarker(targetPoint);
        onMarkerPositionChange(targetPoint);
        onCenterChange([targetPoint.lat, targetPoint.lng]);
    };

    return (
        <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 w-11/12 max-w-2xl z-40 p-2 sm:p-4 bg-background/90 rounded-xl shadow-2xl backdrop-blur-sm">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 truncate">{trail.name}</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center text-xs text-muted-foreground mb-2 space-y-1 sm:space-y-0 sm:space-x-3">
                <span className="flex items-center">
                    <CalendarClock size={14} className="mr-1" />
                    {format(new Date(trail.startTime), "PPp")}
                </span>
                <span className="flex items-center">
                    <Route size={14} className="mr-1" />
                    {formatDuration(trail.endTime - trail.startTime)}
                </span>
                <span className="flex items-center">
                    <Ruler size={14} className="mr-1" />
                    {formatTrailDistance(trail.distance)}
                </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
                <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setIsPlaying(p => !p)}
                >
                    {isPlaying ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <span className="text-xs">Speed:</span>
                <select
                    className="border rounded px-1 py-0.5 text-xs bg-background"
                    value={playbackSpeed}
                    onChange={e => setPlaybackSpeed(Number(e.target.value))}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
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
                {format(new Date(currentMarker.timestamp), "HH:mm:ss")}
            </p>
        </div>
    );
}
