import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { isToday, parse } from "date-fns";

export default function ManualBookingDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  booking = null,
  timeSessions = []
}) {
  const [formData, setFormData] = useState({
    customer_name: "",
    whatsapp_number: "",
    customer_email: "",
    booking_date: "",
    time_slot: "",
    party_size: 2,
    status: "confirmed",
    notes: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  // Default time sessions fallback
  const defaultTimeSessions = ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
  const availableTimeSessions = Array.isArray(timeSessions) && timeSessions.length > 0 ? timeSessions : defaultTimeSessions;

  useEffect(() => {
    if (booking) {
      setFormData({
        customer_name: booking.customer_name || "",
        whatsapp_number: booking.whatsapp_number || "",
        customer_email: booking.customer_email || "",
        booking_date: booking.booking_date || "",
        time_slot: booking.time_slot || "",
        party_size: booking.party_size || 2,
        status: booking.status || "confirmed",
        notes: booking.notes || ""
      });
    } else {
      setFormData({
        customer_name: "",
        whatsapp_number: "",
        customer_email: "",
        booking_date: "",
        time_slot: "",
        party_size: 2,
        status: "confirmed",
        notes: ""
      });
    }
  }, [booking, open]);

  const parseTimeSlot = (slot) => {
    try {
      const timeStr = slot.split('-')[0].trim();
      let parsed;
      
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        parsed = parse(timeStr, 'h:mm a', new Date());
        if (isNaN(parsed.getTime())) {
          parsed = parse(timeStr, 'hh:mm a', new Date());
        }
      } else {
        parsed = parse(timeStr, 'HH:mm', new Date());
        if (isNaN(parsed.getTime())) {
          parsed = parse(timeStr, 'H:mm', new Date());
        }
      }
      
      if (isNaN(parsed.getTime())) {
        return null;
      }
      
      return parsed;
    } catch (e) {
      return null;
    }
  };

  const isSlotPassed = (slot) => {
    if (!formData.booking_date) return false;
    
    try {
      const bookingDate = new Date(formData.booking_date);
      if (!isToday(bookingDate)) return false;
      
      const slotTime = parseTimeSlot(slot);
      if (!slotTime) return false;
      
      const now = new Date();
      return now > slotTime;
    } catch (e) {
      return false;
    }
  };

  const getFilteredTimeSessions = () => {
    return availableTimeSessions.filter(slot => !isSlotPassed(slot));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Reset time slot if date changes and current slot has passed
      if (field === 'booking_date' && prev.time_slot) {
        const tempFormData = { ...prev, booking_date: value };
        const slotPassed = isSlotPassed(prev.time_slot);
        if (slotPassed) {
          updated.time_slot = "";
        }
      }
      
      return updated;
    });
  };

  const filteredTimeSessions = getFilteredTimeSessions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{booking ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">WhatsApp Number *</Label>
                <Input
                  id="whatsapp_number"
                  type="tel"
                  placeholder="628111083547"
                  value={formData.whatsapp_number}
                  onChange={(e) => handleChange('whatsapp_number', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_email">Email (Optional)</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) => handleChange('customer_email', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="booking_date">Booking Date *</Label>
                <Input
                  id="booking_date"
                  type="date"
                  value={formData.booking_date}
                  onChange={(e) => handleChange('booking_date', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_slot">Time Slot *</Label>
                <Select 
                  value={formData.time_slot} 
                  onValueChange={(value) => handleChange('time_slot', value)}
                  required
                >
                  <SelectTrigger id="time_slot">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTimeSessions.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500 text-center">
                        No available time slots for selected date
                      </div>
                    ) : (
                      filteredTimeSessions.map((session) => (
                        <SelectItem key={session} value={session}>
                          {session}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formData.booking_date && filteredTimeSessions.length < availableTimeSessions.length && (
                  <p className="text-xs text-amber-600">
                    Past time slots are hidden for today's date
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="party_size">Number of Guests *</Label>
                <Input
                  id="party_size"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.party_size}
                  onChange={(e) => handleChange('party_size', parseInt(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any special requests or notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                booking ? 'Update Booking' : 'Create Booking'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}