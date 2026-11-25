import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  Search, 
  Users, 
  Clock, 
  Phone, 
  User, 
  Hash,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Check,
  Printer
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CheckIn() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        if (user) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        setIsAuthorized(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date'),
    enabled: isAuthorized,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    enabled: isAuthorized,
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
    },
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

  const handleMarkAsCompleted = (booking) => {
    updateBookingMutation.mutate({
      id: booking.id,
      data: { status: 'completed' }
    });
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  const handlePrint = () => {
    window.print();
  };

  const bookingsForDate = allBookings.filter(b => b.booking_date === selectedDate);

  const filteredBookings = bookingsForDate.filter(booking => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      booking.booking_code?.toLowerCase().includes(query) ||
      booking.customer_name?.toLowerCase().includes(query) ||
      booking.whatsapp_number?.includes(query)
    );
  });

  const timeSessions = getTimeSessions();
  const bookingsBySession = timeSessions.map(session => {
    const sessionBookings = filteredBookings.filter(b => {
      // Match bookings with either exact session time or time range starting with this session
      const bookingStartTime = b.time_slot?.split('-')[0].trim();
      return b.time_slot === session || bookingStartTime === session;
    });
    return {
      session,
      bookings: sessionBookings,
      confirmedCount: sessionBookings.filter(b => b.status === 'confirmed').length,
      totalGuests: sessionBookings
        .filter(b => b.status === 'confirmed')
        .reduce((sum, b) => sum + (b.party_size || 0), 0)
    };
  }).filter(group => group.bookings.length > 0);

  const totalBookings = filteredBookings.length;
  const confirmedBookings = filteredBookings.filter(b => b.status === 'confirmed').length;
  const totalGuests = filteredBookings
    .filter(b => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.party_size || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full" style={{ backgroundColor: '#fffffd' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                You need to be logged in to access this page. Please login to continue.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleLogin}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 no-print">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <img 
                  src="/logo.png" 
                  alt="Boeba" 
                  className="w-16 h-16 rounded-full shadow-lg"
                />
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Check-In Dashboard</h1>
                  <p className="text-gray-600">View and manage today's reservations</p>
                </div>
              </div>
              <Button 
                onClick={handlePrint}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print List
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 no-print">
            <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{totalBookings}</div>
                <p className="text-xs text-gray-500 mt-1">{confirmedBookings} confirmed</p>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Guests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{totalGuests}</div>
                <p className="text-xs text-gray-500 mt-1">Expected today</p>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Sessions Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{bookingsBySession.length}</div>
                <p className="text-xs text-gray-500 mt-1">With bookings</p>
              </CardContent>
            </Card>
          </div>

          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50 mb-6 no-print">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-teal-600" />
                    Select Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search" className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-teal-600" />
                    Search
                  </Label>
                  <Input
                    id="search"
                    type="text"
                    placeholder="Booking code, name, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-base"
                  />
                </div>
              </div>

              {searchQuery && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Found {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="text-teal-600 hover:text-teal-700"
                  >
                    Clear Search
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div id="print-section">
            <div className="print-only mb-6 text-center border-b-2 border-gray-800 pb-4">
              <h1 className="text-2xl font-bold mb-2">BOEBA RESTAURANT</h1>
              <h2 className="text-xl font-bold mb-2">CHECK-IN LIST</h2>
              <p className="text-lg font-semibold">{format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
              <div className="mt-3 flex justify-center gap-8 text-sm">
                <span><strong>Total Bookings:</strong> {totalBookings}</span>
                <span><strong>Confirmed:</strong> {confirmedBookings}</span>
                <span><strong>Total Guests:</strong> {totalGuests}</span>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 no-print">
                <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading bookings...</p>
              </div>
            ) : filteredBookings.length === 0 ? (
              <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings Found</h3>
                  <p className="text-gray-600">
                    {searchQuery 
                      ? "No bookings match your search criteria" 
                      : `No bookings for ${format(parseISO(selectedDate), 'MMMM d, yyyy')}`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {bookingsBySession.map((sessionGroup) => (
                  <div key={sessionGroup.session}>
                    <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50 no-print">
                      <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-teal-600" />
                            <CardTitle className="text-xl">{sessionGroup.session}</CardTitle>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <Badge variant="outline" className="bg-white">
                              {sessionGroup.confirmedCount} bookings
                            </Badge>
                            <Badge variant="outline" className="bg-white">
                              <Users className="w-3 h-3 mr-1" />
                              {sessionGroup.totalGuests} guests
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[120px]">Code</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead className="text-center">Guests</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sessionGroup.bookings.map((booking) => (
                                <TableRow key={booking.id} className="hover:bg-teal-50/50">
                                  <TableCell className="font-mono text-sm font-semibold">
                                    <div className="flex items-center gap-2">
                                      <Hash className="w-4 h-4 text-gray-400" />
                                      {booking.booking_code}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-gray-400" />
                                      <span className="font-medium">{booking.customer_name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm">{booking.whatsapp_number}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                      <Users className="w-3 h-3 mr-1" />
                                      {booking.party_size}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {getStatusBadge(booking.status)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {booking.status === 'confirmed' && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleMarkAsCompleted(booking)}
                                        disabled={updateBookingMutation.isPending}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                      >
                                        <Check className="w-4 h-4 mr-1" />
                                        Complete
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="print-only mb-8">
                      <div className="border-2 border-gray-800 mb-4">
                        <div className="bg-gray-200 px-3 py-2 border-b-2 border-gray-800">
                          <h3 className="text-lg font-bold">⏰ SESSION: {sessionGroup.session}</h3>
                          <p className="text-sm">
                            <strong>{sessionGroup.confirmedCount}</strong> bookings • 
                            <strong> {sessionGroup.totalGuests}</strong> guests
                          </p>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-gray-800">
                              <th className="px-2 py-2 text-left font-bold border-r border-gray-800">CODE</th>
                              <th className="px-2 py-2 text-left font-bold border-r border-gray-800">CUSTOMER</th>
                              <th className="px-2 py-2 text-left font-bold border-r border-gray-800">PHONE</th>
                              <th className="px-2 py-2 text-center font-bold border-r border-gray-800">GUESTS</th>
                              <th className="px-2 py-2 text-center font-bold border-r border-gray-800">STATUS</th>
                              <th className="px-2 py-2 text-center font-bold">✓</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessionGroup.bookings.map((booking, idx) => (
                              <tr key={booking.id} className={idx < sessionGroup.bookings.length - 1 ? "border-b border-gray-400" : ""}>
                                <td className="px-2 py-3 font-mono font-bold border-r border-gray-400">{booking.booking_code}</td>
                                <td className="px-2 py-3 font-semibold border-r border-gray-400">{booking.customer_name}</td>
                                <td className="px-2 py-3 border-r border-gray-400">{booking.whatsapp_number}</td>
                                <td className="px-2 py-3 text-center font-bold border-r border-gray-400">{booking.party_size}</td>
                                <td className="px-2 py-3 text-center border-r border-gray-400">
                                  {booking.status === 'confirmed' ? '✓' : booking.status === 'cancelled' ? '✗' : '✓✓'}
                                </td>
                                <td className="px-2 py-3">
                                  <div className="border-2 border-gray-800 w-6 h-6 mx-auto"></div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="print-only mt-8 pt-4 border-t-2 border-gray-800 text-center text-sm">
              <p className="font-semibold">Boeba Restaurant • Jl. Prapanca Raya No.6A, Jakarta Selatan</p>
              <p>Phone: +62 811-8306-639</p>
              <p className="mt-2 text-xs">Printed on: {format(new Date(), 'MMMM d, yyyy HH:mm')}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}