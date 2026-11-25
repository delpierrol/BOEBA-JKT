import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isBefore, startOfDay, getDay, isToday, parse } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function BookingCalendar({ bookings, capacities, onDateSelect }) {
  const today = startOfDay(new Date());

  // Fetch settings to get time sessions
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });

  // Fetch session capacities
  const { data: sessionCapacities = [] } = useQuery({
    queryKey: ['sessionCapacities'],
    queryFn: () => base44.entities.SessionCapacity.list(),
  });

  const getTimeSessions = (date = null) => {
    // Check for custom sessions first if date is provided
    if (date) {
      const customSessionsSetting = settings.find(s => s.setting_key === 'custom_time_sessions');
      if (customSessionsSetting) {
        try {
          const customPeriods = JSON.parse(customSessionsSetting.setting_value);
          if (Array.isArray(customPeriods)) {
            const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
            
            // Find matching custom period
            const matchingPeriod = customPeriods.find(period => 
              period.start_date && period.end_date &&
              dateStr >= period.start_date && dateStr <= period.end_date &&
              period.sessions && period.sessions.length > 0
            );
            
            if (matchingPeriod) {
              // Convert to array of strings (time only)
              return matchingPeriod.sessions.map(s => typeof s === 'string' ? s : s.time);
            }
          }
        } catch (e) {
          console.error("Error parsing custom sessions:", e);
        }
      }
    }

    // Fall back to regular sessions
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

  const isFridayPrayerEnabled = () => {
    const prayerSetting = settings.find(s => s.setting_key === 'friday_prayer_closure');
    if (prayerSetting) {
      return prayerSetting.setting_value === 'true' || prayerSetting.setting_value === true;
    }
    return false;
  };

  const getAvailableSessionsForDate = (date) => {
    const timeSessions = getTimeSessions(date);
    const dayOfWeek = getDay(date);
    
    // If Friday and prayer closure is enabled, exclude 11:00 session
    if (dayOfWeek === 5 && isFridayPrayerEnabled()) {
      return timeSessions.filter(session => {
        // Ensure session is a string
        const sessionStr = typeof session === 'string' ? session : session.time;
        return sessionStr !== "11:00" && 
               sessionStr !== "11:00 AM" && 
               !sessionStr.startsWith("11:00");
      });
    }
    
    return timeSessions;
  };

  const parseTimeSlot = (slot) => {
    try {
      // Extract time string if slot is an object
      const slotStr = typeof slot === 'string' ? slot : (slot?.time || slot);
      
      // Handle various formats like "11:00 AM", "11:00", "11:00 AM - 12:00 PM"
      // Extract just the start time
      const timeStr = slotStr.split('-')[0].trim();
      
      let parsed;
      
      // Try to parse with AM/PM first
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        // Try single digit hour first (h:mm a)
        parsed = parse(timeStr, 'h:mm a', new Date());
        if (isNaN(parsed.getTime())) {
          // Try double digit hour (hh:mm a)
          parsed = parse(timeStr, 'hh:mm a', new Date());
        }
      } else {
        // Try 24-hour format
        parsed = parse(timeStr, 'HH:mm', new Date());
        if (isNaN(parsed.getTime())) {
          // Try without leading zero
          parsed = parse(timeStr, 'H:mm', new Date());
        }
      }
      
      // Check if parsing was successful
      if (isNaN(parsed.getTime())) {
        console.error("Failed to parse time slot:", slot);
        return null;
      }
      
      return parsed;
    } catch (e) {
      console.error("Error parsing time slot:", slot, e);
      return null;
    }
  };

  const isSlotPassed = (slot) => {
    const slotTime = parseTimeSlot(slot);
    if (!slotTime) return false;

    const now = new Date();
    
    // Slot has passed if current time is after the slot time
    return now > slotTime;
  };

  const areAllSessionsPassed = (date) => {
    // Only check for today
    if (!isToday(date)) return false;

    const availableSessions = getAvailableSessionsForDate(date);
    
    // Check if all sessions have passed
    return availableSessions.every(slot => isSlotPassed(slot));
  };

  const getBookingsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dateBookings = bookings.filter(b => b.booking_date === dateStr && b.status === 'confirmed');
    // Sum up all party_size instead of just counting bookings
    return dateBookings.reduce((total, booking) => total + (booking.party_size || 0), 0);
  };

  const getDefaultCapacity = () => {
    const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
    return capacitySetting ? parseInt(capacitySetting.setting_value) : 50;
  };

  const getCapacityForSession = (dateStr, timeSlot) => {
    // Ensure timeSlot is a string
    const timeSlotStr = typeof timeSlot === 'string' ? timeSlot : timeSlot.time;
    
    // Check SessionCapacity first
    const sessionCap = sessionCapacities.find(
      sc => sc.date === dateStr && sc.time_slot === timeSlotStr
    );
    
    if (sessionCap) {
      return sessionCap.capacity;
    }
    
    // Fallback to DateCapacity or default
    const capacity = capacities.find(c => c.date === dateStr);
    return capacity?.total_capacity || getDefaultCapacity();
  };

  const getTotalCapacityForDate = (date) => {
    const availableSessions = getAvailableSessionsForDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return availableSessions.reduce((total, session) => {
      return total + getCapacityForSession(dateStr, session);
    }, 0);
  };

  const isDateAvailable = (date) => {
    if (isBefore(date, today)) return false;
    
    // Check if all sessions have passed for today
    if (isToday(date) && areAllSessionsPassed(date)) return false;
    
    const totalCapacity = getTotalCapacityForDate(date);
    const booked = getBookingsForDate(date);
    
    return booked < totalCapacity;
  };

  const modifiers = {
    available: (date) => isDateAvailable(date) && !isBefore(date, today) && !(isToday(date) && areAllSessionsPassed(date)),
    full: (date) => (!isDateAvailable(date) || (isToday(date) && areAllSessionsPassed(date))) && !isBefore(date, today),
    today: (date) => isToday(date),
  };

  const modifiersStyles = {
    available: { 
      backgroundColor: '#5eead4',
      color: '#134e4a',
      fontWeight: 'bold',
      borderRadius: '50%'
    },
    full: { 
      backgroundColor: '#fecaca',
      color: '#991b1b',
      fontWeight: 'bold',
      borderRadius: '50%'
    },
    today: {
      backgroundColor: '#0891b2',
      color: '#ffffff',
      fontWeight: 'extrabold',
      borderRadius: '50%',
      border: '3px solid #06b6d4'
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card style={{ backgroundColor: '#ffffff', marginTop: '-2em' }} className="shadow-xl border-2 border-teal-300/50">
        <CardHeader className="border-b border-teal-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-md font-bold text-gray-900">
            <CalendarIcon className="w-6 h-6 text-teal-600" />
            Select Your Booking Date
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="flex justify-center mb-6">
            <Calendar
              mode="single"
              onSelect={(date) => date && onDateSelect(format(date, 'yyyy-MM-dd'))}
              disabled={(date) => isBefore(date, today) || !isDateAvailable(date) || (isToday(date) && areAllSessionsPassed(date))}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-xl border-2 border-teal-300 p-4"
              classNames={{
                months: "space-y-4",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-xl md:text-2xl font-bold text-gray-900",
                nav: "space-x-1 flex items-center",
                nav_button: "h-10 w-10 bg-transparent hover:bg-teal-100 p-2 rounded-md transition-colors",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex justify-between mb-2",
                head_cell: "text-gray-600 rounded-md w-10 md:w-14 font-bold text-sm md:text-base text-center uppercase",
                row: "flex w-full mt-2 justify-between gap-1",
                cell: "text-center p-0 relative focus-within:relative focus-within:z-20",
                day: "h-9 w-9 md:h-14 md:w-14 p-0 font-bold text-sm md:text-lg hover:bg-teal-100 rounded-full transition-all flex items-center justify-center mx-auto",
                day_selected: "bg-teal-500 text-white hover:bg-teal-600",
                day_today: "bg-white text-gray-900 font-extrabold ring-2 ring-teal-400",
                day_outside: "text-gray-300 opacity-50",
                day_disabled: "text-gray-300 opacity-30",
                day_hidden: "invisible",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="w-6 h-6 bg-teal-300 rounded-full flex-shrink-0"></div>
              <p className="text-sm md:text-base font-semibold text-gray-900">Available</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="w-6 h-6 bg-red-300 rounded-full flex-shrink-0"></div>
              <p className="text-sm md:text-base font-semibold text-gray-900">Fully Booked</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}