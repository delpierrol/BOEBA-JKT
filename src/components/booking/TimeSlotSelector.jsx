import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, getDay, isToday, parse } from "date-fns";
import { Clock, ArrowLeft, Users, AlertCircle, Ban, Coffee, Utensils, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import JoinWaitlistDialog from "./JoinWaitlistDialog";

export default function TimeSlotSelector({ selectedDate, bookings, capacities, onTimeSlotSelect, onBack }) {
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [showFridayPrayerDialog, setShowFridayPrayerDialog] = useState(false);
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  const [waitlistTimeSlot, setWaitlistTimeSlot] = useState(null);
  const [walkInSessionType, setWalkInSessionType] = useState(null); // 'first' or 'last'
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [pendingTimeSlot, setPendingTimeSlot] = useState(null);
  
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

  const DEFAULT_TIME_SESSIONS = ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];

  const getTimeSessions = () => {
    // Check for custom sessions for the selected date
    const customSessionsSetting = settings.find(s => s.setting_key === 'custom_time_sessions');
    if (customSessionsSetting) {
      try {
        const customPeriods = JSON.parse(customSessionsSetting.setting_value);
        if (Array.isArray(customPeriods)) {
          // Find matching custom period for selected date
          const matchingPeriod = customPeriods.find(period => 
            period.start_date && period.end_date &&
            selectedDate >= period.start_date && selectedDate <= period.end_date &&
            period.sessions && period.sessions.length > 0
          );
          
          if (matchingPeriod) {
            return matchingPeriod.sessions.map(s => typeof s === 'string' ? { time: s, walkInOnly: false } : s);
          }
        }
      } catch (e) {
        console.error("Error parsing custom sessions:", e);
      }
    }

    // Fall back to regular sessions
    const sessionsSetting = settings.find(s => s.setting_key === 'time_sessions');
    if (sessionsSetting) {
      try {
        const parsed = JSON.parse(sessionsSetting.setting_value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Convert old format to new format if needed
          return parsed.map((s, idx) => {
            if (typeof s === 'string') {
              return { time: s, walkInOnly: idx === 0 || idx === parsed.length - 1 };
            }
            return s;
          });
        }
      } catch (e) {
        console.error("Error parsing time sessions:", e);
      }
    }
    return DEFAULT_TIME_SESSIONS.map((t, idx) => ({ 
      time: t, 
      walkInOnly: idx === 0 || idx === DEFAULT_TIME_SESSIONS.length - 1 
    }));
  };

  const getDefaultCapacity = () => {
    const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
    return capacitySetting ? parseInt(capacitySetting.setting_value) : 50;
  };

  const getSundayReservedSlots = () => {
    const date = parseISO(selectedDate);
    
    // First check if there's a date-specific override
    const dateCapacity = capacities.find(c => c.date === selectedDate);
    if (dateCapacity && dateCapacity.sunday_reserved_slots !== null && dateCapacity.sunday_reserved_slots !== undefined) {
      return dateCapacity.sunday_reserved_slots;
    }
    
    // Check if it's an odd Sunday (week 1, 3, 5 of the month)
    const dayOfWeek = getDay(date);
    if (dayOfWeek !== 0) return 0; // Not Sunday
    
    const dayOfMonth = date.getDate();
    const weekOfMonth = Math.ceil(dayOfMonth / 7);
    
    // Only apply reserved slots on odd weeks (1st, 3rd, 5th Sunday)
    if (weekOfMonth % 2 === 0) return 0; // Even week, no reservation
    
    // Otherwise use global setting
    const reservedSetting = settings.find(s => s.setting_key === 'sunday_morning_reserved');
    return reservedSetting ? parseInt(reservedSetting.setting_value) : 0;
  };

  const getBreakfastMenuText = () => {
    const breakfastSetting = settings.find(s => s.setting_key === 'breakfast_menu_text');
    return breakfastSetting?.setting_value || 'During this session, only our breakfast menu is available. Enjoy fresh morning specialties!';
  };

  const isSundayMorningSession = (slot) => {
    const dayOfWeek = getDay(parseISO(selectedDate)); // 0 = Sunday
    if (dayOfWeek !== 0) return false; // Not Sunday
    
    // Check if slot is between 08:00 - 11:00
    // Handle various formats
    const slotStr = slot.toLowerCase();
    const isEarlyMorning = 
      slot === "08:00" || 
      slot === "09:00" || 
      slot === "09:30" ||
      slot === "10:00" ||
      slot === "10:30" ||
      slotStr.includes("08:00") ||
      slotStr.includes("09:") ||
      slotStr.includes("10:");
    
    return isEarlyMorning;
  };

  const getCapacityForSlot = (slot) => {
    // First check SessionCapacity for specific session capacity
    const sessionCap = sessionCapacities.find(
      sc => sc.date === selectedDate && sc.time_slot === slot
    );
    
    if (sessionCap) {
      return sessionCap.capacity;
    }
    
    // Fallback to old DateCapacity logic
    const baseCapacity = capacities.find(c => c.date === selectedDate)?.total_capacity || getDefaultCapacity();
    
    // If it's Sunday morning session, reduce capacity by reserved slots
    if (isSundayMorningSession(slot)) {
      const reserved = getSundayReservedSlots();
      return Math.max(0, baseCapacity - reserved);
    }
    
    return baseCapacity;
  };

  const getBookingsForSlot = (timeSlot) => { // timeSlot here is the session's start time, e.g., "11:00 AM"
    return bookings.filter(b => {
      if (b.booking_date !== selectedDate || b.status !== 'confirmed') return false;
      
      // Match by start time - booking time_slot can be "09:30 - 11:00" or "09:30 AM"
      const bookingStartTime = b.time_slot.split('-')[0].trim();
      const sessionTime = timeSlot.trim();
      
      // Normalize times for comparison
      const normalizeTime = (time) => {
        return time.replace(/\s+/g, '').toLowerCase().replace('am', '').replace('pm', '');
      };
      
      return normalizeTime(bookingStartTime) === normalizeTime(sessionTime) ||
             bookingStartTime === sessionTime ||
             b.time_slot === timeSlot;
    }).reduce((sum, b) => sum + (b.party_size || 0), 0);
  };

  const isFridayPrayerEnabled = () => {
    const prayerSetting = settings.find(s => s.setting_key === 'friday_prayer_closure');
    if (prayerSetting) {
      return prayerSetting.setting_value === 'true' || prayerSetting.setting_value === true;
    }
    return false;
  };

  const isFridayPrayerSlot = (slot) => {
    const prayerEnabled = isFridayPrayerEnabled();
    
    if (!prayerEnabled) return false;
    
    const dayOfWeek = getDay(parseISO(selectedDate)); // 0 = Sunday, 5 = Friday
    
    if (dayOfWeek !== 5) return false; // Not Friday
    
    // Check if the slot is exactly 11:00 or starts with 11:00
    const isPrayerTime = 
      slot === "11:00" || // Exact 24-hour format
      slot === "11:00 AM" || // Exact 12-hour format
      slot.startsWith("11:00"); // Ranges starting with 11:00
    
    return isPrayerTime;
  };

  // Check if slot is walk-in only based on settings
  const isWalkInOnlySlot = (sessionObj) => {
    if (!sessionObj) return false;
    return sessionObj.walkInOnly === true;
  };

  // Determine if it's the first or last session
  const getWalkInSessionType = (slot, allSlots) => {
    if (!allSlots || allSlots.length === 0) return null;
    
    if (slot === allSlots[0]) return 'first';
    if (slot === allSlots[allSlots.length - 1]) return 'last';
    
    return null;
  };

  const parseTimeSlot = (slot) => {
    try {
      // Handle various formats like "11:00 AM", "11:00", "11:00 AM - 12:00 PM"
      // Extract just the start time
      const timeStr = slot.split('-')[0].trim();
      
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
    // Only check if selected date is today
    if (!isToday(parseISO(selectedDate))) {
      return false;
    }

    const slotTime = parseTimeSlot(slot);
    if (!slotTime) return false;

    const now = new Date();
    
    // Slot has passed if current time is after the slot time
    // For comparison, use a dummy date for slotTime if it's not already derived from selectedDate
    const today = new Date();
    const slotDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), slotTime.getHours(), slotTime.getMinutes(), slotTime.getSeconds());

    return now > slotDateTime;
  };

  // Function to format time range for a session
  const getTimeRange = (startTime, nextTime) => {
    if (!nextTime) {
      // For the last session, just show the start time
      return startTime;
    }
    return `${startTime} - ${nextTime}`;
  };

  const handleSlotClick = (slot, isAvailable, isFridayPrayer, isWalkInOnly, sessionType) => {
    // When user clicks a slot, store the time range (start - end)
    const nextSlot = availableTimeSlots[availableTimeSlots.indexOf(slot) + 1];
    const timeRange = getTimeRange(slot, nextSlot);
    
    if (isFridayPrayer) {
      setPendingTimeSlot(timeRange);
      setShowFridayPrayerDialog(true);
    } else if (isWalkInOnly) {
      setWalkInSessionType(sessionType);
      setShowWalkInDialog(true);
    } else if (isAvailable) {
      onTimeSlotSelect(timeRange);
    }
  };

  const handleFridayPrayerContinue = () => {
    setShowFridayPrayerDialog(false);
    if (pendingTimeSlot) {
      onTimeSlotSelect(pendingTimeSlot);
      setPendingTimeSlot(null);
    }
  };

  const TIME_SLOTS_DATA = getTimeSessions();
  // Always ensure we have an array of strings
  const TIME_SLOTS = Array.isArray(TIME_SLOTS_DATA) 
    ? TIME_SLOTS_DATA.map(s => typeof s === 'string' ? s : s.time)
    : [];
  const isFriday = getDay(parseISO(selectedDate)) === 5;

  // Safety check: ensure TIME_SLOTS is an array
  if (!Array.isArray(TIME_SLOTS) || TIME_SLOTS.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <Card style={{ backgroundColor: '#fffffd', marginTop: '-2em' }} className="backdrop-blur-sm shadow-xl border-teal-200/50">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Loading time slots...</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Filter out passed time slots
  const availableTimeSlots = TIME_SLOTS.filter(slot => !isSlotPassed(slot));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <Card style={{ backgroundColor: '#fffffd', marginTop: '-2em' }} className="backdrop-blur-sm shadow-xl border-teal-200/50">
          <CardHeader className="border-b border-teal-100">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="hover:bg-teal-50"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                </CardTitle>
                <p className="text-gray-600 text-xs md:text-sm mt-1">
                  Choose Your Session
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {availableTimeSlots.length === 0 ? (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>No available sessions:</strong> All time slots for today have passed. Please select a different date.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {availableTimeSlots.map((slot, index) => {
                  // Ensure slot is a string
                  const slotStr = typeof slot === 'string' ? slot : slot.time;
                  const sessionIndex = TIME_SLOTS.indexOf(slotStr);
                  const sessionData = TIME_SLOTS_DATA[sessionIndex];
                  const nextSlot = availableTimeSlots[index + 1];
                  const nextSlotStr = nextSlot ? (typeof nextSlot === 'string' ? nextSlot : nextSlot.time) : null;
                  const timeRange = getTimeRange(slotStr, nextSlotStr);
                  const booked = getBookingsForSlot(slotStr); // Pass the start 'slot' here, not the full 'timeRange'
                  const capacityForSlot = getCapacityForSlot(slotStr);
                  const available = capacityForSlot - booked;
                  const isFridayPrayer = isFridayPrayerSlot(slotStr);
                  const isWalkInOnly = isWalkInOnlySlot(sessionData);
                  const walkInType = getWalkInSessionType(slotStr, TIME_SLOTS);
                  // All special sessions (Friday prayer and walk-in) are treated as "available" and clickable
                  const isAvailable = available > 0 || isFridayPrayer || isWalkInOnly;
                  const isHovered = hoveredSlot === slotStr;

                  return (
                    <motion.div
                      key={slotStr}
                      whileHover={isAvailable ? { scale: 1.02 } : {}}
                      whileTap={isAvailable ? { scale: 0.98 } : {}}
                      onMouseEnter={() => setHoveredSlot(slotStr)}
                      onMouseLeave={() => setHoveredSlot(null)}
                      className="relative"
                    >
                      <Button
                        onClick={() => handleSlotClick(slot, isAvailable, isFridayPrayer, isWalkInOnly, walkInType)}
                        disabled={!isAvailable}
                        className={`w-full h-24 md:h-28 flex flex-col items-center justify-center gap-1.5 md:gap-2 relative text-sm md:text-base ${
                          isAvailable
                            ? 'bg-gradient-to-br from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <Clock className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="font-semibold text-base md:text-lg">Session {index + 1}</span>
                        </div>
                        <span className="font-bold text-lg md:text-xl">{timeRange}</span>
                        {isWalkInOnly && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-lg text-xs">
                            <Utensils className="w-3 h-3 mr-1" />
                            Walk-In Only
                          </Badge>
                        )}
                        {!isAvailable && !isFridayPrayer && !isWalkInOnly && (
                          <Badge className="bg-red-500 text-white border-0 shadow-lg text-xs">
                            Full Book
                          </Badge>
                        )}
                      </Button>
                      {/* Join Waitlist button for full sessions */}
                      {!isAvailable && !isFridayPrayer && !isWalkInOnly && (
                        <Button
                          onClick={() => {
                            const nextSlotForWaitlistIndex = index + 1;
                            const nextSlotForWaitlist = availableTimeSlots[nextSlotForWaitlistIndex];
                            const nextSlotForWaitlistStr = nextSlotForWaitlist ? (typeof nextSlotForWaitlist === 'string' ? nextSlotForWaitlist : nextSlotForWaitlist.time) : null;
                            const timeRangeForWaitlist = getTimeRange(slotStr, nextSlotForWaitlistStr);
                            setWaitlistTimeSlot(timeRangeForWaitlist);
                            setShowWaitlistDialog(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-white border-amber-400 text-amber-700 hover:bg-amber-50 shadow-md text-xs px-3"
                        >
                          <Bell className="w-3 h-3 mr-1" />
                          Join Waitlist
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

          </CardContent>
        </Card>
      </motion.div>

      {/* Friday Prayer Dialog */}
      <Dialog open={showFridayPrayerDialog} onOpenChange={setShowFridayPrayerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <DialogTitle className="text-xl">Friday Prayer Session</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
              <p className="text-amber-900 font-medium mb-2">
                🕌 Limited Service During Prayer Time
              </p>
              <p className="text-sm text-amber-800">
                From <strong>11:30 AM - 12:30 PM</strong>, our male staff will attend Friday prayer.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-1">✓ Available:</p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4">
                  <li>• All drinks and beverages</li>
                  <li>• Selected menu items</li>
                </ul>
              </div>

              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-semibold text-red-900 mb-1">✗ Limited:</p>
                <ul className="text-sm text-red-800 space-y-1 ml-4">
                  <li>• Main course</li>
                </ul>
              </div>
            </div>

            <div className="p-3 rounded-lg">
              <p className="text-xs text-teal-800 text-center">
                Thank you for your understanding.
              </p>
            </div>
          </DialogDescription>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                setShowFridayPrayerDialog(false);
                setPendingTimeSlot(null);
              }}
              className="flex-1"
            >
              Choose Different Time
            </Button>
            <Button 
              onClick={handleFridayPrayerContinue}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
            >
              Continue Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-In Only Dialog */}
      <Dialog open={showWalkInDialog} onOpenChange={setShowWalkInDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                {walkInSessionType === 'first' ? (
                  <Coffee className="w-6 h-6 text-gray-600" />
                ) : (
                  <Utensils className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <DialogTitle className="text-xl">
                {walkInSessionType === 'first' ? 'Breakfast Session' : 'Final Session'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="space-y-4 py-4">
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-300">
              <p className="text-gray-900 font-medium mb-2">
                🚶 This session is reserved for walk-in customers only
              </p>
              <p className="text-sm text-gray-700">
                {walkInSessionType === 'first' 
                  ? 'Our earliest morning session is available exclusively for walk-in guests.'
                  : 'Our final session of the day is available exclusively for walk-in guests.'
                }
              </p>
            </div>
            
            {walkInSessionType === 'last' && (
              <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                <p className="text-amber-900 font-medium mb-2">
                  ⏰ Last Order Time
                </p>
                <p className="text-sm text-amber-800">
                  Please note that the last order is at <strong>4:30 PM (16:30)</strong>. Orders placed after this time may not be accepted.
                </p>
              </div>
            )}
            
            {walkInSessionType === 'first' && (
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-blue-900 font-medium mb-2">
                  ☕ Breakfast Menu Only
                </p>
                <p className="text-sm text-blue-800">
                  {getBreakfastMenuText()}
                </p>
              </div>
            )}
          </DialogDescription>
          <DialogFooter>
            <Button 
              onClick={() => setShowWalkInDialog(false)}
              className="w-full bg-gray-600 hover:bg-gray-700"
            >
              Choose Different Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Waitlist Dialog */}
      <JoinWaitlistDialog
        open={showWaitlistDialog}
        onOpenChange={setShowWaitlistDialog}
        selectedDate={selectedDate}
        selectedTimeSlot={waitlistTimeSlot}
      />
    </>
  );
}