import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
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
  AlertCircle,
  Loader2,
  Printer,
  MessageCircle
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

export default function OrderList() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        if (user && user.role === 'admin') {
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

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-order-list');
    const printWindow = window.open('', '', 'height=800,width=1000');
    
    printWindow.document.write('<html><head><title>Order List - ' + format(parseISO(selectedDate), 'MMMM d, yyyy') + '</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
      body { 
        font-family: Arial, sans-serif; 
        padding: 20px;
        color: #000;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 3px solid #14b8a6;
      }
      .logo {
        width: 60px;
        height: 60px;
        border-radius: 50%;
      }
      .header-text h1 {
        margin: 0;
        color: #14b8a6;
        font-size: 28px;
      }
      .header-text p {
        margin: 5px 0 0 0;
        color: #666;
        font-size: 16px;
      }
      .summary {
        display: flex;
        gap: 20px;
        margin-bottom: 30px;
        padding: 15px;
        background: #f0fdfa;
        border-radius: 8px;
      }
      .summary-item {
        flex: 1;
      }
      .summary-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        margin-bottom: 5px;
      }
      .summary-value {
        font-size: 24px;
        font-weight: bold;
        color: #14b8a6;
      }
      .session-group {
        margin-bottom: 30px;
        page-break-inside: avoid;
      }
      .session-header {
        background: #14b8a6;
        color: white;
        padding: 12px 15px;
        border-radius: 8px 8px 0 0;
        font-size: 18px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .session-stats {
        font-size: 14px;
        font-weight: normal;
      }
      table { 
        width: 100%; 
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th {
        background: #f0fdfa;
        padding: 12px;
        text-align: left;
        font-size: 12px;
        text-transform: uppercase;
        color: #14b8a6;
        font-weight: 600;
        border: 1px solid #ccfbf1;
      }
      td { 
        padding: 12px;
        border: 1px solid #e5e7eb;
        font-size: 14px;
      }
      tr:nth-child(even) {
        background: #f9fafb;
      }
      .booking-code {
        font-family: 'Courier New', monospace;
        font-weight: bold;
        color: #14b8a6;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #e5e7eb;
        text-align: center;
        color: #666;
        font-size: 12px;
      }
      @media print {
        body { margin: 0; }
        .session-group { page-break-inside: avoid; }
      }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleWhatsApp = (booking) => {
    const message = `Hello ${booking.customer_name},\n\nThis is a reminder about your reservation at Boeba Restaurant.\n\nBooking Code: ${booking.booking_code}\nDate: ${format(parseISO(booking.booking_date), 'EEEE, MMMM d, yyyy')}\nTime: ${booking.time_slot}\nNumber of Guests: ${booking.party_size}\n\nWe look forward to serving you!\n\nBest regards,\nBoeba Team`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${booking.whatsapp_number}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Filter bookings by date
  const bookingsForDate = allBookings.filter(b => b.booking_date === selectedDate);

  // Filter by search query
  const filteredBookings = bookingsForDate.filter(booking => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      booking.booking_code?.toLowerCase().includes(query) ||
      booking.customer_name?.toLowerCase().includes(query) ||
      booking.whatsapp_number?.includes(query)
    );
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

  // Group bookings by time slot
  const timeSessions = getTimeSessions();
  const bookingsBySession = timeSessions.map(session => {
    const sessionBookings = filteredBookings.filter(b => b.time_slot === session);
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
                You need admin privileges to access this page. Please login with an admin account.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleLogin}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              Login as Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Boeba" 
                className="w-16 h-16 rounded-full shadow-lg"
              />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Order List</h1>
                <p className="text-gray-600">Print and manage booking orders</p>
              </div>
            </div>
            <Button 
              onClick={handlePrint}
              disabled={filteredBookings.length === 0}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print List
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
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
              <CardTitle className="text-sm font-medium text-gray-600">Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{bookingsBySession.length}</div>
              <p className="text-xs text-gray-500 mt-1">With orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50 mb-6">
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
                  Found {filteredBookings.length} order{filteredBookings.length !== 1 ? 's' : ''}
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

        {/* Orders List (Screen View) */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Found</h3>
              <p className="text-gray-600">
                {searchQuery 
                  ? "No orders match your search criteria" 
                  : `No orders for ${format(parseISO(selectedDate), 'MMMM d, yyyy')}`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {bookingsBySession.map((sessionGroup) => (
              <Card key={sessionGroup.session} style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-teal-600" />
                      <CardTitle className="text-xl">{sessionGroup.session}</CardTitle>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant="outline" className="bg-white">
                        {sessionGroup.confirmedCount} orders
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
                          <TableHead className="text-center">WhatsApp</TableHead>
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleWhatsApp(booking)}
                                className="border-green-300 text-green-700 hover:bg-green-50"
                              >
                                <MessageCircle className="w-4 h-4 mr-1" />
                                Send
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Hidden Printable Content */}
        <div id="printable-order-list" style={{ display: 'none' }}>
          <div className="header">
            <img 
              src="/logo.png" 
              alt="Boeba" 
              className="logo"
            />
            <div className="header-text">
              <h1>Boeba Restaurant</h1>
              <p>Order List - {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>

          <div className="summary">
            <div className="summary-item">
              <div className="summary-label">Total Orders</div>
              <div className="summary-value">{totalBookings}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Confirmed</div>
              <div className="summary-value">{confirmedBookings}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Total Guests</div>
              <div className="summary-value">{totalGuests}</div>
            </div>
          </div>

          {bookingsBySession.map((sessionGroup) => (
            <div key={sessionGroup.session} className="session-group">
              <div className="session-header">
                <span>{sessionGroup.session}</span>
                <span className="session-stats">
                  {sessionGroup.confirmedCount} orders • {sessionGroup.totalGuests} guests
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Booking Code</th>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th style={{ textAlign: 'center' }}>Guests</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionGroup.bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="booking-code">{booking.booking_code}</td>
                      <td>{booking.customer_name}</td>
                      <td>{booking.whatsapp_number}</td>
                      <td style={{ textAlign: 'center' }}>{booking.party_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="footer">
            <p>Printed on {format(new Date(), 'MMMM d, yyyy HH:mm')}</p>
            <p>Boeba Restaurant • Jl. Prapanca Raya No.6A, Jakarta Selatan</p>
          </div>
        </div>
      </div>
    </div>
  );
}