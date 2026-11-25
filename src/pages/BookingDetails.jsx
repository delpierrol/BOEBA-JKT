import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { CheckCircle, Calendar, Clock, Users, FileText, Edit, Home, MessageCircle, Loader2, AlertCircle, MapPin, Save, X as XIcon, Mail, StickyNote } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function BookingDetails() {
  const [bookingCode, setBookingCode] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setBookingCode(code);
    }

    // Check if user is admin
    const checkAdmin = async () => {
      try {
        const user = await base44.auth.me();
        setIsAdmin(user?.role === 'admin');
      } catch (error) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', bookingCode],
    queryFn: async () => {
      const bookings = await base44.entities.Booking.list();
      const found = bookings.find(b => b.booking_code === bookingCode);
      if (!found) {
        throw new Error("Booking not found");
      }
      return found;
    },
    enabled: !!bookingCode,
    retry: false,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    enabled: !!booking,
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['booking', bookingCode]);
      setIsEditing(false);
      setEditedData({});
    },
  });

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedData({
      customer_email: booking.customer_email || '',
      whatsapp_number: booking.whatsapp_number || '',
      notes: booking.notes || ''
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedData({});
  };

  const handleSaveEdit = async () => {
    await updateBookingMutation.mutateAsync({
      id: booking.id,
      data: editedData
    });
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

  const formatBookingDate = () => {
    try {
      if (!booking?.booking_date) return 'Invalid Date';
      const date = new Date(booking.booking_date);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'EEEE, MMM d, yyyy');
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Invalid Date';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (!bookingCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8 flex items-center justify-center">
        <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm shadow-xl border-teal-200/50 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Booking Code</h2>
            <p className="text-gray-600 mb-6">
              Please access this page with a valid booking code.
            </p>
            <Link to={createPageUrl('BookTable')}>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Home className="w-4 h-4 mr-2" />
                Make a Booking
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8 flex items-center justify-center">
        <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm shadow-xl border-teal-200/50 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">
              We couldn't find a booking with code: <strong>{bookingCode}</strong>
            </p>
            <div className="space-y-3">
              <Link to={createPageUrl('BookTable')} className="block">
                <Button className="w-full bg-teal-600 hover:bg-teal-700">
                  <Home className="w-4 h-4 mr-2" />
                  Make New Booking
                </Button>
              </Link>
              <Link to={createPageUrl('Reschedule')} className="block">
                <Button variant="outline" className="w-full border-2 border-teal-200">
                  <Edit className="w-4 h-4 mr-2" />
                  Find My Booking
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextSession = getNextSession(booking.time_slot);
  const validMinutes = getReservationValidMinutes();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <img 
              src="/logo.png" 
              alt="Boeba Restaurant" 
              className="w-20 h-20 md:w-24 md:h-24 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Your Booking Details
          </h1>
          <p className="text-gray-600">
            Booking Code: <span className="font-semibold text-teal-700">{booking.booking_code}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm shadow-2xl border-teal-200/50 overflow-hidden">
            {/* Status Banner */}
            <div className={`p-4 md:p-6 text-center ${
              booking.status === 'confirmed' ? 'bg-gradient-to-r from-teal-500 to-cyan-600' :
              booking.status === 'completed' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' :
              'bg-gradient-to-r from-gray-500 to-gray-600'
            } text-white`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {getStatusIcon(booking.status)}
                <Badge className="bg-white/20 text-white border-white/30 text-sm md:text-base px-3 md:px-4 py-1">
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm md:text-base text-white/90">
                {booking.status === 'confirmed' && 'Your reservation is confirmed'}
                {booking.status === 'completed' && 'You have checked in - Enjoy your meal!'}
                {booking.status === 'cancelled' && 'This booking has been cancelled'}
              </p>
            </div>

            <CardContent className="p-6 md:p-8">
              <div className="space-y-6">
                {/* QR Code Section */}
                {booking.status !== 'cancelled' && (
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border-2 border-teal-200">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-600">Your Booking Code</span>
                      <Badge className="bg-teal-600 text-white text-base md:text-lg px-4 py-1">
                        {booking.booking_code}
                      </Badge>
                    </div>
                    
                    {/* QR Code */}
                    <div className="flex justify-center my-4">
                      <div className="bg-white p-4 rounded-lg border-2 border-teal-200 shadow-md">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${booking.booking_code}`}
                          alt="Booking QR Code"
                          className="w-40 h-40 md:w-48 md:h-48"
                        />
                      </div>
                    </div>
                    
                    <p className="text-xs text-center text-gray-600">
                      <span>Show this <strong>QR code</strong> or booking code at check-in</span>
                    </p>
                  </div>
                )}

                {/* Booking Details */}
                <div className="space-y-4">
                  {isAdmin && (
                    <div className="flex justify-end gap-2">
                      {!isEditing ? (
                        <Button 
                          onClick={handleStartEdit}
                          size="sm"
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Contact Info
                        </Button>
                      ) : (
                        <>
                          <Button 
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="outline"
                          >
                            <XIcon className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleSaveEdit}
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700"
                            disabled={updateBookingMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-teal-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Guest Name</p>
                        <p className="font-semibold text-gray-900">{booking.customer_name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-5 h-5 text-cyan-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-1">WhatsApp</p>
                        {isEditing ? (
                          <Input
                            value={editedData.whatsapp_number || ''}
                            onChange={(e) => setEditedData({...editedData, whatsapp_number: e.target.value})}
                            className="h-8"
                          />
                        ) : (
                          <p className="font-semibold text-gray-900">{booking.whatsapp_number}</p>
                        )}
                      </div>
                    </div>

                    {(booking.customer_email || isEditing) && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-5 h-5 text-blue-700" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 mb-1">Email</p>
                          {isEditing ? (
                            <Input
                              type="email"
                              value={editedData.customer_email || ''}
                              onChange={(e) => setEditedData({...editedData, customer_email: e.target.value})}
                              className="h-8"
                            />
                          ) : (
                            <p className="font-semibold text-gray-900">{booking.customer_email}</p>
                          )}
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
                        <p className="text-sm text-gray-600">Time</p>
                        <p className="font-semibold text-gray-900">{booking.time_slot}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Number of Guests</p>
                        <p className="font-semibold text-gray-900">{booking.party_size} people</p>
                      </div>
                    </div>

                    {(booking.notes || isEditing) && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg md:col-span-2">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <StickyNote className="w-5 h-5 text-yellow-700" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-600 mb-1">Notes</p>
                          {isEditing ? (
                            <Input
                              value={editedData.notes || ''}
                              onChange={(e) => setEditedData({...editedData, notes: e.target.value})}
                              placeholder="Add notes..."
                              className="h-8"
                            />
                          ) : (
                            <p className="text-gray-900">{booking.notes}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Important Reminders */}
                {booking.status === 'confirmed' && (
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
                        <span>Show your <strong>QR code</strong> or booking code at check-in</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>If you need to make changes, use the reschedule option below</span>
                      </li>
                    </ul>
                  </div>
                )}

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
                    href="https://www.google.com/maps/search/?api=1&query=Jl.+Prapanca+Raya+No.6A,+Pulo,+Kec.+Kby.+Baru,+Kota+Jakarta+Selatan,+Daerah+Khusus+Ibukota+Jakarta+12160"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg text-sm"
                  >
                    <MapPin className="w-4 h-4" />
                    Open in Google Maps
                  </a>
                </div>

                {/* Action Buttons */}
                <div className="grid md:grid-cols-2 gap-3 pt-4">
                  {booking.status === 'confirmed' && (
                    <Link to={createPageUrl('Reschedule') + `?code=${booking.booking_code}`} className="w-full">
                      <Button variant="outline" className="w-full h-12 text-base border-2 border-teal-200 hover:bg-teal-50">
                        <Edit className="w-5 h-5 mr-2" />
                        Reschedule Booking
                      </Button>
                    </Link>
                  )}
                  <Link to={createPageUrl('BookTable')} className="w-full">
                    <Button
                      className={`w-full h-12 text-base bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 ${
                        booking.status === 'confirmed' ? '' : 'md:col-span-2'
                      }`}
                    >
                      <Home className="w-5 h-5 mr-2" />
                      Make New Booking
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}