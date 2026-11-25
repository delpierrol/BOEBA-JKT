import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, CheckCircle, Search } from "lucide-react";
import BookingCalendar from "../components/booking/BookingCalendar";
import TimeSlotSelector from "../components/booking/TimeSlotSelector";
import BookingForm from "../components/booking/BookingForm";
import { createPageUrl } from "@/utils";

export default function Reschedule() {
  const [bookingCode, setBookingCode] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [originalBooking, setOriginalBooking] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [step, setStep] = useState(-1); // -1: search form, 0: loading, 1: date, 2: time, 3: form, 4: success
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setBookingCode(code);
      setStep(0);
    }
  }, []);

  const { data: booking, isLoading: isLoadingBooking } = useQuery({
    queryKey: ['booking', bookingCode],
    queryFn: async () => {
      const bookings = await base44.entities.Booking.filter({ booking_code: bookingCode });
      if (bookings.length === 0) {
        throw new Error("Booking not found");
      }
      return bookings[0];
    },
    enabled: !!bookingCode && step >= 0,
    retry: false,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list(),
    enabled: !!booking,
  });

  const { data: capacities = [] } = useQuery({
    queryKey: ['capacities'],
    queryFn: () => base44.entities.DateCapacity.list(),
    enabled: !!booking,
  });

  useEffect(() => {
    if (booking) {
      setOriginalBooking(booking);
      if (booking.status === 'cancelled') {
        setError("This booking has been cancelled and cannot be rescheduled");
        setStep(-1);
      } else {
        setStep(1);
      }
    }
  }, [booking]);

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      setStep(4);
    },
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    enabled: !!booking,
  });

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

  const getReservationValidMinutes = () => {
    const validMinutesSetting = settings.find(s => s.setting_key === 'reservation_valid_minutes');
    return validMinutesSetting ? parseInt(validMinutesSetting.setting_value) : 30;
  };

  const getNextSession = (currentTimeSlot) => {
    const timeSessions = getTimeSessions();
    const currentIndex = timeSessions.indexOf(currentTimeSlot);
    if (currentIndex !== -1 && currentIndex < timeSessions.length - 1) {
      return timeSessions[currentIndex + 1];
    }
    return null;
  };

  const sendWhatsAppUpdate = async (booking) => {
    try {
      // Safety check for valid date
      if (!booking.booking_date) {
        console.error("Invalid booking date, cannot send WhatsApp update.");
        return;
      }

      const bookingDate = new Date(booking.booking_date);
      if (isNaN(bookingDate.getTime())) {
        console.error("Invalid booking date format:", booking.booking_date);
        return;
      }

      const bookingDetailsUrl = `${window.location.origin}/BookingDetails?code=${booking.booking_code}`;
      const modifyUrl = `${window.location.origin}${createPageUrl('ModifyBooking')}?code=${booking.booking_code}`;
      
      // Get time sessions and calculate range
      const timeSessions = getTimeSessions();
      const currentIndex = timeSessions.indexOf(booking.time_slot);
      const nextSession = currentIndex !== -1 && currentIndex < timeSessions.length - 1 
        ? timeSessions[currentIndex + 1] 
        : null;
      
      // Create time range display
      const timeRange = nextSession 
        ? `${booking.time_slot} - ${nextSession}` 
        : booking.time_slot;
      
      const validMinutes = getReservationValidMinutes();
      
      // Get halal code from settings
      const halalSetting = settings.find(s => s.setting_key === 'halal_code');
      const halalCode = halalSetting?.setting_value || null;
      
      const message = `*Boeba Restaurant - Booking Updated!* 

Dear ${booking.customer_name},

Your reservation has been rescheduled! ✅

📋 *Updated Booking Details:*
━━━━━━━━━━━━━━━━━━━━━━
🔖 Booking Code: *${booking.booking_code}*
📅 New Date: ${format(bookingDate, 'EEEE, MMMM d, yyyy')}
🕐 New Session: *${timeRange}*
👥 Number of People: ${booking.party_size} guests
━━━━━━━━━━━━━━━━━━━━━━

⏰ *Important Reminders:*
• Your reservation is valid for *${validMinutes} minutes* from your booking time
• Please arrive on time. If you arrive *more than 30 minutes late* from your reservation time, your table may be given to walk-in guests and you will need to join the waiting list.
• Show your QR code or booking code at check-in: ${bookingDetailsUrl}​

🔄 *Need to Modify Your Booking?*
Click here: ${modifyUrl}​

*Location & Directions:*
Jl. Prapanca Raya No.6A, Pulo, Kec. Kby. Baru, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12160
https://maps.app.goo.gl/gvknDgPn3UYGFGE16​

We look forward to serving you the finest dining experience!

*Boeba Team*`;

      await base44.functions.invoke('sendWhatsAppMessage', {
        phoneNumber: booking.whatsapp_number,
        message: message
      });
    } catch (error) {
      console.error("Error sending WhatsApp update:", error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSearching(true);

    try {
      // Clean the input
      const cleanInput = searchInput.trim();
      
      // Try to find booking by code or phone number
      const allBookings = await base44.entities.Booking.list();
      const foundBooking = allBookings.find(b => 
        b.booking_code?.toLowerCase() === cleanInput.toLowerCase() ||
        b.whatsapp_number?.includes(cleanInput) ||
        b.customer_email?.toLowerCase() === cleanInput.toLowerCase()
      );

      if (foundBooking) {
        if (foundBooking.status === 'cancelled') {
          setError("This booking has been cancelled and cannot be rescheduled");
        } else {
          setBookingCode(foundBooking.booking_code);
          setOriginalBooking(foundBooking);
          setStep(0);
        }
      } else {
        setError("No booking found with this code, phone number, or email");
      }
    } catch (error) {
      setError("Error searching for booking. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
    setStep(2);
  };

  const handleTimeSlotSelect = (timeSlot) => {
    setSelectedTimeSlot(timeSlot);
    setStep(3);
  };

  const handleFormSubmit = async (formData) => {
    const updatedBooking = {
      customer_name: formData.name,
      customer_email: formData.email || null,
      whatsapp_number: formData.whatsapp.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '62'),
      booking_date: selectedDate,
      time_slot: selectedTimeSlot,
      party_size: formData.partySize,
    };

    await updateBookingMutation.mutateAsync({
      id: originalBooking.id,
      data: updatedBooking
    });

    await sendWhatsAppUpdate({ ...originalBooking, ...updatedBooking });
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedDate(null);
    } else if (step === 3) {
      setStep(2);
      setSelectedTimeSlot(null);
    }
  };

  const formatOriginalDate = () => {
    try {
      if (!originalBooking?.booking_date) return 'N/A';
      const date = new Date(originalBooking.booking_date);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'MMM d, yyyy');
    } catch (e) {
      console.error("Error formatting original booking date:", e);
      return 'Invalid Date';
    }
  };

  const formatSuccessDate = () => {
    try {
      if (!selectedDate) return 'N/A';
      const date = new Date(selectedDate);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch (e) {
      console.error("Error formatting success date:", e);
      return 'Invalid Date';
    }
  };

  // Search Form Step
  if (step === -1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex justify-center mb-4">
              <img 
                src="/logo.png" 
                alt="Boeba Restaurant" 
                className="w-24 h-24"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              Reschedule Your Booking
            </h1>
            <p className="text-lg text-gray-600">
              Enter your booking details to continue
            </p>
          </motion.div>

          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm shadow-xl border-teal-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="w-5 h-5 text-teal-600" />
                Find Your Booking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Booking Code, Phone Number, or Email</Label>
                  <Input
                    id="search"
                    type="text"
                    placeholder="e.g., BK12345678 or 628111083547"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    required
                    className="text-lg"
                  />
                  <p className="text-xs text-gray-500">
                    Enter your booking code, WhatsApp number, or email address
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-lg py-6"
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Find Booking
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoadingBooking || step === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="Boeba Restaurant" 
              className="w-24 h-24"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            Reschedule Your Booking
          </h1>
          <p className="text-lg text-teal-700">
            Booking Code: {originalBooking?.booking_code}
          </p>
        </motion.div>

        {originalBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
              <CardHeader>
                <CardTitle className="text-lg">Current Booking Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-semibold">{originalBooking.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">WhatsApp:</span>
                    <span className="ml-2 font-semibold">{originalBooking.whatsapp_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Date:</span>
                    <span className="ml-2 font-semibold">
                      {formatOriginalDate()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Time:</span>
                    <span className="ml-2 font-semibold">{originalBooking.time_slot}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <BookingCalendar
              bookings={bookings}
              capacities={capacities}
              onDateSelect={handleDateSelect}
            />
          )}

          {step === 2 && (
            <TimeSlotSelector
              selectedDate={selectedDate}
              bookings={bookings}
              capacities={capacities}
              onTimeSlotSelect={handleTimeSlotSelect}
              onBack={handleBack}
            />
          )}

          {step === 3 && originalBooking && (
            <BookingForm
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              onSubmit={handleFormSubmit}
              onBack={handleBack}
              isSubmitting={updateBookingMutation.isPending}
              initialData={{
                name: originalBooking.customer_name,
                email: originalBooking.customer_email || "",
                whatsapp: originalBooking.whatsapp_number,
                partySize: originalBooking.party_size
              }}
            />
          )}

          {step === 4 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm shadow-2xl border-teal-200/50">
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="flex justify-center mb-4"
                  >
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                      <CheckCircle className="w-12 h-12 text-teal-600" />
                    </div>
                  </motion.div>
                  <h2 className="text-3xl font-bold text-center">Booking Rescheduled!</h2>
                  <p className="text-center text-teal-50 mt-2">Your reservation has been updated</p>
                </div>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-600 mb-6">
                    A WhatsApp confirmation has been sent to {originalBooking?.whatsapp_number}
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p><strong>New Date:</strong> {formatSuccessDate()}</p>
                    <p><strong>New Time:</strong> {selectedTimeSlot}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}