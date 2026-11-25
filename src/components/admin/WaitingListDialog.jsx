import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

export default function WaitingListDialog({ open, onOpenChange, onSave, waitingListEntry, timeSessions }) {
  const [formData, setFormData] = useState({
    customer_name: "",
    whatsapp_number: "",
    booking_date: "",
    time_slot: "",
    party_size: 2,
    status: "waiting",
    notes: ""
  });

  useEffect(() => {
    if (waitingListEntry) {
      setFormData({
        customer_name: waitingListEntry.customer_name || "",
        whatsapp_number: waitingListEntry.whatsapp_number || "",
        booking_date: waitingListEntry.booking_date || "",
        time_slot: waitingListEntry.time_slot || "",
        party_size: waitingListEntry.party_size || 2,
        status: waitingListEntry.status || "waiting",
        notes: waitingListEntry.notes || ""
      });
    } else {
      setFormData({
        customer_name: "",
        whatsapp_number: "",
        booking_date: "",
        time_slot: "",
        party_size: 2,
        status: "waiting",
        notes: ""
      });
    }
  }, [waitingListEntry]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{waitingListEntry ? "Edit Waiting List Entry" : "Add to Waiting List"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp Number *</Label>
              <Input
                id="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                placeholder="628xxxxxxxxxx"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Booking Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.booking_date ? format(new Date(formData.booking_date), 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.booking_date ? new Date(formData.booking_date) : undefined}
                    onSelect={(date) => setFormData({ ...formData, booking_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time_slot">Time Slot *</Label>
              <Select
                value={formData.time_slot}
                onValueChange={(value) => setFormData({ ...formData, time_slot: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {timeSessions.map((session) => (
                    <SelectItem key={session} value={session}>
                      {session}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="party_size">Number of Guests *</Label>
              <Input
                id="party_size"
                type="number"
                min="1"
                value={formData.party_size}
                onChange={(e) => setFormData({ ...formData, party_size: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
              {waitingListEntry ? "Update" : "Add to Waiting List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}