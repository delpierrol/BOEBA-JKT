import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { CheckCircle, Calendar, Clock, Users, FileText, Edit, Home, MessageCircle, Mail, AlertTriangle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function BookingConfirmation({ bookingData, onNewBooking, whatsappError, whatsappSent, emailSent }) {
  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
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

  const nextSession = getNextSession(bookingData.time_slot);
  const validMinutes = getReservationValidMinutes();
  
  // Format time range
  const timeRange = nextSession 
    ? `${bookingData.time_slot} - ${nextSession}` 
    : bookingData.time_slot;

  const formatBookingDate = () => {
    try {
      if (!bookingData.booking_date) return 'Invalid Date';
      const date = new Date(bookingData.booking_date);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'EEEE, MMM d, yyyy');
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Invalid Date';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Card style={{ backgroundColor: '#fffffd', marginTop: '-2em' }} className="backdrop-blur-sm shadow-2xl border-teal-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-5 text-white">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="flex justify-center mb-3"
          >
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-10 h-10 text-teal-600" />
            </div>
          </motion.div>
          <h2 className="text-lg font-bold text-center mb-1">Booking Confirmed!</h2>
          <p className="text-center text-teal-50">Your table has been reserved</p>
        </div>

        <CardContent className="p-6 md:p-8">
          {whatsappSent && (
            <Alert className="mb-4 bg-green-50 border-green-200">
              <MessageCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>WhatsApp confirmation sent!</strong> Check your phone for booking details and QR code.
              </AlertDescription>
            </Alert>
          )}

          {emailSent && bookingData.customer_email && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Email confirmation sent!</strong> Check your inbox at <strong>{bookingData.customer_email}</strong> for booking details and QR code.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* QR Code Section */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border-2 border-teal-200">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600">Your Booking Code</span>
                <Badge className="bg-teal-600 text-white text-lg px-4 py-1">
                  {bookingData.booking_code}
                </Badge>
              </div>
              
              {/* QR Code */}
              <div className="flex justify-center my-4">
                <div className="bg-white p-4 rounded-lg border-2 border-teal-200 shadow-md">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${bookingData.booking_code}`}
                    alt="Booking QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-600 text-center">
                <span>Show this <strong>QR code</strong> or booking code at check-in</span>
              </p>
            </div>

            {/* Booking Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Guest Name</p>
                  <p className="font-semibold text-gray-900">{bookingData.customer_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-cyan-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">WhatsApp</p>
                  <p className="font-semibold text-gray-900">{bookingData.whatsapp_number}</p>
                </div>
              </div>

              {bookingData.customer_email && (
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900 break-all">{bookingData.customer_email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold text-gray-900">
                    {formatBookingDate()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Session</p>
                  <p className="font-semibold text-gray-900">{timeRange}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg md:col-span-2">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Number of Guests</p>
                  <p className="font-semibold text-gray-900">{bookingData.party_size} people</p>
                </div>
              </div>
            </div>

            {/* Important Reminders */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Important Reminders
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Please arrive on time. Your reservation is valid for <strong>{validMinutes} minutes</strong> from your booking time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>If you arrive <strong>more than 30 minutes late</strong> from your reservation time, your table may be given to walk-in guests and you will need to join the waiting list.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Show your <strong>QR code</strong> or booking code at check-in</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>If you need to make changes, use the modify booking option below</span>
                </li>
              </ul>
            </div>

            {/* Directions Section */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-teal-900 mb-2">
                Boeba Restaurant
              </p>
              <p className="text-sm text-teal-800 mb-4 leading-relaxed">
                Jl. Prapanca Raya No.6A Kby. Baru,<br />
                Jakarta Selatan
              </p>
              <a
                href="https://maps.app.goo.gl/gvknDgPn3UYGFGE16"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Open in Google Maps
              </a>
            </div>

            {/* Action Buttons */}
            <div className="grid md:grid-cols-2 gap-3 pt-4">
              <Link to={createPageUrl('ModifyBooking') + `?code=${bookingData.booking_code}`} className="w-full">
                <Button variant="outline" className="w-full h-12 text-base border-2 border-teal-200 hover:bg-teal-50">
                  <Edit className="w-5 h-5 mr-2" />
                  Modify Booking
                </Button>
              </Link>
              <Button
                onClick={onNewBooking}
                className="w-full h-12 text-base bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
              >
                <Home className="w-5 h-5 mr-2" />
                Make New Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}