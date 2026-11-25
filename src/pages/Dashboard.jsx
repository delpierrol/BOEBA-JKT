import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Users, CheckCircle, TrendingUp, Edit2, AlertCircle, X, Plus, Settings as SettingsIcon, Edit, Bell, MessageCircle } from "lucide-react";
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
import BookingCalendarFull from "../components/admin/BookingCalendarFull";
import BookingFilters from "../components/admin/BookingFilters";
import ManualBookingDialog from "../components/admin/ManualBookingDialog";
import SettingsDialog from "../components/admin/SettingsDialog";
import WaitingListDialog from "../components/admin/WaitingListDialog";
import BulkUploadDialog from "../components/admin/BulkUploadDialog";
import DateBookingsModal from "../components/admin/DateBookingsModal";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showWaitingListDialog, setShowWaitingListDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editingWaitingList, setEditingWaitingList] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [sessionCapacities, setSessionCapacities] = useState({});
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    timeSlot: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });
  const [viewMode, setViewMode] = useState('calendar'); // 'list' or 'calendar'
  const [showDateModal, setShowDateModal] = useState(false);
  const [modalSelectedDate, setModalSelectedDate] = useState(null);

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

  const { data: sessionCapacitiesData = [] } = useQuery({
    queryKey: ['sessionCapacities'],
    queryFn: () => base44.entities.SessionCapacity.list(),
    enabled: isAuthorized,
  });

  const { data: waitingList = [] } = useQuery({
    queryKey: ['waitingList'],
    queryFn: () => base44.entities.WaitingList.list('-created_date'),
    enabled: isAuthorized,
  });

  // Auto-delete past waiting list entries
  useEffect(() => {
    if (!isAuthorized || !waitingList || waitingList.length === 0) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const pastEntries = waitingList.filter(entry => entry.booking_date < today);

    if (pastEntries.length > 0) {
      // Delete past entries
      Promise.all(
        pastEntries.map(entry => base44.entities.WaitingList.delete(entry.id))
      ).then(() => {
        queryClient.invalidateQueries(['waitingList']);
      }).catch(error => {
        console.error('Error deleting past waiting list entries:', error);
      });
    }
  }, [waitingList, isAuthorized, queryClient]);

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
    enabled: isAuthorized,
  });

  const createSessionCapacityMutation = useMutation({
    mutationFn: (data) => base44.entities.SessionCapacity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionCapacities']);
      queryClient.invalidateQueries(['bookings']); // Added this line
      setShowCapacityDialog(false);
      setSessionCapacities({});
    },
  });

  const updateSessionCapacityMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SessionCapacity.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionCapacities']);
      queryClient.invalidateQueries(['bookings']); // Added this line
      setShowCapacityDialog(false);
      setSessionCapacities({});
    },
  });

  const deleteSessionCapacityMutation = useMutation({
    mutationFn: (id) => base44.entities.SessionCapacity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessionCapacities']);
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

  const createWaitingListMutation = useMutation({
    mutationFn: (data) => base44.entities.WaitingList.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['waitingList']);
      setShowWaitingListDialog(false);
      setEditingWaitingList(null);
    },
  });

  const updateWaitingListMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WaitingList.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['waitingList']);
      setShowWaitingListDialog(false);
      setEditingWaitingList(null);
    },
  });

  const deleteWaitingListMutation = useMutation({
    mutationFn: (id) => base44.entities.WaitingList.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['waitingList']);
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settingsData) => {
      const promises = Object.entries(settingsData).map(async ([key, value]) => {
        const existingSetting = settings.find(s => s.setting_key === key);
        const settingValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        if (existingSetting) {
          return base44.entities.Settings.update(existingSetting.id, {
            setting_value: settingValue
          });
        } else {
          return base44.entities.Settings.create({
            setting_key: key,
            setting_value: settingValue,
            description: getSettingDescription(key)
          });
        }
      });
      
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
      setShowSettingsDialog(false);
    },
  });

  const getSettingDescription = (key) => {
    const descriptions = {
      'default_capacity': 'Default booking capacity per time slot',
      'time_sessions': 'Available time sessions for bookings',
      'reservation_valid_minutes': 'How long a reservation is valid after booking time',
      'sunday_morning_reserved': 'Number of slots reserved for walk-ins on Sunday morning',
      'friday_prayer_closure': 'Enable closure during Friday prayer time (11:00 AM)',
      'breakfast_menu_text': 'Text to display for breakfast menu availability',
      'halal_code': 'Halal certification code from MUI',
      'custom_time_sessions': 'Custom time sessions for specific date periods'
    };
    return descriptions[key] || '';
  };

  const sendCancellationWhatsApp = async (booking, reason) => {
    try {
      if (!booking.booking_date) {
        console.error("Invalid booking date");
        return;
      }

      const bookingDate = new Date(booking.booking_date);
      if (isNaN(bookingDate.getTime())) {
        console.error("Invalid booking date format");
        return;
      }

      const message = `*Boeba Restaurant - Booking Cancelled*

Dear ${booking.customer_name},

We regret to inform you that your reservation has been cancelled.

📋 *Booking Details:*
━━━━━━━━━━━━━━━━━━━━━━
🔖 Booking Code: *${booking.booking_code}*
📅 Date: ${format(bookingDate, 'EEEE, MMMM d, yyyy')}
🕐 Session: ${booking.time_slot}
👥 Number of People: ${booking.party_size} guests
━━━━━━━━━━━━━━━━━━━━━━

${reason ? `📝 *Reason:* ${reason}\n` : ''}
We apologize for any inconvenience. Please feel free to make a new reservation at your convenience.

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
    try {
      if (!selectedDate || isNaN(selectedDate.getTime())) {
        console.error("Invalid selected date");
        return;
      }
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const timeSessions = getTimeSessions();
      
      // Load existing session capacities for this date
      const existingCapacities = {};
      const defaultCap = getDefaultCapacity();
      
      timeSessions.forEach(session => {
        const existing = sessionCapacitiesData.find(
          sc => sc.date === dateStr && sc.time_slot === session
        );
        existingCapacities[session] = existing?.capacity || defaultCap;
      });
      
      setSessionCapacities(existingCapacities);
      setShowCapacityDialog(true);
    } catch (error) {
      console.error("Error in handleSetCapacity:", error);
    }
  };

  const handleSaveCapacity = async () => {
    try {
      if (!selectedDate || isNaN(selectedDate.getTime())) {
        console.error("Invalid selected date");
        return;
      }
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const timeSessions = getTimeSessions();
      
      // Save each session capacity
      const promises = timeSessions.map(async (session) => {
        const capacity = sessionCapacities[session];
        if (capacity === undefined) return;
        
        const existing = sessionCapacitiesData.find(
          sc => sc.date === dateStr && sc.time_slot === session
        );
        
        if (existing) {
          return updateSessionCapacityMutation.mutateAsync({
            id: existing.id,
            data: { capacity }
          });
        } else {
          return createSessionCapacityMutation.mutateAsync({
            date: dateStr,
            time_slot: session,
            capacity
          });
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error("Error in handleSaveCapacity:", error);
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

  const sendStatusChangeNotification = async (booking, oldStatus, newStatus) => {
    try {
      if (!booking.booking_date) return;

      const bookingDate = new Date(booking.booking_date);
      if (isNaN(bookingDate.getTime())) return;

      let message = '';
      let subject = '';

      if (newStatus === 'confirmed') {
        message = `*Boeba Restaurant - Booking Confirmed!*

  Dear ${booking.customer_name},

  Your table reservation has been confirmed! ✅

  📋 *Booking Details:*
  ━━━━━━━━━━━━━━━━━━━━━━
  🔖 Booking Code: *${booking.booking_code}*
  📅 Date: ${format(bookingDate, 'EEEE, MMMM d, yyyy')}
  🕐 Session: ${booking.time_slot}
  👥 Number of Guests: ${booking.party_size} guests
  ━━━━━━━━━━━━━━━━━━━━━━

  We look forward to serving you!

  *Boeba Team*`;

        subject = `Booking Confirmed - ${booking.booking_code}`;
      } else if (newStatus === 'cancelled') {
        message = `*Boeba Restaurant - Booking Cancelled*

  Dear ${booking.customer_name},

  Your reservation has been cancelled.

  📋 *Booking Details:*
  ━━━━━━━━━━━━━━━━━━━━━━
  🔖 Booking Code: *${booking.booking_code}*
  📅 Date: ${format(bookingDate, 'EEEE, MMMM d, yyyy')}
  🕐 Session: ${booking.time_slot}
  👥 Number of Guests: ${booking.party_size} guests
  ━━━━━━━━━━━━━━━━━━━━━━

  We apologize for any inconvenience.

  *Boeba Team*`;

        subject = `Booking Cancelled - ${booking.booking_code}`;
      } else if (newStatus === 'completed') {
        message = `*Boeba Restaurant - Thank You!*

  Dear ${booking.customer_name},

  Thank you for dining with us! 🙏

  We hope you enjoyed your experience. We'd love to see you again soon!

  *Boeba Team*`;

        subject = `Thank You - ${booking.booking_code}`;
      }

      // Send WhatsApp notification
      if (booking.whatsapp_number && message) {
        await base44.functions.invoke('sendWhatsAppMessage', {
          phoneNumber: booking.whatsapp_number,
          message: message
        });
      }

      // Send email notification
      if (booking.customer_email && message) {
        await base44.integrations.Core.SendEmail({
          from_name: "Boeba Restaurant",
          to: booking.customer_email,
          subject: subject,
          body: message.replace(/\*/g, '').replace(/━/g, '-')
        });
      }
    } catch (error) {
      console.error("Error sending status change notification:", error);
    }
  };

  const handleSaveBooking = async (formData) => {
    const oldStatus = editingBooking?.status;

    if (editingBooking) {
      await updateBookingMutation.mutateAsync({
        id: editingBooking.id,
        data: formData
      });

      // Send notification if status changed
      if (oldStatus && formData.status && oldStatus !== formData.status) {
        const updatedBooking = { ...editingBooking, ...formData };
        await sendStatusChangeNotification(updatedBooking, oldStatus, formData.status);
      }
    } else {
      const bookingCode = `BK${Date.now().toString().slice(-8)}`;
      const newBooking = await createBookingMutation.mutateAsync({
        ...formData,
        booking_code: bookingCode
      });

      // Send confirmation for new bookings
      if (formData.status === 'confirmed') {
        await sendStatusChangeNotification(newBooking, null, 'confirmed');
      }
    }
  };

  const handleSaveWaitingList = async (formData) => {
    if (editingWaitingList) {
      await updateWaitingListMutation.mutateAsync({
        id: editingWaitingList.id,
        data: formData
      });
    } else {
      await createWaitingListMutation.mutateAsync(formData);
    }
  };

  const handleEditWaitingList = (entry) => {
    setEditingWaitingList(entry);
    setShowWaitingListDialog(true);
  };

  const handleDeleteWaitingList = async (id) => {
    if (window.confirm('Are you sure you want to delete this waiting list entry?')) {
      await deleteWaitingListMutation.mutateAsync(id);
    }
  };

  const handleNotifyWaitlistEntry = async (entry) => {
    try {
      const bookingDate = new Date(entry.booking_date);
      const message = `*Boeba Restaurant - A Spot is Available!*

Dear ${entry.customer_name},

Great news! A spot has become available for your requested date and time.

📋 *Your Waitlist Details:*
━━━━━━━━━━━━━━━━━━━━━━
📅 Date: ${format(bookingDate, 'EEEE, MMMM d, yyyy')}
🕐 Session: ${entry.time_slot}
👥 Number of Guests: ${entry.party_size} guests
━━━━━━━━━━━━━━━━━━━━━━

To secure your table, please book now at:
${window.location.origin}/booktable​

Hurry! This spot won't last long.

*Boeba Team*`;

      await base44.functions.invoke('sendWhatsAppMessage', {
        phoneNumber: entry.whatsapp_number,
        message: message
      });

      // Update waitlist status to 'contacted'
      await updateWaitingListMutation.mutateAsync({
        id: entry.id,
        data: { status: 'contacted' }
      });

      alert('Notification sent successfully!');
    } catch (error) {
      console.error("Error notifying waitlist entry:", error);
      alert('Failed to send notification. Please try again.');
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
        const parsed = JSON.parse(sessionsSetting.setting_value);
        // Convert to array of strings (time only)
        return parsed.map(s => typeof s === 'string' ? s : s.time);
      } catch (e) {
        return ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
      }
    }
    return ["11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];
  };

  const getCapacityForSession = (dateStr, timeSlot) => {
    const sessionCap = sessionCapacitiesData.find(
      sc => sc.date === dateStr && sc.time_slot === timeSlot
    );
    return sessionCap?.capacity || getDefaultCapacity();
  };

  const getBookingsForDateAndSession = (dateStr, timeSlot) => {
    return bookings.filter(b => {
      if (b.booking_date !== dateStr || b.status !== 'confirmed') return false;
      
      // Match by start time - booking time_slot can be "09:30 - 11:00" or "09:30 AM"
      // Session timeSlot can be "09:30 AM" or "09:30"
      const bookingStartTime = b.time_slot.split('-')[0].trim();
      const sessionTime = timeSlot.trim();
      
      // Normalize times for comparison (remove AM/PM, spaces)
      const normalizeTime = (time) => {
        return time.replace(/\s+/g, '').toLowerCase().replace('am', '').replace('pm', '');
      };
      
      return normalizeTime(bookingStartTime) === normalizeTime(sessionTime) ||
             bookingStartTime === sessionTime ||
             b.time_slot === timeSlot;
    }).reduce((sum, b) => sum + (b.party_size || 0), 0);
  };

  const getTotalCapacityForDate = (dateStr) => {
    const timeSessions = getTimeSessions();
    return timeSessions.reduce((sum, session) => {
      return sum + getCapacityForSession(dateStr, session);
    }, 0);
  };

  const getTotalBookingsForDate = (dateStr) => {
    return bookings.filter(b => b.booking_date === dateStr && b.status === 'confirmed').length;
  };

  const formatBookingDate = (dateStr, dateFormat = 'MMM d') => {
    try {
      if (!dateStr) return 'N/A';
      const date = parseISO(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, dateFormat);
    } catch (e) {
      console.error("Error formatting date:", dateStr, e);
      return 'Invalid Date';
    }
  };

  const formatSelectedDate = (dateFormat = 'MMMM d, yyyy') => {
    try {
      if (!selectedDate || isNaN(selectedDate.getTime())) {
        return 'Invalid Date';
      }
      return format(selectedDate, dateFormat);
    } catch (e) {
      console.error("Error formatting selected date:", selectedDate, e);
      return 'Invalid Date';
    }
  };

  const getSelectedDateStr = () => {
    try {
      if (!selectedDate || isNaN(selectedDate.getTime())) {
        return '';
      }
      return format(selectedDate, 'yyyy-MM-dd');
    } catch (e) {
      console.error("Error getting selected date string:", selectedDate, e);
      return '';
    }
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      timeSlot: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const filteredBookings = bookings.filter(booking => {
    if (filters.status !== 'all' && booking.status !== filters.status) return false;

    if (filters.dateFrom && booking.booking_date < filters.dateFrom) return false;
    if (filters.dateTo && booking.booking_date > filters.dateTo) return false;

    if (filters.timeSlot !== 'all') {
      const bookingStartTime = booking.time_slot?.split('-')[0]?.trim();
      const filterTime = filters.timeSlot.trim();
      if (bookingStartTime !== filterTime) return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        booking.customer_name?.toLowerCase().includes(searchLower) ||
        booking.booking_code?.toLowerCase().includes(searchLower) ||
        booking.whatsapp_number?.includes(searchLower)
      );
    }
    return true;
  }).sort((a, b) => {
    const key = sortConfig.key;
    let aVal = a[key];
    let bVal = b[key];

    if (key === 'booking_date') {
      aVal = new Date(aVal || 0);
      bVal = new Date(bVal || 0);
    } else if (key === 'party_size') {
      aVal = parseInt(aVal || 0);
      bVal = parseInt(bVal || 0);
    } else if (key === 'customer_name' || key === 'status') {
      aVal = (aVal || '').toLowerCase();
      bVal = (bVal || '').toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
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

  const todayBookings = bookings.filter(
    (b) => b.booking_date === format(new Date(), 'yyyy-MM-dd') && b.status === 'confirmed'
  );

  const upcomingBookings = bookings.filter(
    (b) => {
      try {
        if (!b.booking_date) return false;
        const bookingDate = new Date(b.booking_date);
        if (isNaN(bookingDate.getTime())) return false;
        return bookingDate >= new Date() && b.status === 'confirmed';
      } catch (e) {
        console.error("Error processing booking date:", b.booking_date, e);
        return false;
      }
    }
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-gray-600">Manage bookings and capacity</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowBulkUploadDialog(true)} variant="outline" size="sm" className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-xs sm:text-sm">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Bulk Upload</span>
              <span className="sm:hidden">📤</span>
            </Button>
            <Button onClick={() => setShowSettingsDialog(true)} variant="outline" size="sm" className="text-xs sm:text-sm">
              <SettingsIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">⚙️</span>
            </Button>
            <Button onClick={() => { setEditingWaitingList(null); setShowWaitingListDialog(true); }} variant="outline" size="sm" className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-xs sm:text-sm">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Waiting List</span>
              <span className="sm:hidden">⏳</span>
            </Button>
            <Button onClick={() => { setEditingBooking(null); setShowBookingDialog(true); }} size="sm" className="bg-teal-600 hover:bg-teal-700 text-xs sm:text-sm">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">New Booking</span>
              <span className="sm:hidden">📝</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Today's Bookings</CardTitle>
              <CalendarIcon className="w-4 h-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{todayBookings.length}</div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Upcoming</CardTitle>
              <TrendingUp className="w-4 h-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{upcomingBookings.length}</div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Bookings</CardTitle>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Default Capacity</CardTitle>
              <Users className="w-4 h-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{getDefaultCapacity()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 space-y-4">
          {/* View Mode Toggle */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              className={viewMode === 'list' ? 'bg-teal-600 hover:bg-teal-700' : ''}
            >
              List View
            </Button>
            <Button
              onClick={() => setViewMode('calendar')}
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              className={viewMode === 'calendar' ? 'bg-teal-600 hover:bg-teal-700' : ''}
            >
              Calendar View
            </Button>
          </div>

          {viewMode === 'calendar' ? (
            <BookingCalendarFull
              bookings={bookings}
              capacities={capacities}
              sessionCapacities={sessionCapacitiesData}
              settings={settings}
              onDateClick={(date) => {
                setModalSelectedDate(date);
                setShowDateModal(true);
              }}
            />
          ) : (
            <BookingCalendarView
              bookings={bookings}
              capacities={capacities}
              sessionCapacities={sessionCapacitiesData}
              settings={settings}
              onDateClick={(date) => {
                setSelectedDate(date);
                setFilters({ ...filters, dateFrom: format(date, 'yyyy-MM-dd'), dateTo: format(date, 'yyyy-MM-dd') });
              }}
            />
          )}
        </div>

        <div className="mb-6">
          <BookingFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
            timeSessions={getTimeSessions()}
          />
        </div>

        <div className="mb-6">
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader>
              <CardTitle>
                Bookings {filters.search || filters.status !== 'all' || filters.date ? 
                  `(${filteredBookings.length} filtered)` : 
                  `(${bookings.length} total)`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('customer_name')}
                      >
                        Name {getSortIcon('customer_name')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('booking_date')}
                      >
                        Date {getSortIcon('booking_date')}
                      </TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('party_size')}
                      >
                        Guests {getSortIcon('party_size')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('status')}
                      >
                        Status {getSortIcon('status')}
                      </TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.slice(0, 20).map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-sm">{booking.booking_code}</TableCell>
                        <TableCell>{booking.customer_name}</TableCell>
                        <TableCell>{formatBookingDate(booking.booking_date)}</TableCell>
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
                        <TableCell className="max-w-xs truncate text-xs text-gray-600">
                          {booking.notes || '-'}
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

        {/* Waiting List Section */}
        <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-amber-200/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              Waiting List ({waitingList.filter(w => w.status === 'waiting' && w.booking_date >= format(new Date(), 'yyyy-MM-dd')).length} waiting)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const upcomingWaitlist = waitingList.filter(entry => entry.booking_date >= today);
                    
                    if (upcomingWaitlist.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                            No waiting list entries for today or upcoming dates
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return upcomingWaitlist.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.customer_name}</TableCell>
                        <TableCell>{entry.whatsapp_number}</TableCell>
                        <TableCell>{formatBookingDate(entry.booking_date)}</TableCell>
                        <TableCell>{entry.time_slot}</TableCell>
                        <TableCell>{entry.party_size}</TableCell>
                        <TableCell>
                          <Badge className={
                            entry.status === 'waiting' 
                              ? 'bg-amber-100 text-amber-800'
                              : entry.status === 'contacted'
                              ? 'bg-blue-100 text-blue-800'
                              : entry.status === 'booked'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }>
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{entry.notes}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {entry.status === 'waiting' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNotifyWaitlistEntry(entry)}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Notify customer about availability"
                              >
                                <Bell className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditWaitingList(entry)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteWaitingList(entry.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Set Capacity for {formatSelectedDate()}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {getTimeSessions().map((session) => {
              const dateStr = getSelectedDateStr();
              const booked = getBookingsForDateAndSession(dateStr, session);
              const currentCapacity = sessionCapacities[session] ?? getCapacityForSession(dateStr, session);
              
              return (
                <div key={session} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">{session}</Label>
                    <span className="text-sm text-gray-600">
                      Current bookings: <strong>{booked}</strong>
                    </span>
                  </div>
                  <Input
                    type="number"
                    value={currentCapacity}
                    onChange={(e) => setSessionCapacities({
                      ...sessionCapacities,
                      [session]: parseInt(e.target.value) || 0
                    })}
                    min={booked}
                    className="w-full"
                  />
                  {currentCapacity < booked && (
                    <p className="text-sm text-red-600">
                      ⚠️ Capacity cannot be less than current bookings ({booked})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapacityDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCapacity}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={createSessionCapacityMutation.isPending || updateSessionCapacityMutation.isPending}
            >
              Save All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <p><strong>Date:</strong> {formatBookingDate(selectedBooking.booking_date, 'MMM d, yyyy')}</p>
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

      <ManualBookingDialog
        open={showBookingDialog}
        onOpenChange={setShowBookingDialog}
        onSave={handleSaveBooking}
        booking={editingBooking}
        timeSessions={getTimeSessions()}
      />

      <WaitingListDialog
        open={showWaitingListDialog}
        onOpenChange={setShowWaitingListDialog}
        onSave={handleSaveWaitingList}
        waitingListEntry={editingWaitingList}
        timeSessions={getTimeSessions()}
      />

      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <BulkUploadDialog
        open={showBulkUploadDialog}
        onOpenChange={setShowBulkUploadDialog}
      />

      <DateBookingsModal
        open={showDateModal}
        onOpenChange={setShowDateModal}
        selectedDate={modalSelectedDate}
        bookings={bookings}
        sessionCapacities={sessionCapacitiesData}
        capacities={capacities}
        settings={settings}
        onEditBooking={handleEditBooking}
        onCancelBooking={handleCancelBooking}
        onCreateBooking={handleSaveBooking}
      />
      </div>
      );
      }