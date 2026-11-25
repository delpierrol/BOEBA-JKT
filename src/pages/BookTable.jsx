import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, isBefore, startOfDay, isSameDay, parse } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import BookingCalendar from "../components/booking/BookingCalendar";
import TimeSlotSelector from "../components/booking/TimeSlotSelector";
import BookingForm from "../components/booking/BookingForm";
import BookingConfirmation from "../components/booking/BookingConfirmation";

// Utility function to create page URLs
const createPageUrl = (pageName) => {
  return `/${pageName.toLowerCase()}`;
};

export default function BookTable() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [step, setStep] = useState(1);
  const [whatsappError, setWhatsappError] = useState(null);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const queryClient = useQueryClient();

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
      
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (e) {
      console.error("Error parsing time slot:", e);
      return null;
    }
  };

  const isSlotPassed = (slot, date) => {
    const selectedDateObj = new Date(date);
    const today = new Date();
    
    if (!isSameDay(selectedDateObj, today)) {
      return false;
    }

    const slotTime = parseTimeSlot(slot);
    if (!slotTime) {
      console.warn(`Could not parse time slot: ${slot}`);
      return false;
    }

    const now = new Date();
    const slotDateTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      slotTime.getHours(),
      slotTime.getMinutes(),
      slotTime.getSeconds()
    );

    return now > slotDateTime;
  };

  const isDatePassed = (date) => {
    const selectedDateObj = startOfDay(new Date(date));
    const today = startOfDay(new Date());
    return isBefore(selectedDateObj, today);
  };

  const validateDateAndTime = (date, timeSlot) => {
    if (!date) return { valid: false, reason: 'no_date' };
    
    if (isDatePassed(date)) {
      return { valid: false, reason: 'past_date' };
    }

    if (timeSlot && isSameDay(new Date(date), new Date())) {
      if (isSlotPassed(timeSlot, date)) {
        return { valid: false, reason: 'past_time' };
      }
    }

    return { valid: true };
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = urlParams.get('step');
    const urlDate = urlParams.get('date');
    const urlTime = urlParams.get('time');
    const urlCode = urlParams.get('code');
    
    if (urlCode) {
      fetchBookingByCode(urlCode);
    } else if (urlStep) {
      const stepNum = parseInt(urlStep);
      if (stepNum >= 1 && stepNum <= 3) {
        if (stepNum >= 2 && urlDate) {
          const decodedTime = urlTime ? decodeURIComponent(urlTime) : null;
          const validation = validateDateAndTime(urlDate, decodedTime);
          
          if (!validation.valid) {
            console.warn(`Invalid date/time in URL (${validation.reason}), redirecting to step 1.`);
            setStep(1);
            setSelectedDate(null);
            setSelectedTimeSlot(null);
            updateURL(1);
            return;
          }
        }

        setStep(stepNum);
        if (urlDate) setSelectedDate(urlDate);
        if (urlTime) setSelectedTimeSlot(decodeURIComponent(urlTime));
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = (event) => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlStep = urlParams.get('step');
      const urlDate = urlParams.get('date');
      const urlTime = urlParams.get('time');
      const urlCode = urlParams.get('code');
      
      if (urlCode) {
        fetchBookingByCode(urlCode);
      } else if (urlStep) {
        const stepNum = parseInt(urlStep);
        if (stepNum >= 1 && stepNum <= 3) {
          if (stepNum >= 2 && urlDate) {
            const decodedTime = urlTime ? decodeURIComponent(urlTime) : null;
            const validation = validateDateAndTime(urlDate, decodedTime);
            
            if (!validation.valid) {
              console.warn(`Invalid date/time in URL during navigation (${validation.reason}), redirecting to step 1.`);
              setStep(1);
              setSelectedDate(null);
              setSelectedTimeSlot(null);
              updateURL(1);
              return;
            }
          }

          setStep(stepNum);
          
          if (stepNum === 1) {
            setSelectedDate(null);
            setSelectedTimeSlot(null);
          } else if (stepNum === 2 && urlDate) {
            setSelectedDate(urlDate);
            setSelectedTimeSlot(null);
          } else if (stepNum === 3 && urlDate && urlTime) {
            setSelectedDate(urlDate);
            setSelectedTimeSlot(decodeURIComponent(urlTime));
          }
        }
      } else {
        setStep(1);
        setSelectedDate(null);
        setSelectedTimeSlot(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const fetchBookingByCode = async (code) => {
    try {
      const bookings = await base44.entities.Booking.list();
      const booking = bookings.find(b => b.booking_code === code);
      if (booking) {
        setBookingData(booking);
        setStep(4);
      }
    } catch (error) {
      console.error("Error fetching booking:", error);
    }
  };

  const updateURL = (newStep, date = null, time = null, code = null) => {
    const params = new URLSearchParams();
    
    if (code) {
      params.set('code', code);
    } else {
      params.set('step', newStep.toString());
      if (date) params.set('date', date);
      if (time) params.set('time', encodeURIComponent(time));
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ step: newStep, date, time, code }, '', newUrl);
  };

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list(),
  });

  const { data: capacities = [] } = useQuery({
    queryKey: ['capacities'],
    queryFn: () => base44.entities.DateCapacity.list(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });

  const { data: sessionCapacities = [] } = useQuery({
    queryKey: ['sessionCapacities'],
    queryFn: () => base44.entities.SessionCapacity.list(),
  });

  const createBookingMutation = useMutation({
    mutationFn: (data) => base44.entities.Booking.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bookings']);
      setBookingData(data);
    },
  });

  const formatWhatsAppNumber = (number) => {
    let formatted = number.replace(/[\s\-\(\)\+]/g, '');
    
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    
    return formatted;
  };

  const getTimeSessions = (date = null) => {
    const targetDate = date || selectedDate;
    
    // Check for custom sessions for the target date
    if (targetDate) {
      const customSessionsSetting = settings.find(s => s.setting_key === 'custom_time_sessions');
      if (customSessionsSetting) {
        try {
          const customPeriods = JSON.parse(customSessionsSetting.setting_value);
          if (Array.isArray(customPeriods)) {
            // Find matching custom period
            const matchingPeriod = customPeriods.find(period => 
              period.start_date && period.end_date &&
              targetDate >= period.start_date && targetDate <= period.end_date &&
              period.sessions && period.sessions.length > 0
            );
            
            if (matchingPeriod) {
              // Return array of strings (time only)
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

  const getReservationValidMinutes = () => {
    const validMinutesSetting = settings.find(s => s.setting_key === 'reservation_valid_minutes');
    return validMinutesSetting ? parseInt(validMinutesSetting.setting_value) : 30;
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

  const getNextSession = (currentTimeSlot) => {
    const timeSessions = getTimeSessions();
    const currentIndex = timeSessions.indexOf(currentTimeSlot);
    if (currentIndex !== -1 && currentIndex < timeSessions.length - 1) {
      return timeSessions[currentIndex + 1];
    }
    return null;
  };

  const sendEmailConfirmation = async (booking) => {
    if (!booking.customer_email) {
      setEmailSent(false);
      return false;
    }

    try {
      const bookingDetailsUrl = `${window.location.origin}${createPageUrl('BookingDetails')}?code=${booking.booking_code}`;
      const modifyUrl = `${window.location.origin}${createPageUrl('ModifyBooking')}?code=${booking.booking_code}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${booking.booking_code}`;
      
      const timeSessions = getTimeSessions();
      // Extract start time from booking.time_slot
      const bookingStartTime = booking.time_slot.split('-')[0].trim();
      const currentIndex = timeSessions.indexOf(bookingStartTime);
      const nextSession = currentIndex !== -1 && currentIndex < timeSessions.length - 1 
        ? timeSessions[currentIndex + 1] 
        : null;
      
      const timeRange = nextSession 
        ? `${bookingStartTime} - ${nextSession}` 
        : bookingStartTime;
      
      const validMinutes = getReservationValidMinutes();
      
      const halalSetting = settings.find(s => s.setting_key === 'halal_code');
      const halalCode = halalSetting?.setting_value || null;

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .booking-code {
      background: linear-gradient(135deg, #ccfbf1 0%, #cffafe 100%);
      padding: 20px;
      text-align: center;
      border-radius: 10px;
      margin: 20px 0;
      border: 2px solid #14b8a6;
    }
    .booking-code .code {
      font-size: 24px;
      font-weight: bold;
      color: #0f766e;
      letter-spacing: 2px;
    }
    .qr-code {
      text-align: center;
      margin: 20px 0;
      padding: 20px;
      background: #f9fafb;
      border-radius: 10px;
    }
    .qr-code img {
      max-width: 250px;
      border: 3px solid #14b8a6;
      border-radius: 10px;
      padding: 10px;
      background: white;
    }
    .details {
      background: #f9fafb;
      padding: 20px;
      border-radius: 10px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: bold;
      color: #0f766e;
      width: 150px;
    }
    .detail-value {
      color: #374151;
    }
    .reminder-box {
      background: #dbeafe;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .reminder-box h3 {
      color: #1e40af;
      margin-top: 0;
      font-size: 16px;
    }
    .reminder-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .reminder-box li {
      color: #1e3a8a;
      margin: 5px 0;
    }
    .location-box {
      background: linear-gradient(135deg, #ccfbf1 0%, #cffafe 100%);
      border-left: 4px solid #14b8a6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .location-box h3 {
      color: #0f766e;
      margin-top: 0;
      font-size: 16px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin: 10px 5px;
    }
    .button-outline {
      background: white;
      color: #14b8a6;
      border: 2px solid #14b8a6;
    }
    .buttons {
      text-align: center;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
      margin-top: 20px;
    }
    ${halalCode ? `
    .halal-badge {
      background: #dcfce7;
      border: 2px solid #86efac;
      padding: 15px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
    }
    .halal-badge img {
      width: 50px;
      height: 50px;
      vertical-align: middle;
      margin-right: 10px;
    }
    .halal-badge .text {
      display: inline-block;
      vertical-align: middle;
      text-align: left;
    }
    .halal-badge .title {
      font-weight: bold;
      color: #166534;
      font-size: 16px;
    }
    .halal-badge .code {
      color: #15803d;
      font-size: 14px;
    }
    ` : ''}
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="Boeba Restaurant">
    <h1>Booking Confirmed!</h1>
    <p style="margin: 10px 0 0 0;">Your table reservation at Boeba Restaurant</p>
  </div>
  
  <div class="content">
    <p>Dear <strong>${booking.customer_name}</strong>,</p>
    
    <p>Thank you for choosing Boeba Restaurant! Your reservation has been confirmed.</p>
    
    <div class="booking-code">
      <div style="font-size: 14px; color: #0f766e; margin-bottom: 5px;">Your Booking Code</div>
      <div class="code">${booking.booking_code}</div>
    </div>
    
    <div class="qr-code">
      <p style="margin-top: 0; color: #6b7280;">Show this QR code at check-in:</p>
      <img src="${qrCodeUrl}" alt="Booking QR Code">
    </div>
    
    <div class="details">
      <h3 style="margin-top: 0; color: #0f766e;">📋 Booking Details</h3>
      <div class="detail-row">
        <div class="detail-label">👤 Customer Name:</div>
        <div class="detail-value">${booking.customer_name}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">📅 Date:</div>
        <div class="detail-value">${format(new Date(booking.booking_date), 'EEEE, MMMM d, yyyy')}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">🕐 Session:</div>
        <div class="detail-value">${timeRange}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">👥 Number of Guests:</div>
        <div class="detail-value">${booking.party_size} guests</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">💬 WhatsApp:</div>
        <div class="detail-value">${booking.whatsapp_number}</div>
      </div>
    </div>
    
    <div class="reminder-box">
      <h3>⏰ Important Reminders</h3>
      <ul>
        <li>Please arrive on time. Your reservation is valid for <strong>${validMinutes} minutes</strong> from your booking time</li>
        <li>If you arrive <strong>more than 30 minutes late</strong> from your reservation time, your table may be given to walk-in guests and you will need to join the waiting list.</li>
        <li>Show your <strong>QR code</strong> or booking code at check-in</li>
        <li>If you need to make changes, you can modify your booking</li>
      </ul>
    </div>
    
    <div class="location-box">
      <p style="margin: 5px 0;"><strong>Boeba Restaurant</strong></p>
      <p style="margin: 5px 0; line-height: 1.5;">
        Jl. Prapanca Raya No.6A, Pulo, Kec. Kby. Baru,<br>
        Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12160
      </p>
      <p style="margin-top: 10px;">
        <a href="https://maps.app.goo.gl/gvknDgPn3UYGFGE16" class="button" style="color: white;">
          📍 Get Directions
        </a>
      </p>
    </div>
    
    <div class="buttons">
      <a href="${bookingDetailsUrl}" class="button">View Full Details</a>
      <a href="${modifyUrl}" class="button button-outline">Modify Booking</a>
    </div>
    
    <p style="text-align: center; color: #6b7280; margin-top: 30px;">
      We look forward to serving you the finest dining experience!
    </p>
  </div>
  
  <div class="footer">
    <p><strong>Boeba Restaurant</strong></p>
    <p>For inquiries, contact us via WhatsApp: +62 811-8306-639</p>
    <p style="font-size: 12px; color: #9ca3af;">
      This is an automated confirmation email. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
      `;

      await base44.integrations.Core.SendEmail({
        from_name: "Boeba Restaurant",
        to: booking.customer_email,
        subject: `Booking Confirmed - ${booking.booking_code} - Boeba Restaurant`,
        body: emailBody
      });

      setEmailSent(true);
      return true;
    } catch (error) {
      console.error("Error sending email confirmation:", error);
      setEmailSent(false);
      return false;
    }
  };

  const sendWhatsAppConfirmation = async (booking) => {
    try {
      const bookingDetailsUrl = `${window.location.origin}${createPageUrl('BookingDetails')}?code=${booking.booking_code}`;
      const modifyUrl = `${window.location.origin}${createPageUrl('ModifyBooking')}?code=${booking.booking_code}`;
      
      const timeSessions = getTimeSessions();
      // Extract start time from booking.time_slot
      const bookingStartTime = booking.time_slot.split('-')[0].trim();
      const currentIndex = timeSessions.indexOf(bookingStartTime);
      const nextSession = currentIndex !== -1 && currentIndex < timeSessions.length - 1 
        ? timeSessions[currentIndex + 1] 
        : null;
      
      const timeRange = nextSession 
        ? `${bookingStartTime} - ${nextSession}` 
        : bookingStartTime;
      
      const validMinutes = getReservationValidMinutes();
      
      const halalSetting = settings.find(s => s.setting_key === 'halal_code');
      const halalCode = halalSetting?.setting_value || null;
      
      const message = `*Boeba Restaurant - Booking Confirmed!*

Dear ${booking.customer_name},

Your table reservation has been confirmed! ✅

📋 *Booking Details:*
━━━━━━━━━━━━━━━━━━━━━━
👤 Customer Name: *${booking.customer_name}*
🔖 Booking Code: *${booking.booking_code}*
📅 Date: ${format(new Date(booking.booking_date), 'EEEE, MMMM d, yyyy')}
🕐 Session: *${timeRange}*
👥 Number of Guests: ${booking.party_size} guests
━━━━━━━━━━━━━━━━━━━━━━

⏰ *Important Reminders:*
• Your reservation is valid for *${validMinutes} minutes* from your booking time
• Please arrive on time. If you arrive *more than 30 minutes late* from your reservation time, your table may be given to walk-in guests and you will need to join the waiting list.
• Show your QR code or booking code at check-in: ${bookingDetailsUrl}​

🔄 *Need to Modify Your Booking?*
Click here: ${modifyUrl}​

📍 *Location & Directions:*
Jl. Prapanca Raya No.6A, Pulo, Kec. Kby. Baru, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12160
https://maps.app.goo.gl/gvknDgPn3UYGFGE16

We look forward to serving you the finest dining experience!

*Boeba Team*`;

      console.log('Attempting to send WhatsApp to:', booking.whatsapp_number);

      const response = await base44.functions.invoke('sendWhatsAppMessage', {
        phoneNumber: booking.whatsapp_number,
        message: message
      });

      console.log('WhatsApp Response:', response);

      if (response.data && !response.data.success) {
        throw new Error(response.data.details || 'Failed to send WhatsApp message');
      }

      setWhatsappError(null);
      setWhatsappSent(true);
      return true;
    } catch (error) {
      console.error("Error sending WhatsApp confirmation:", error);
      setWhatsappError(error.message || 'Failed to send WhatsApp notification');
      setWhatsappSent(false);
      return false;
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
    setStep(2);
    updateURL(2, date);
  };

  const handleTimeSlotSelect = (timeSlot) => {
    setSelectedTimeSlot(timeSlot);
    setStep(3);
    updateURL(3, selectedDate, timeSlot);
  };

  const handleFormSubmit = async (formData) => {
    try {
      // First, refetch latest bookings and capacities
      await queryClient.invalidateQueries(['bookings']);
      await queryClient.invalidateQueries(['sessionCapacities']);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure data is fresh

      // Get latest data from query cache after invalidation
      const latestBookings = queryClient.getQueryData(['bookings']) || [];
      const latestSessionCapacities = queryClient.getQueryData(['sessionCapacities']) || [];
      const latestCapacities = queryClient.getQueryData(['capacities']) || [];
      const latestSettings = queryClient.getQueryData(['settings']) || [];

      // Helper function to get default capacity using the latest settings
      const getLatestDefaultCapacity = () => {
        const capacitySetting = latestSettings.find(s => s.setting_key === 'default_capacity');
        return capacitySetting ? parseInt(capacitySetting.setting_value) : 50;
      };

      // Helper function to get capacity for session using latest data
      const getLatestCapacityForSession = (dateStr, timeSlot) => {
        const startTime = timeSlot.split('-')[0].trim();
        const sessionCap = latestSessionCapacities.find(
          sc => sc.date === dateStr && sc.time_slot === startTime
        );
        
        if (sessionCap) {
          return sessionCap.capacity;
        }
        
        const capacity = latestCapacities.find(c => c.date === dateStr);
        return capacity?.total_capacity || getLatestDefaultCapacity();
      };


      // Verify capacity is still available
      const bookedGuests = latestBookings.filter(b => {
        if (b.booking_date !== selectedDate || b.status !== 'confirmed') return false;
        const bookingStartTime = b.time_slot.split('-')[0].trim();
        const selectedStartTime = selectedTimeSlot.split('-')[0].trim();
        
        const normalizeTime = (time) => {
          return time.replace(/\s+/g, '').toLowerCase().replace('am', '').replace('pm', '');
        };
        
        return normalizeTime(bookingStartTime) === normalizeTime(selectedStartTime);
      }).reduce((sum, b) => sum + (b.party_size || 0), 0);

      const totalCapacity = getLatestCapacityForSession(selectedDate, selectedTimeSlot);
      const availableCapacity = totalCapacity - bookedGuests;

      if (formData.partySize > availableCapacity) {
        throw new Error(
          availableCapacity > 0
            ? `Sorry, only ${availableCapacity} spot(s) remaining for this session (${bookedGuests}/${totalCapacity} already booked). Please reduce the number of guests or choose a different time.`
            : `This session is now fully booked (${bookedGuests}/${totalCapacity}). Please choose a different time slot.`
        );
      }

      const verifyResponse = await base44.functions.invoke('verifyRecaptcha', {
        token: formData.recaptchaToken
      });

      if (!verifyResponse.data.success) {
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }

      const bookingCode = `BK${Date.now().toString().slice(-8)}`;
      const formattedWhatsApp = formatWhatsAppNumber(formData.whatsapp);
      
      const booking = await createBookingMutation.mutateAsync({
        booking_code: bookingCode,
        customer_name: formData.name,
        customer_email: formData.email || null,
        whatsapp_number: formattedWhatsApp,
        booking_date: selectedDate,
        time_slot: selectedTimeSlot,
        party_size: formData.partySize,
        status: "confirmed"
      });

      setStep(4);
      updateURL(4, null, null, booking.booking_code);
      
      sendWhatsAppConfirmation(booking);
      sendEmailConfirmation(booking);
    } catch (error) {
      console.error('Error during booking:', error);
      alert(error.message || 'Failed to create booking. Please try again.');
      // Reset to time slot selection to allow user to choose different time
      setStep(2);
      updateURL(2, selectedDate);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedDate(null);
      updateURL(1);
    } else if (step === 3) {
      setStep(2);
      setSelectedTimeSlot(null);
      updateURL(2, selectedDate);
    }
  };

  const handleNewBooking = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setBookingData(null);
    setWhatsappError(null);
    setWhatsappSent(false);
    setEmailSent(false);
    updateURL(1);
  };

  const getHalalCode = () => {
    const halalSetting = settings.find(s => s.setting_key === 'halal_code');
    const value = halalSetting?.setting_value?.trim();
    return value && value.length > 0 ? value : null;
  };

  const halalCode = getHalalCode();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
          style={{ marginTop: '-1.5em' }}
        >
          <div className="flex justify-center">
            <img 
              src="/logo.png" 
              alt="Boeba Restaurant" 
              className="w-40 h-40 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleNewBooking}
            />
          </div>
        </motion.div>

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
              sessionCapacities={sessionCapacities}
              settings={settings}
              getDefaultCapacity={getDefaultCapacity}
              getCapacityForSession={getCapacityForSession}
              getBookingsForSlot={getBookingsForSlot}
              onTimeSlotSelect={handleTimeSlotSelect}
              onBack={handleBack}
            />
          )}

          {step === 3 && (
            <BookingForm
              selectedDate={selectedDate}
              selectedTimeSlot={selectedTimeSlot}
              onSubmit={handleFormSubmit}
              onBack={handleBack}
              isSubmitting={createBookingMutation.isPending}
            />
          )}

          {step === 4 && bookingData && (
            <BookingConfirmation
              bookingData={bookingData}
              onNewBooking={handleNewBooking}
              whatsappError={whatsappError}
              whatsappSent={whatsappSent}
              emailSent={emailSent}
            />
          )}
        </AnimatePresence>

        {step !== 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 space-y-4"
          >
            <div style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm rounded-xl p-4 md:p-6 border-2 border-teal-200/50 shadow-lg text-center">
              <p className="text-xs md:text-sm text-gray-700 mb-3 leading-relaxed">
                <strong>Boeba Restaurant</strong> <br/>
                Jl. Prapanca Raya No.6A, Kby. Baru, <br/>
                Jakarta Selatan
              </p>
              <a
                href="https://maps.app.goo.gl/gvknDgPn3UYGFGE16"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm md:text-base font-medium rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Get Directions
              </a>
            </div>

            {halalCode && (
              <div style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm rounded-lg p-3 border-2 border-green-200/50 shadow-md">
                <div className="flex items-center justify-center gap-3">
                  <img 
                    src="https://maxsi.id/web/assets/label-logo-halal-baru-mui-2022.ByeZ8gwf_Z23l3M2.webp" 
                    alt="Halal MUI" 
                    className="w-8 h-8 md:w-10 md:h-10 object-contain"
                  />
                  <span className="text-xs md:text-sm font-semibold text-green-900">✓ Halal Certified - MUI: {halalCode}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <p className="text-gray-600 italic text-sm">Tauhid is Everything</p>
        </motion.div>
      </div>
    </div>
  );
}