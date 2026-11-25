import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from "date-fns";

export default function BookingCalendarFull({ bookings, sessionCapacities, capacities, settings, onDateClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getTimeSessions = () => {
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

  const getCapacityForSession = (dateStr, timeSlot) => {
    const sessionCap = sessionCapacities.find(
      sc => sc.date === dateStr && sc.time_slot === timeSlot
    );
    if (sessionCap) return sessionCap.capacity;
    
    const capacity = capacities.find(c => c.date === dateStr);
    return capacity?.total_capacity || getDefaultCapacity();
  };

  const getBookingsForDate = (dateStr) => {
    return bookings.filter(b => b.booking_date === dateStr && b.status === 'confirmed');
  };

  const getTotalCapacityForDate = (dateStr) => {
    const timeSessions = getTimeSessions();
    return timeSessions.reduce((sum, session) => {
      const sessionStr = typeof session === 'string' ? session : session.time;
      return sum + getCapacityForSession(dateStr, sessionStr);
    }, 0);
  };

  const getTotalBookedForDate = (dateStr) => {
    return getBookingsForDate(dateStr).reduce((sum, b) => sum + (b.party_size || 0), 0);
  };

  const getAvailabilityStatus = (dateStr) => {
    const totalCapacity = getTotalCapacityForDate(dateStr);
    const totalBooked = getTotalBookedForDate(dateStr);
    const percentage = (totalBooked / totalCapacity) * 100;

    if (percentage >= 90) return { status: 'full', color: 'bg-red-100 border-red-300', textColor: 'text-red-900' };
    if (percentage >= 70) return { status: 'busy', color: 'bg-amber-100 border-amber-300', textColor: 'text-amber-900' };
    if (percentage >= 40) return { status: 'moderate', color: 'bg-blue-100 border-blue-300', textColor: 'text-blue-900' };
    return { status: 'available', color: 'bg-green-100 border-green-300', textColor: 'text-green-900' };
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (onDateClick) onDateClick(date);
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-teal-600" />
            Calendar View - {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handleToday} variant="outline" size="sm">
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button onClick={handlePreviousMonth} variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button onClick={handleNextMonth} variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
            <span className="text-gray-600">Available (&lt;40%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
            <span className="text-gray-600">Moderate (40-70%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></div>
            <span className="text-gray-600">Busy (70-90%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
            <span className="text-gray-600">Full (90%+)</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Calendar Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekdays.map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayBookings = getBookingsForDate(dateStr);
                const totalBooked = getTotalBookedForDate(dateStr);
                const totalCapacity = getTotalCapacityForDate(dateStr);
                const availStatus = getAvailabilityStatus(dateStr);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDateClick(day)}
                    className={`
                      relative min-h-[100px] p-2 rounded-lg border-2 transition-all
                      ${isTodayDate && isCurrentMonth ? 'bg-cyan-100 border-cyan-500 ring-2 ring-cyan-500' : isCurrentMonth ? availStatus.color : 'bg-gray-50 border-gray-200 opacity-50'}
                      ${isSelected && !isTodayDate ? 'ring-2 ring-teal-500' : ''}
                      hover:shadow-md hover:scale-105
                    `}
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${
                          isTodayDate && isCurrentMonth ? 'text-cyan-900' : isCurrentMonth ? availStatus.textColor : 'text-gray-400'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {isTodayDate && (
                          <Badge className="text-[10px] px-1 py-0 bg-cyan-600 text-white">
                            Today
                          </Badge>
                        )}
                      </div>

                      {isCurrentMonth && dayBookings.length > 0 && (
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs">
                              <Users className="w-3 h-3" />
                              <span className="font-semibold">{dayBookings.length}</span>
                              <span className="text-gray-600">booking{dayBookings.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="text-xs font-medium">
                              {totalBooked}/{totalCapacity} guests
                            </div>
                          </div>

                          {availStatus.status === 'full' && (
                            <div className="flex items-center gap-1 text-[10px] text-red-700 font-bold mt-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>FULL</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
            <h3 className="font-semibold text-teal-900 mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            
            {(() => {
              const dateStr = format(selectedDate, 'yyyy-MM-dd');
              const dayBookings = getBookingsForDate(dateStr);
              const totalBooked = getTotalBookedForDate(dateStr);
              const totalCapacity = getTotalCapacityForDate(dateStr);
              const timeSessions = getTimeSessions();

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-teal-800">Total Bookings:</span>
                    <Badge className="bg-teal-600 text-white">{dayBookings.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-teal-800">Total Guests:</span>
                    <Badge className="bg-teal-600 text-white">{totalBooked} / {totalCapacity}</Badge>
                  </div>

                  <div className="pt-3 border-t border-teal-300">
                    <p className="text-xs font-semibold text-teal-900 mb-2">Sessions:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {timeSessions.map(session => {
                        const sessionCapacity = getCapacityForSession(dateStr, session);
                        const sessionBooked = bookings.filter(b => {
                          if (b.booking_date !== dateStr || b.status !== 'confirmed') return false;
                          const bookingStartTime = b.time_slot.split('-')[0].trim();
                          return bookingStartTime === session;
                        }).reduce((sum, b) => sum + (b.party_size || 0), 0);

                        return (
                          <div key={session} className="flex justify-between items-center text-xs bg-white px-2 py-1 rounded border border-teal-200">
                            <span className="font-medium">{session}</span>
                            <span className={sessionBooked >= sessionCapacity ? 'text-red-600 font-bold' : 'text-gray-700'}>
                              {sessionBooked}/{sessionCapacity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}