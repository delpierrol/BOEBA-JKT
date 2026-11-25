import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

export default function CapacityDialog({ open, onOpenChange, capacity, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    date: "",
    total_capacity: 50,
    sunday_reserved_slots: null
  });

  useEffect(() => {
    if (capacity) {
      setFormData({
        date: capacity.date || "",
        total_capacity: capacity.total_capacity || 50,
        sunday_reserved_slots: capacity.sunday_reserved_slots ?? null
      });
    }
  }, [capacity]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isSunday = formData.date ? new Date(formData.date).getDay() === 0 : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            Set Capacity
          </DialogTitle>
          <DialogDescription>
            Configure capacity for {formData.date ? format(new Date(formData.date), 'MMMM d, yyyy') : 'selected date'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="capacity">Total Capacity (per session)</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={formData.total_capacity}
              onChange={(e) => setFormData({ ...formData, total_capacity: parseInt(e.target.value) })}
              required
            />
            <p className="text-xs text-gray-600">Number of guests that can be seated per time slot</p>
          </div>

          {isSunday && (
            <div className="space-y-2">
              <Label htmlFor="sunday-reserved">Sunday Morning Reserved Slots</Label>
              <Input
                id="sunday-reserved"
                type="number"
                min="0"
                value={formData.sunday_reserved_slots ?? ""}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  sunday_reserved_slots: e.target.value === "" ? null : parseInt(e.target.value) 
                })}
                placeholder="Leave empty for default"
              />
              <p className="text-xs text-gray-600">Reserved capacity for walk-ins during Sunday morning (08:00-11:00)</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Capacity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}