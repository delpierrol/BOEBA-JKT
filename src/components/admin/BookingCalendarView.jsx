
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek, isSameDay, parseISO, isValid, getDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User } from "lucide-react";

export default function BookingCalendarView({ bookings, capacities, sessionCapacities = [], settings = [], onDateClick }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const getTimeSessions = () => {
    const sessionsSetting = settings.find(s => s.setting_key === 'time_sessions');
    if (sessionsSetting) {
      try {
        return JSON.parse(sessionsSetting.setting_value);
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

  const getCapacityForSession = (dateStr, timeSlot) => {
    const sessionCap = sessionCapacities.find(
      sc => sc.date === dateStr && sc.time_slot === timeSlot
    );
    return sessionCap?.capacity || getDefaultCapacity();
  };

  const getBookingsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings.filter(b => {
      try {
        if (!b.booking_date) return false;
        const bookingDate = typeof b.booking_date === 'string' ? parseISO(b.booking_date) : new Date(b.booking_date);
        if (!isValid(bookingDate)) return false;
        return b.booking_date === dateStr && b.status === 'confirmed';
      } catch (e) {
        console.error("Error parsing booking date:", b.booking_date, e);
        return false;
      }
    });
  };

  const getBookingsBySession = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dateBookings = getBookingsForDate(date);
    const availableSessions = getTimeSessions();

    return availableSessions.map(session => {
      const sessionBookings = dateBookings.filter(b => {
        // Match by start time - booking time_slot can be "09:30 - 11:00" or "09:30 AM"
        const bookingStartTime = b.time_slot.split('-')[0].trim();
        const sessionTime = session.trim();
        
        // Normalize times for comparison
        const normalizeTime = (time) => {
          return time.replace(/\s+/g, '').toLowerCase().replace('am', '').replace('pm', '');
        };
        
        return normalizeTime(bookingStartTime) === normalizeTime(sessionTime) ||
               bookingStartTime === sessionTime ||
               b.time_slot === session;
      });
      
      const totalGuests = sessionBookings.reduce((sum, b) => sum + (b.party_size || 0), 0);
      const sessionCapacity = getCapacityForSession(dateStr, session);
      
      return {
        session,
        booked: totalGuests,
        capacity: sessionCapacity,
        isFull: totalGuests >= sessionCapacity
      };
    });
  };

  return (
    <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-teal-600" />
            Weekly Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-3">
              {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const sessionData = getBookingsBySession(day);
            const isToday = isSameDay(day, new Date());
            const totalBookings = sessionData.reduce((sum, s) => sum + s.booked, 0);
            const totalCapacity = sessionData.reduce((sum, s) => sum + s.capacity, 0);
            const fullSessions = sessionData.filter(s => s.isFull).length;
            const totalSessions = sessionData.length;

            return (
              <div
                key={day.toISOString()}
                onClick={() => onDateClick(day)}
                style={{ backgroundColor: isToday ? undefined : '#fffffd' }}
                className={`cursor-pointer rounded-lg border p-3 hover:shadow-md transition-all ${
                  isToday ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                }`}
              >
                <div className="text-center mb-2">
                  <div className="text-xs font-medium text-gray-600">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? 'text-teal-600' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <User className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-700">{totalBookings}/{totalCapacity}</span>
                  </div>
                  
                  <div className="space-y-1">
                    {sessionData.map((session) => (
                      <div 
                        key={session.session}
                        className={`text-xs px-1.5 py-0.5 rounded text-center ${
                          session.isFull 
                            ? 'bg-red-100 text-red-700 font-semibold' 
                            : session.booked > 0 
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        {session.session}: {session.booked}/{session.capacity}
                      </div>
                    ))}
                  </div>

                  {fullSessions > 0 && (
                    <Badge 
                      variant="outline" 
                      className="w-full justify-center text-xs bg-red-50 text-red-700 border-red-200"
                    >
                      {fullSessions}/{totalSessions} full
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
