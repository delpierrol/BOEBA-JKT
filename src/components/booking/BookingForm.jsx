import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Calendar, Clock, User, Users, ArrowLeft, Mail, MessageCircle, Loader2, Shield, AlertCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function BookingForm({ selectedDate, selectedTimeSlot, onSubmit, onBack, isSubmitting, initialData }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    whatsapp: initialData?.whatsapp || "",
    partySize: initialData?.partySize || 2
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [recaptchaError, setRecaptchaError] = useState(null);
  const [isLoadingRecaptcha, setIsLoadingRecaptcha] = useState(true);
  const [partySizeError, setPartySizeError] = useState(null);
  const recaptchaRef = useRef(null);
  const widgetId = useRef(null);
  const scriptLoaded = useRef(false);
  const attemptCount = useRef(0);
  const maxAttempts = 3;

  // Fetch settings to get time sessions
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });

  // Fetch bookings to check capacity
  const { data: bookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list(),
  });

  // Fetch session capacities
  const { data: sessionCapacities = [] } = useQuery({
    queryKey: ['sessionCapacities'],
    queryFn: () => base44.entities.SessionCapacity.list(),
  });

  // Fetch date capacities
  const { data: capacities = [] } = useQuery({
    queryKey: ['capacities'],
    queryFn: () => base44.entities.DateCapacity.list(),
  });

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

  const getTimeRange = () => {
    const timeSessions = getTimeSessions();
    const currentIndex = timeSessions.indexOf(selectedTimeSlot);
    
    if (currentIndex !== -1 && currentIndex < timeSessions.length - 1) {
      const nextSession = timeSessions[currentIndex + 1];
      return `${selectedTimeSlot} - ${nextSession}`;
    }
    
    return selectedTimeSlot;
  };

  const getDefaultCapacity = () => {
    const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
    return capacitySetting ? parseInt(capacitySetting.setting_value) : 50;
  };

  const getCapacityForSession = (dateStr, timeSlot) => {
    // Extract start time from range (e.g., "11:00 AM - 12:00 PM" -> "11:00 AM")
    const startTime = timeSlot.split('-')[0].trim();
    
    const sessionCap = sessionCapacities.find(
      sc => sc.date === dateStr && sc.time_slot === startTime
    );
    
    if (sessionCap) {
      return sessionCap.capacity;
    }
    
    const capacity = capacities.find(c => c.date === dateStr);
    return capacity?.total_capacity || getDefaultCapacity();
  };

  const getBookingsForSlot = (dateStr, timeSlot) => {
    // Extract start time from range
    const startTime = timeSlot.split('-')[0].trim();
    
    return bookings.filter(b => {
      if (b.booking_date !== dateStr || b.status !== 'confirmed') return false;
      
      const bookingStartTime = b.time_slot.split('-')[0].trim();
      
      const normalizeTime = (time) => {
        return time.replace(/\s+/g, '').toLowerCase().replace('am', '').replace('pm', '');
      };
      
      return normalizeTime(bookingStartTime) === normalizeTime(startTime) ||
             bookingStartTime === startTime;
    }).reduce((sum, b) => sum + (b.party_size || 0), 0);
  };

  const checkCapacityAvailable = (partySize) => {
    const bookedGuests = getBookingsForSlot(selectedDate, selectedTimeSlot);
    const totalCapacity = getCapacityForSession(selectedDate, selectedTimeSlot);
    const availableCapacity = totalCapacity - bookedGuests;
    
    return {
      available: partySize <= availableCapacity,
      availableCapacity,
      totalCapacity,
      bookedGuests
    };
  };

  // Clean up old scripts
  const cleanupOldScripts = () => {
    const existingScripts = document.querySelectorAll('script[src*="recaptcha"]');
    existingScripts.forEach(script => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    });
  };

  // Load reCAPTCHA script
  useEffect(() => {
    // Check if script already loaded
    if (scriptLoaded.current) {
      return;
    }

    const loadRecaptcha = () => {
      // Clean up any existing reCAPTCHA scripts first
      cleanupOldScripts();
      
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?hl=en&onload=onRecaptchaLoad';
      script.async = true;
      script.defer = true;
      
      // Global callback for when reCAPTCHA is ready
      window.onRecaptchaLoad = () => {
        scriptLoaded.current = true;
        setIsLoadingRecaptcha(false);
      };
      
      script.onload = () => {
        // Fallback if callback doesn't fire
        setTimeout(() => {
          if (window.grecaptcha && window.grecaptcha.render) {
            scriptLoaded.current = true;
            setIsLoadingRecaptcha(false);
          }
        }, 1000);
      };
      
      script.onerror = () => {
        attemptCount.current += 1;
        if (attemptCount.current < maxAttempts) {
          // Retry loading
          setTimeout(() => {
            loadRecaptcha();
          }, 2000);
        } else {
          setRecaptchaError('Failed to load reCAPTCHA after multiple attempts. Please refresh the page.');
          setIsLoadingRecaptcha(false);
        }
      };
      
      document.body.appendChild(script);
      
      // Timeout after 15 seconds
      setTimeout(() => {
        if (isLoadingRecaptcha && !scriptLoaded.current) {
          setRecaptchaError('reCAPTCHA is taking longer than expected. Try refreshing the page.');
          setIsLoadingRecaptcha(false);
        }
      }, 15000);
    };

    loadRecaptcha();

    return () => {
      // Cleanup on unmount
      if (window.onRecaptchaLoad) {
        delete window.onRecaptchaLoad;
      }
    };
  }, []);

  // Render reCAPTCHA widget when ready
  useEffect(() => {
    if (!isLoadingRecaptcha && window.grecaptcha && window.grecaptcha.render && recaptchaRef.current && widgetId.current === null) {
      try {
        // Double-check that render function exists
        if (typeof window.grecaptcha.render !== 'function') {
          throw new Error('grecaptcha.render is not a function');
        }

        widgetId.current = window.grecaptcha.render(recaptchaRef.current, {
          sitekey: import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Lf3UTMuAAAAADJhHWkypFVFySy2x8Spwbyy3cW8',
          callback: (token) => {
            setRecaptchaToken(token);
            setRecaptchaError(null);
          },
          'expired-callback': () => {
            setRecaptchaToken(null);
            setRecaptchaError('reCAPTCHA expired. Please verify again.');
            // Try to reset
            if (window.grecaptcha && widgetId.current !== null) {
              try {
                window.grecaptcha.reset(widgetId.current);
              } catch (e) {
                console.error('Failed to reset reCAPTCHA:', e);
              }
            }
          },
          'error-callback': () => {
            setRecaptchaError('reCAPTCHA error. Please try again.');
          }
        });
      } catch (error) {
        console.error('Error rendering reCAPTCHA:', error);
        setRecaptchaError('Failed to initialize reCAPTCHA. Try refreshing the page.');
      }
    }
  }, [isLoadingRecaptcha]);

  const handleRetryRecaptcha = () => {
    setRecaptchaError(null);
    setIsLoadingRecaptcha(true);
    scriptLoaded.current = false;
    attemptCount.current = 0;
    widgetId.current = null;
    
    // Force reload
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (hasSubmitted) return;

    // Refetch latest bookings to ensure we have current data
    await refetchBookings();

    // Check capacity with latest data
    const capacityCheck = checkCapacityAvailable(formData.partySize);
    if (!capacityCheck.available) {
      setPartySizeError(
        capacityCheck.availableCapacity > 0
          ? `Sorry, only ${capacityCheck.availableCapacity} spot(s) remaining for this session (${capacityCheck.bookedGuests}/${capacityCheck.totalCapacity} already booked). Please reduce the number of guests or choose a different time.`
          : `This session is now fully booked (${capacityCheck.bookedGuests}/${capacityCheck.totalCapacity}). Please choose a different time slot.`
      );
      return;
    }

    // Check reCAPTCHA
    if (!recaptchaToken) {
      setRecaptchaError('Please complete the reCAPTCHA verification');
      return;
    }

    setHasSubmitted(true);
    await onSubmit({ ...formData, recaptchaToken });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePartySizeChange = (e) => {
    const value = parseInt(e.target.value);
    
    if (value > 6) {
      setPartySizeError('For groups larger than 6 guests, please contact us directly via WhatsApp to arrange your booking.');
      handleChange('partySize', 6);
    } else if (value < 1) {
      setPartySizeError('Please enter at least 1 guest.');
      handleChange('partySize', 1);
    } else {
      setPartySizeError(null);
      handleChange('partySize', value);
    }
  };

  const handlePartySizeBlur = () => {
    if (formData.partySize < 1 || formData.partySize > 6) return;
    
    const capacityCheck = checkCapacityAvailable(formData.partySize);
    
    if (!capacityCheck.available) {
      setPartySizeError(
        capacityCheck.availableCapacity > 0
          ? `Sorry, only ${capacityCheck.availableCapacity} spot(s) remaining for this session (${capacityCheck.bookedGuests}/${capacityCheck.totalCapacity} already booked).`
          : `This session is fully booked (${capacityCheck.bookedGuests}/${capacityCheck.totalCapacity}).`
      );
    } else {
      setPartySizeError(null); // Clear error if capacity is now fine
    }
  };

  const isButtonDisabled = hasSubmitted || isSubmitting || !recaptchaToken;

  return (
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
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-6 h-6 text-teal-600" />
                Your Details
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border-2 border-teal-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                <div>
                  <p className="text-xs text-gray-600">Date</p>
                  <p className="font-semibold text-gray-900">
                    {format(new Date(selectedDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600" />
                <div>
                  <p className="text-xs text-gray-600">Session</p>
                  <p className="font-semibold text-gray-900">{getTimeRange()}</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-teal-600" />
                Full Name *
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="text-lg h-12"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-2 text-base">
                <MessageCircle className="w-4 h-4 text-green-600" />
                WhatsApp Number *
              </Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="0811xxxxxx"
                value={formData.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                required
                className="text-lg h-12"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                We'll send your booking confirmation via WhatsApp
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-base">
                <Mail className="w-4 h-4 text-blue-600" />
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="text-lg h-12"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                You will receive updates & promotions via email
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partySize" className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-purple-600" />
                Number of Guests *
              </Label>
              <Input
                id="partySize"
                type="number"
                min="1"
                max="6"
                value={formData.partySize}
                onChange={handlePartySizeChange}
                onBlur={handlePartySizeBlur}
                required
                className="text-lg h-12"
                disabled={isSubmitting}
              />
              
              {partySizeError && (
                <Alert className="bg-amber-50 border-amber-300">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                  <AlertDescription className="text-amber-800 text-sm">
                    {partySizeError}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Maximum 6 guests per booking
                </p>
                <a
                  href="https://wa.me/628111083547?text=Hello,%20I%20would%20like%20to%20make%20a%20reservation%20for%20more%20than%206%20guests"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
                >
                  <MessageCircle className="w-3 h-3" />
                  Contact for larger group
                </a>
              </div>
            </div>

            {/* reCAPTCHA Section */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              
              {isLoadingRecaptcha ? (
                <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600 mr-2" />
                  <span className="text-gray-600">Loading verification...</span>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div ref={recaptchaRef}></div>
                </div>
              )}

              {recaptchaError && (
                <Alert variant="destructive" className="bg-amber-50 border-amber-300">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                  <AlertDescription className="text-amber-800">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{recaptchaError}</p>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={handleRetryRecaptcha}
                        className="mt-2"
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Refresh Page
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base border-2 border-teal-200 hover:bg-teal-50"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isButtonDisabled}
                className="flex-1 h-12 text-base bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}