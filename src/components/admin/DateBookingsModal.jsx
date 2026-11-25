import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Users, Plus, Edit, X, Save, Loader2 } from "lucide-react";
import ManualBookingDialog from "./ManualBookingDialog";

export default function DateBookingsModal({ 
  open, 
  onOpenChange, 
  selectedDate, 
  bookings, 
  sessionCapacities,
  capacities,
  settings,
  onEditBooking,
  onCancelBooking,
  onCreateBooking
}) {
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(null);
  const [editCapacityValue, setEditCapacityValue] = useState('');
  
  const queryClient = useQueryClient();

  const updateSessionCapacityMutation = useMutation({
    mutationFn: async ({ session, capacity }) => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existing = sessionCapacities.find(
        sc => sc.date === dateStr && sc.time_slot === session
      );
      
      if (existing) {
        return base44.entities.SessionCapacity.update(existing.id, { capacity });
      } else {
        return base44.entities.SessionCapacity.create({
          date: dateStr,
          time_slot: session,
          capacity
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionCapacities']);
      queryClient.invalidateQueries(['bookings']);
      setEditingCapacity(null);
      setEditCapacityValue('');
    },
  });

  if (!selectedDate) return null;

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayBookings = bookings.filter(b => b.booking_date === dateStr);

  const getTimeSessions = () => {
    // Check for custom sessions for the selected date
    const customSessionsSetting = settings.find(s => s.setting_key === 'custom_time_sessions');
    
    if (customSessionsSetting && selectedDate) {
      try {
        const customPeriods = JSON.parse(customSessionsSetting.setting_value);
        
        if (Array.isArray(customPeriods)) {
          // Format selectedDate to 'yyyy-MM-dd' string for comparison
          const targetDate = typeof selectedDate === 'string' ? selectedDate : format(selectedDate, 'yyyy-MM-dd');
          
          // Find matching custom period for selected date
          const matchingPeriod = customPeriods.find(period => {
            if (!period.start_date || !period.end_date || !period.sessions || period.sessions.length === 0) {
              return false;
            }
            
            const startDate = period.start_date;
            const endDate = period.end_date;
            
            return targetDate >= startDate && targetDate <= endDate;
          });
          
          if (matchingPeriod) {
            return matchingPeriod.sessions.map(s => typeof s === 'string' ? s : s.time);
          }
        }
      } catch (e) {
        console.error("Error parsing custom sessions:", e);
      }
    }

    // Fall back to regular sessions
    console.log('Using default/regular sessions');
    const sessionsSetting = settings.find(s => s.setting_key === 'time_sessions');
    if (sessionsSetting) {
      try {
        const parsed = JSON.parse(sessionsSetting.setting_value);
        // Convert to array of strings (time only)
        return parsed.map(s => typeof s === 'string' ? s : s.time);
      } catch (e) {
        return ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
      }
    }
    return ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
  };

  const getDefaultCapacity = () => {
    const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
    return capacitySetting ? parseInt(capacitySetting.setting_value) : 50;
  };

  const getCapacityForSession = (timeSlot) => {
    const sessionCap = sessionCapacities.find(
      sc => sc.date === dateStr && sc.time_slot === timeSlot
    );
    if (sessionCap) return sessionCap.capacity;
    
    const capacity = capacities.find(c => c.date === dateStr);
    return capacity?.total_capacity || getDefaultCapacity();
  };

  const handleSaveBooking = async (formData) => {
    await onCreateBooking(formData);
    setShowAddBooking(false);
  };

  const timeSessions = getTimeSessions();
  const totalBooked = dayBookings.reduce((sum, b) => sum + (b.party_size || 0), 0);
  const totalCapacity = timeSessions.reduce((sum, session) => {
    const sessionStr = typeof session === 'string' ? session : session.time;
    return sum + getCapacityForSession(sessionStr);
  }, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
              <Button 
                onClick={() => setShowAddBooking(true)}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                <p className="text-xs text-teal-600 mb-1">Total Bookings</p>
                <p className="text-2xl font-bold text-teal-900">{dayBookings.length}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-blue-600 mb-1">Total Guests</p>
                <p className="text-2xl font-bold text-blue-900">{totalBooked}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-xs text-purple-600 mb-1">Capacity</p>
                <p className="text-2xl font-bold text-purple-900">{totalCapacity}</p>
              </div>
            </div>

            {/* Session Overview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Session Availability (click capacity to edit)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {timeSessions.map(session => {
                  const sessionStr = typeof session === 'string' ? session : session.time;
                  const sessionCapacity = getCapacityForSession(sessionStr);
                  const sessionBooked = dayBookings.filter(b => {
                    if (b.status !== 'confirmed') return false;
                    const bookingStartTime = b.time_slot.split('-')[0].trim();
                    return bookingStartTime === sessionStr;
                  }).reduce((sum, b) => sum + (b.party_size || 0), 0);
                  const isEditing = editingCapacity === sessionStr;

                  return (
                    <div key={sessionStr} className="flex justify-between items-center bg-white px-3 py-2 rounded border">
                      <span className="text-xs font-medium">{sessionStr}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{sessionBooked}/</span>
                          <Input
                            type="number"
                            value={editCapacityValue}
                            onChange={(e) => setEditCapacityValue(e.target.value)}
                            className="w-14 h-6 text-xs px-1"
                            min={sessionBooked}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              const newCapacity = parseInt(editCapacityValue);
                              if (newCapacity >= sessionBooked) {
                                updateSessionCapacityMutation.mutate({ session, capacity: newCapacity });
                              }
                            }}
                            disabled={updateSessionCapacityMutation.isPending}
                          >
                            {updateSessionCapacityMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setEditingCapacity(null);
                              setEditCapacityValue('');
                            }}
                          >
                            <X className="w-3 h-3 text-gray-500" />
                          </Button>
                        </div>
                      ) : (
                        <Badge 
                          className={`cursor-pointer hover:opacity-80 ${sessionBooked >= sessionCapacity ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                          onClick={() => {
                            setEditingCapacity(sessionStr);
                            setEditCapacityValue(sessionCapacity.toString());
                          }}
                        >
                          {sessionBooked}/{sessionCapacity}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bookings Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Bookings ({dayBookings.length})
              </h3>
              {dayBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No bookings for this date</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Guests</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-mono text-xs">{booking.booking_code}</TableCell>
                          <TableCell>{booking.customer_name}</TableCell>
                          <TableCell>{booking.time_slot}</TableCell>
                          <TableCell>{booking.party_size}</TableCell>
                          <TableCell>
                            <Badge className={
                              booking.status === 'confirmed' 
                                ? 'bg-green-100 text-green-800'
                                : booking.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-gray-600">
                            {booking.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditBooking(booking)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {booking.status === 'confirmed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onCancelBooking(booking)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ManualBookingDialog
        open={showAddBooking}
        onOpenChange={setShowAddBooking}
        onSave={handleSaveBooking}
        booking={{ booking_date: dateStr }}
        timeSessions={timeSessions}
      />
    </>
  );
}