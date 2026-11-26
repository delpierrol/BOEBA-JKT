import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import WhatsAppSettingsTab from "./WhatsAppSettingsTab";

export default function SettingsDialog({ open, onOpenChange, onSave, settings }) {
  const DEFAULT_TIME_SESSIONS = ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
  
  const [activeTab, setActiveTab] = useState("capacity");
  const [capacity, setCapacity] = useState(50);
  const [timeSessions, setTimeSessions] = useState(DEFAULT_TIME_SESSIONS);
  const [newSession, setNewSession] = useState("");
  const [fridayPrayerClosure, setFridayPrayerClosure] = useState(false);
  const [sundayReservedSlots, setSundayReservedSlots] = useState(0);
  const [reservationValidMinutes, setReservationValidMinutes] = useState(30);
  const [halalCode, setHalalCode] = useState("");
  const [customSessions, setCustomSessions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings && settings.length > 0) {
      const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
      if (capacitySetting) {
        setCapacity(parseInt(capacitySetting.setting_value) || 50);
      }

      const sessionsSetting = settings.find(s => s.setting_key === 'time_sessions');
      if (sessionsSetting && sessionsSetting.setting_value) {
        try {
          const parsed = JSON.parse(sessionsSetting.setting_value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Convert old format to new format if needed
            const converted = parsed.map((s, idx) => {
              if (typeof s === 'string') {
                return { 
                  time: s, 
                  walkInOnly: idx === 0 || idx === parsed.length - 1 
                };
              }
              return s;
            });
            setTimeSessions(converted);
          } else {
            setTimeSessions(DEFAULT_TIME_SESSIONS.map((t, idx) => ({ 
              time: t, 
              walkInOnly: idx === 0 || idx === DEFAULT_TIME_SESSIONS.length - 1 
            })));
          }
        } catch (e) {
          console.error("Error parsing time sessions:", e);
          setTimeSessions(DEFAULT_TIME_SESSIONS.map((t, idx) => ({ 
            time: t, 
            walkInOnly: idx === 0 || idx === DEFAULT_TIME_SESSIONS.length - 1 
          })));
        }
      } else {
        setTimeSessions(DEFAULT_TIME_SESSIONS.map((t, idx) => ({ 
          time: t, 
          walkInOnly: idx === 0 || idx === DEFAULT_TIME_SESSIONS.length - 1 
        })));
      }

      const prayerSetting = settings.find(s => s.setting_key === 'friday_prayer_closure');
      if (prayerSetting) {
        setFridayPrayerClosure(prayerSetting.setting_value === 'true' || prayerSetting.setting_value === true);
      } else {
        setFridayPrayerClosure(false);
      }

      const sundayReservedSetting = settings.find(s => s.setting_key === 'sunday_morning_reserved');
      if (sundayReservedSetting) {
        setSundayReservedSlots(parseInt(sundayReservedSetting.setting_value) || 0);
      } else {
        setSundayReservedSlots(0);
      }

      const validMinutesSetting = settings.find(s => s.setting_key === 'reservation_valid_minutes');
      if (validMinutesSetting) {
        setReservationValidMinutes(parseInt(validMinutesSetting.setting_value) || 30);
      } else {
        setReservationValidMinutes(30);
      }

      const halalSetting = settings.find(s => s.setting_key === 'halal_code');
      if (halalSetting) {
        setHalalCode(halalSetting.setting_value || "");
      } else {
        setHalalCode("");
      }

      const customSessionsSetting = settings.find(s => s.setting_key === 'custom_time_sessions');
      if (customSessionsSetting) {
        try {
          const parsed = JSON.parse(customSessionsSetting.setting_value);
          setCustomSessions(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          console.error("Error parsing custom sessions:", e);
          setCustomSessions([]);
        }
      } else {
        setCustomSessions([]);
      }
    } else {
      // Reset to defaults if no settings
      setCapacity(50);
      setTimeSessions(DEFAULT_TIME_SESSIONS.map((t, idx) => ({ 
        time: t, 
        walkInOnly: idx === 0 || idx === DEFAULT_TIME_SESSIONS.length - 1 
      })));
      setFridayPrayerClosure(false);
      setSundayReservedSlots(0);
      setReservationValidMinutes(30);
      setHalalCode("");
      setCustomSessions([]);
    }
  }, [settings, open]);

  const addTimeSession = () => {
    if (newSession && !timeSessions.find(s => s.time === newSession)) {
      const isFirst = timeSessions.length === 0;
      const isLast = true; // New session is always the last until another is added
      
      setTimeSessions([...timeSessions, { 
        time: newSession, 
        walkInOnly: isFirst || isLast 
      }]);
      setNewSession("");
    }
  };

  const removeTimeSession = (index) => {
    const updated = timeSessions.filter((_, i) => i !== index);
    // Update walkInOnly for first and last after removal
    if (updated.length > 0) {
      updated[0] = { ...updated[0], walkInOnly: true }; // First is always walk-in
      updated[updated.length - 1] = { ...updated[updated.length - 1], walkInOnly: true }; // Last is always walk-in
    }
    setTimeSessions(updated);
  };

  const toggleWalkInOnly = (index) => {
    const updated = [...timeSessions];
    updated[index] = { ...updated[index], walkInOnly: !updated[index].walkInOnly };
    setTimeSessions(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        default_capacity: capacity,
        time_sessions: timeSessions,
        friday_prayer_closure: fridayPrayerClosure,
        sunday_morning_reserved: sundayReservedSlots,
        reservation_valid_minutes: reservationValidMinutes,
        halal_code: halalCode,
        custom_time_sessions: customSessions
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const addCustomSession = () => {
    setCustomSessions([...customSessions, {
      name: "",
      start_date: "",
      end_date: "",
      sessions: []
    }]);
  };

  const updateCustomSession = (index, field, value) => {
    const updated = [...customSessions];
    updated[index] = { ...updated[index], [field]: value };
    setCustomSessions(updated);
  };

  const removeCustomSession = (index) => {
    setCustomSessions(customSessions.filter((_, i) => i !== index));
  };

  const addSessionToCustomPeriod = (periodIndex, session) => {
    const updated = [...customSessions];
    const sessions = updated[periodIndex].sessions || [];
    
    if (!sessions.find(s => (typeof s === 'string' ? s : s.time) === session)) {
      const isFirst = sessions.length === 0;
      const newSession = { time: session, walkInOnly: isFirst || true };
      updated[periodIndex].sessions = [...sessions, newSession];
      
      // Update walkInOnly for existing sessions
      if (updated[periodIndex].sessions.length > 0) {
        updated[periodIndex].sessions[0] = { ...updated[periodIndex].sessions[0], walkInOnly: true };
        const lastIndex = updated[periodIndex].sessions.length - 1;
        updated[periodIndex].sessions[lastIndex] = { ...updated[periodIndex].sessions[lastIndex], walkInOnly: true };
      }
      
      setCustomSessions(updated);
    }
  };

  const removeSessionFromCustomPeriod = (periodIndex, sessionIndex) => {
    const updated = [...customSessions];
    updated[periodIndex].sessions = updated[periodIndex].sessions.filter((_, i) => i !== sessionIndex);
    
    // Update walkInOnly for first and last after removal
    if (updated[periodIndex].sessions.length > 0) {
      // Convert to object format if string
      const firstSession = updated[periodIndex].sessions[0];
      updated[periodIndex].sessions[0] = typeof firstSession === 'string' 
        ? { time: firstSession, walkInOnly: true }
        : { ...firstSession, walkInOnly: true };
      
      const lastIndex = updated[periodIndex].sessions.length - 1;
      const lastSession = updated[periodIndex].sessions[lastIndex];
      updated[periodIndex].sessions[lastIndex] = typeof lastSession === 'string'
        ? { time: lastSession, walkInOnly: true }
        : { ...lastSession, walkInOnly: true };
    }
    
    setCustomSessions(updated);
  };

  const toggleCustomPeriodWalkInOnly = (periodIndex, sessionIndex) => {
    const updated = [...customSessions];
    const session = updated[periodIndex].sessions[sessionIndex];
    
    // Convert string to object if needed
    if (typeof session === 'string') {
      updated[periodIndex].sessions[sessionIndex] = { 
        time: session, 
        walkInOnly: true 
      };
    } else {
      updated[periodIndex].sessions[sessionIndex] = { 
        ...session, 
        walkInOnly: !session.walkInOnly 
      };
    }
    
    setCustomSessions(updated);
  };

  // Ensure timeSessions is always an array before rendering
  const safeTimeSessions = Array.isArray(timeSessions) ? timeSessions : DEFAULT_TIME_SESSIONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restaurant Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
            <TabsTrigger value="sessions">Time Sessions</TabsTrigger>
            <TabsTrigger value="custom-sessions">Custom Periods</TabsTrigger>
            <TabsTrigger value="rules">Booking Rules</TabsTrigger>
            <TabsTrigger value="certification">Certification</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="capacity" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Maximum Seats Per Time Session</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                className="text-lg"
              />
              <p className="text-xs text-gray-500">
                This is the maximum number of people that can book each time session
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Total daily capacity = Seats per session × Number of time sessions
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Example: {capacity} seats × {safeTimeSessions.length} sessions = {capacity * safeTimeSessions.length} total daily capacity
              </p>
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Time Sessions</Label>
              <div className="space-y-2">
                {safeTimeSessions.map((session, index) => {
                  const sessionTime = typeof session === 'string' ? session : session.time;
                  const walkInOnly = typeof session === 'string' ? false : session.walkInOnly;
                  
                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                      <span className="font-semibold text-sm flex-1">{sessionTime}</span>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`walkin-${index}`}
                          checked={walkInOnly}
                          onCheckedChange={() => toggleWalkInOnly(index)}
                        />
                        <Label htmlFor={`walkin-${index}`} className="text-xs cursor-pointer">
                          Walk-in Only
                        </Label>
                      </div>
                      <button
                        onClick={() => removeTimeSession(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-session">Add New Session</Label>
              <div className="flex gap-2">
                <Input
                  id="new-session"
                  placeholder="e.g., 10:00 AM"
                  value={newSession}
                  onChange={(e) => setNewSession(e.target.value)}
                />
                <Button onClick={addTimeSession} type="button">
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Add time slots in order. Format: "11:00 AM" or "6:00 PM"
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-900 mb-1">
                <strong>Walk-in Only Sessions:</strong>
              </p>
              <p className="text-xs text-amber-800">
                Sessions marked as "Walk-in Only" won't be available for online booking. By default, the first and last sessions are walk-in only, but you can customize this for each session.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="custom-sessions" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Custom Time Sessions by Period</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Set different time sessions for specific date ranges (e.g., Ramadan hours)
                  </p>
                </div>
                <Button onClick={addCustomSession} type="button" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Period
                </Button>
              </div>

              {customSessions.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-lg">
                  <p className="text-gray-500 mb-2">No custom periods configured</p>
                  <p className="text-xs text-gray-400">Click "Add Period" to create time sessions for specific date ranges</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customSessions.map((period, periodIndex) => (
                    <div key={periodIndex} className="border-2 rounded-lg p-4 space-y-3 bg-teal-50/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-teal-900">Period {periodIndex + 1}</Label>
                        <button
                          onClick={() => removeCustomSession(periodIndex)}
                          className="text-red-500 hover:text-red-700"
                          type="button"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`period-name-${periodIndex}`} className="text-sm">Period Name</Label>
                        <Input
                          id={`period-name-${periodIndex}`}
                          placeholder="e.g., Ramadan 2026"
                          value={period.name}
                          onChange={(e) => updateCustomSession(periodIndex, 'name', e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`start-date-${periodIndex}`} className="text-sm">Start Date</Label>
                          <Input
                            id={`start-date-${periodIndex}`}
                            type="date"
                            value={period.start_date}
                            onChange={(e) => updateCustomSession(periodIndex, 'start_date', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`end-date-${periodIndex}`} className="text-sm">End Date</Label>
                          <Input
                            id={`end-date-${periodIndex}`}
                            type="date"
                            value={period.end_date}
                            onChange={(e) => updateCustomSession(periodIndex, 'end_date', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Time Sessions for This Period</Label>
                        <div className="space-y-2 mb-2">
                          {period.sessions && period.sessions.length > 0 ? (
                            period.sessions.map((session, sessionIndex) => {
                              const sessionTime = typeof session === 'string' ? session : session.time;
                              const walkInOnly = typeof session === 'string' ? false : session.walkInOnly;
                              
                              return (
                                <div key={sessionIndex} className="flex items-center gap-3 p-2 border rounded bg-white">
                                  <span className="font-medium text-xs flex-1">{sessionTime}</span>
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      id={`custom-walkin-${periodIndex}-${sessionIndex}`}
                                      checked={walkInOnly}
                                      onCheckedChange={() => toggleCustomPeriodWalkInOnly(periodIndex, sessionIndex)}
                                    />
                                    <Label htmlFor={`custom-walkin-${periodIndex}-${sessionIndex}`} className="text-xs cursor-pointer">
                                      Walk-in
                                    </Label>
                                  </div>
                                  <button
                                    onClick={() => removeSessionFromCustomPeriod(periodIndex, sessionIndex)}
                                    className="text-red-500 hover:text-red-700"
                                    type="button"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-gray-500 italic">No sessions added yet</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id={`new-session-${periodIndex}`}
                            placeholder="e.g., 5:30 PM or 17:30"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = e.target.value.trim();
                                if (value) {
                                  addSessionToCustomPeriod(periodIndex, value);
                                  e.target.value = '';
                                }
                              }
                            }}
                          />
                          <Button 
                            onClick={() => {
                              const input = document.getElementById(`new-session-${periodIndex}`);
                              const value = input.value.trim();
                              if (value) {
                                addSessionToCustomPeriod(periodIndex, value);
                                input.value = '';
                              }
                            }} 
                            type="button"
                            size="sm"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {period.start_date && period.end_date && period.sessions.length > 0 && (
                        <div className="p-3 bg-teal-100 rounded border border-teal-300">
                          <p className="text-xs text-teal-900">
                            <strong>Preview:</strong> From {period.start_date} to {period.end_date}, 
                            these {period.sessions.length} time session(s) will be used instead of regular sessions.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 mb-2">
                  <strong>How it works:</strong>
                </p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4">
                  <li>• Custom periods override regular time sessions for specific date ranges</li>
                  <li>• Perfect for special occasions like Ramadan, holidays, or seasonal hours</li>
                  <li>• If a booking date falls within a custom period, only those sessions will be available</li>
                  <li>• Dates outside custom periods will use regular time sessions</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <Label htmlFor="valid-minutes" className="text-base font-semibold">
                    Reservation Valid Duration
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    How many minutes customers have to arrive after their booking time
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    id="valid-minutes"
                    type="number"
                    min="5"
                    max="60"
                    value={reservationValidMinutes}
                    onChange={(e) => setReservationValidMinutes(parseInt(e.target.value) || 15)}
                    className="text-lg"
                  />
                  <p className="text-xs text-gray-500">
                    Recommended: 15-30 minutes. This will be shown to customers on booking confirmation.
                  </p>
                </div>
                <div className="p-3 bg-teal-50 rounded border border-teal-200">
                  <p className="text-xs text-teal-800">
                    <strong>Example:</strong> If set to {reservationValidMinutes} minutes and customer books for 6:00 PM, they have until {reservationValidMinutes === 15 ? '6:15 PM' : reservationValidMinutes === 30 ? '6:30 PM' : `6:${reservationValidMinutes} PM`} to arrive.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <Checkbox
                  id="friday-prayer"
                  checked={fridayPrayerClosure}
                  onCheckedChange={setFridayPrayerClosure}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="friday-prayer" className="text-base font-semibold cursor-pointer">
                    Friday Prayer Closure
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Close sessions from 11:00 AM - 12:00 PM every Friday for Friday prayer
                  </p>
                  <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                    <p className="text-xs text-amber-800">
                      <strong>Affected sessions:</strong> Only the session starting at 11:00 will be unavailable on Fridays. Sessions starting at 12:00 PM and later remain available.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <Label htmlFor="sunday-reserved" className="text-base font-semibold">
                    Sunday Morning Reserved Slots
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Reserve slots for walk-ins on Sunday mornings (08:00 - 11:00)
                  </p>
                </div>
                <div className="space-y-2">
                  <Input
                    id="sunday-reserved"
                    type="number"
                    min="0"
                    max={capacity}
                    value={sundayReservedSlots}
                    onChange={(e) => setSundayReservedSlots(parseInt(e.target.value) || 0)}
                    className="text-lg"
                  />
                  <p className="text-xs text-gray-500">
                    Number of seats to reserve (not available for online booking)
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded border border-purple-200">
                  <p className="text-xs text-purple-800">
                    <strong>Example:</strong> If capacity is {capacity} and reserved is {sundayReservedSlots}, only {capacity - sundayReservedSlots} seats will be available for online booking on Sunday mornings.
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    <strong>Affected sessions:</strong> Sessions starting between 08:00 - 11:00 on Sundays
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> When enabled, customers will see reduced availability for these sessions.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="certification" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <Label htmlFor="halal-code" className="text-base font-semibold">
                    Halal Certification Number
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Enter your Indonesian Halal certification number (MUI)
                  </p>
                </div>
                <Input
                  id="halal-code"
                  type="text"
                  placeholder="e.g., 00150074591010"
                  value={halalCode}
                  onChange={(e) => setHalalCode(e.target.value)}
                  className="text-lg"
                />
                <p className="text-xs text-gray-500">
                  Leave empty to hide halal certification from customers
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-2">
                    <img 
                      src="/halal-logo.svg" 
                      alt="Halal MUI" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      MUI Halal Certification
                    </p>
                    <p className="text-xs text-green-800">
                      When enabled, the Halal MUI logo and your certification number will be displayed on:
                    </p>
                    <ul className="text-xs text-green-700 mt-2 space-y-1 ml-4">
                      <li>• WhatsApp confirmation messages</li>
                      <li>• Home page footer</li>
                    </ul>
                  </div>
                </div>
              </div>

              {halalCode && (
                <div className="p-4 bg-white rounded-lg border-2 border-green-300">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Preview:</p>
                  <div className="flex items-center gap-3">
                    <img 
                      src="/halal-logo.svg" 
                      alt="Halal" 
                      className="w-12 h-12"
                    />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Halal Certified</p>
                      <p className="text-xs text-gray-600">MUI: {halalCode}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppSettingsTab active={open && activeTab === "whatsapp"} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}