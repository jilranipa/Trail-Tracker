"use client";

import type { Trail } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, MapPin } from "lucide-react";
import { format } from "date-fns";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trails: Trail[];
  onSelectTrail: (trail: Trail) => void;
  onDeleteTrail: (trailId: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  trails,
  onSelectTrail,
  onDeleteTrail,
}) => {
  const formatDuration = (startTime: number, endTime: number) => {
    const durationMs = endTime - startTime;
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${seconds}s`;
  };

  const formatDistance = (distance?: number) => {
    if (distance === undefined) return "N/A";
    if (distance < 1000) return `${distance.toFixed(0)} m`;
    return `${(distance / 1000).toFixed(2)} km`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] bg-card text-card-foreground shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Past Trails</DialogTitle>
          <DialogDescription>
            Select a trail to view its path or delete it.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          {trails.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No trails recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {trails.map((trail) => (
                <li
                  key={trail.id}
                  className="flex items-center justify-between p-3 bg-background border border-border rounded-md hover:shadow-md transition-shadow"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{trail.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(trail.startTime), "MMM dd, yyyy - HH:mm")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Duration: {formatDuration(trail.startTime, trail.endTime)} | Distance: {formatDistance(trail.distance)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onSelectTrail(trail)}
                      aria-label={`View trail ${trail.name}`}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => onDeleteTrail(trail.id)}
                      aria-label={`Delete trail ${trail.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryModal;
