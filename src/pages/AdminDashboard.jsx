
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Users, CheckCircle, TrendingUp, Edit2, AlertCircle, X, Plus, Settings as SettingsIcon, Edit } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BookingCalendarView from "../components/admin/BookingCalendarView";
import BookingFilters from "../components/admin/BookingFilters";
import ManualBookingDialog from "../components/admin/ManualBookingDialog";
import SettingsDialog from "../components/admin/SettingsDialog";

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editingCapacity, setEditingCapacity] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [newCapacity, setNewCapacity] = useState(50);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    date: ''
  });

  const queryClient = useQueryClient();

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

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-created_date'),
    enabled: isAuthorized,
  });

  const { data: capacities = [] } = useQuery({
    queryKey: ['capacities'],
    queryFn: () => base44.entities.DateCapacity.list(),
    enabled: isAuthorized,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    enabled: isAuthorized,
  });

  const createCapacityMutation = useMutation({
    mutationFn: (data) => base44.entities.DateCapacity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['capacities']);
      setShowCapacityDialog(false);
      setNewCapacity(50);
    },
  });

  const updateCapacityMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DateCapacity.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['capacities']);
      setShowCapacityDialog(false);
      setEditingCapacity(null);
      setNewCapacity(50);
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Booking.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      setShowCancelDialog(false);
      setSelectedBooking(null);
      setCancelReason("");
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: (data) => base44.entities.Booking.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      setShowBookingDialog(false);
      setEditingBooking(null);
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      setShowBookingDialog(false);
      setEditingBooking(null);
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsData) => {
      const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
      const sessionsSetting = settings.find(s => s.setting_key === 'time_sessions');
      const prayerSetting = settings.find(s => s.setting_key === 'friday_prayer_closure');
      const sundayReservedSetting = settings.find(s => s.setting_key === 'sunday_morning_reserved');
      
      const promises = [];
      
      if (capacitySetting) {
        promises.push(
          base44.entities.Settings.update(capacitySetting.id, {
            setting_value: String(settingsData.default_capacity)
          })
        );
      } else {
        promises.push(
          base44.entities.Settings.create({
            setting_key: 'default_capacity',
            setting_value: String(settingsData.default_capacity),
            description: 'Default daily capacity for bookings'
          })
        );
      }
      
      if (sessionsSetting) {
        promises.push(
          base44.entities.Settings.update(sessionsSetting.id, {
            setting_value: JSON.stringify(settingsData.time_sessions)
          })
        );
      } else {
        promises.push(
          base44.entities.Settings.create({
            setting_key: 'time_sessions',
            setting_value: JSON.stringify(settingsData.time_sessions),
            description: 'Available time sessions for bookings'
          })
        );
      }
      
      if (prayerSetting) {
        promises.push(
          base44.entities.Settings.update(prayerSetting.id, {
            setting_value: String(settingsData.friday_prayer_closure)
          })
        );
      } else {
        promises.push(
          base44.entities.Settings.create({
            setting_key: 'friday_prayer_closure',
            setting_value: String(settingsData.friday_prayer_closure),
            description: 'Close 11:00 AM - 12:00 PM on Fridays for prayer'
          })
        );
      }
      
      if (sundayReservedSetting) {
        promises.push(
          base44.entities.Settings.update(sundayReservedSetting.id, {
            setting_value: String(settingsData.sunday_morning_reserved)
          })
        );
      } else {
        promises.push(
          base44.entities.Settings.create({
            setting_key: 'sunday_morning_reserved',
            setting_value: String(settingsData.sunday_morning_reserved),
            description: 'Reserved slots for walk-ins on Sunday mornings (08:00-11:00)'
          })
        );
      }
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
      setShowSettingsDialog(false);
    },
  });

  const sendCancellationWhatsApp = async (booking, reason) => {
    try {
      const message = `🦞 *Boeba Gourmet Seafood - Booking Cancelled* 🦞

Dear ${booking.customer_name},

We regret to inform you that your reservation has been cancelled. ❌

📋 *Booking Details:*
━━━━━━━━━━━━━━━━━━━━━━
🔖 Booking Code: *${booking.booking_code}*
📅 Date: ${format(new Date(booking.booking_date), 'EEEE, MMMM d, yyyy')}
🕐 Time: ${booking.time_slot}
👥 Number of People: ${booking.party_size} guests
━━━━━━━━━━━━━━━━━━━━━━

${reason ? `📝 *Reason:* ${reason}\n` : ''}
We apologize for any inconvenience. Please feel free to make a new reservation at your convenience.

If you have any questions, please reply to this message.

*Boeba Team*`;

      if (booking.whatsapp_number) {
        await base44.functions.invoke('sendWhatsAppMessage', {
          phoneNumber: booking.whatsapp_number,
          message: message
        });
      }
    } catch (error) {
      console.error("Error sending WhatsApp cancellation:", error);
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  const handleSetCapacity = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existing = capacities.find(c => c.date === dateStr);

    if (existing) {
      setEditingCapacity(existing);
      setNewCapacity(existing.total_capacity);
    } else {
      setEditingCapacity(null);
      setNewCapacity(getDefaultCapacity());
    }
    setShowCapacityDialog(true);
  };

  const handleSaveCapacity = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (editingCapacity) {
      updateCapacityMutation.mutate({
        id: editingCapacity.id,
        data: { total_capacity: newCapacity }
      });
    } else {
      createCapacityMutation.mutate({
        date: dateStr,
        total_capacity: newCapacity
      });
    }
  };

  const handleCancelBooking = (booking) => {
    setSelectedBooking(booking);
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (selectedBooking) {
      await cancelBookingMutation.mutateAsync({ id: selectedBooking.id });
      await sendCancellationWhatsApp(selectedBooking, cancelReason);
    }
  };

  const handleEditBooking = (booking) => {
    setEditingBooking(booking);
    setShowBookingDialog(true);
  };

  const handleSaveBooking = async (formData) => {
    if (editingBooking) {
      await updateBookingMutation.mutateAsync({
        id: editingBooking.id,
        data: formData
      });
    } else {
      const bookingCode = `BK${Date.now().toString().slice(-8)}`;
      await createBookingMutation.mutateAsync({
        ...formData,
        booking_code: bookingCode
      });
    }
  };

  const handleSaveSettings = async (settingsData) => {
    await saveSettingsMutation.mutateAsync(settingsData);
  };

  const getDefaultCapacity = () => {
    const capacitySetting = settings.find(s => s.setting_key === 'default_capacity');
    return capacitySetting ? parseInt(capacitySetting.setting_value) : 50;
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

  const getCapacityForDate = (dateStr) => {
    const capacity = capacities.find(c => c.date === dateStr);
    return capacity?.total_capacity || getDefaultCapacity();
  };

  const getBookingsForDate = (dateStr) => {
    return bookings.filter(b => b.booking_date === dateStr && b.status === 'confirmed').length;
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      date: ''
    });
  };

  // Filter bookings based on filters
  const filteredBookings = bookings.filter(booking => {
    if (filters.status !== 'all' && booking.status !== filters.status) return false;
    if (filters.date && booking.booking_date !== filters.date) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        booking.customer_name?.toLowerCase().includes(searchLower) ||
        booking.booking_code?.toLowerCase().includes(searchLower) ||
        booking.whatsapp_number?.includes(searchLower)
      );
    }
    return true;
  });

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
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

  const todayBookings = bookings.filter(
    (b) => b.booking_date === format(new Date(), 'yyyy-MM-dd') && b.status === 'confirmed'
  );

  const upcomingBookings = bookings.filter(
    (b) => new Date(b.booking_date) >= new Date() && b.status === 'confirmed'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Manage bookings and capacity</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowSettingsDialog(true)} variant="outline">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button onClick={() => { setEditingBooking(null); setShowBookingDialog(true); }} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Today's Bookings</CardTitle>
              <CalendarIcon className="w-4 h-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{todayBookings.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Upcoming</CardTitle>
              <TrendingUp className="w-4 h-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{upcomingBookings.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Bookings</CardTitle>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Seats Per Session</CardTitle>
              <Users className="w-4 h-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{getDefaultCapacity()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Calendar View */}
        <div className="mb-6">
          <BookingCalendarView
            bookings={bookings}
            capacities={capacities}
            onDateClick={(date) => {
              setSelectedDate(date);
              setFilters({ ...filters, date: format(date, 'yyyy-MM-dd') });
            }}
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <BookingFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Capacity Management */}
          <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Date Capacity</span>
                <Button onClick={handleSetCapacity} size="sm" className="bg-teal-600 hover:bg-teal-700">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
              <div className="mt-4 p-4 bg-teal-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Selected: {format(selectedDate, 'MMMM d, yyyy')}</p>
                <p className="text-lg font-semibold text-gray-900">
                  Capacity: {getCapacityForDate(format(selectedDate, 'yyyy-MM-dd'))} seats
                </p>
                <p className="text-sm text-gray-600">
                  Booked: {getBookingsForDate(format(selectedDate, 'yyyy-MM-dd'))} bookings
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bookings List */}
          <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50 lg:col-span-2">
            <CardHeader>
              <CardTitle>
                Bookings {filters.search || filters.status !== 'all' || filters.date ? 
                  `(${filteredBookings.length} filtered)` : 
                  `(${bookings.length} total)`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>People</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.slice(0, 20).map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-sm">{booking.booking_code}</TableCell>
                        <TableCell>{booking.customer_name}</TableCell>
                        <TableCell>{format(parseISO(booking.booking_date), 'MMM d')}</TableCell>
                        <TableCell>{booking.time_slot}</TableCell>
                        <TableCell>{booking.party_size}</TableCell>
                        <TableCell>
                          <Badge className={
                            booking.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }>
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBooking(booking)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {booking.status === 'confirmed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelBooking(booking)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Capacity Dialog */}
      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Capacity for {format(selectedDate, 'MMMM d, yyyy')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="capacity">Total Capacity</Label>
            <Input
              id="capacity"
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(parseInt(e.target.value))}
              min="1"
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-2">
              Current bookings: {getBookingsForDate(format(selectedDate, 'yyyy-MM-dd'))}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapacityDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCapacity}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={createCapacityMutation.isPending || updateCapacityMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Are you sure you want to cancel this booking? A WhatsApp notification will be sent to the customer.
              </AlertDescription>
            </Alert>
            
            {selectedBooking && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <p><strong>Code:</strong> {selectedBooking.booking_code}</p>
                <p><strong>Name:</strong> {selectedBooking.customer_name}</p>
                <p><strong>WhatsApp:</strong> {selectedBooking.whatsapp_number}</p>
                <p><strong>Date:</strong> {format(parseISO(selectedBooking.booking_date), 'MMM d, yyyy')}</p>
                <p><strong>Time:</strong> {selectedBooking.time_slot}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Cancellation Reason (optional)</Label>
              <Textarea
                id="reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Booking
            </Button>
            <Button 
              onClick={handleConfirmCancel}
              className="bg-red-600 hover:bg-red-700"
              disabled={cancelBookingMutation.isPending}
            >
              {cancelBookingMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Booking Dialog */}
      <ManualBookingDialog
        open={showBookingDialog}
        onOpenChange={setShowBookingDialog}
        onSave={handleSaveBooking}
        booking={editingBooking}
        timeSessions={getTimeSessions()}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
