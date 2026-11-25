import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  QrCode,
  Hash,
  User,
  Calendar,
  Clock,
  Users
} from "lucide-react";
import { format, parse, isSameDay, subHours } from "date-fns"; // Added parse, isSameDay, subHours

export default function QRScanner() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState(null); // { success: boolean, message: string, booking?: object }
  const [error, setError] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null); // Full booking object for display
  const [barcodeDetectorAvailable, setBarcodeDetectorAvailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

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
        console.error("Authorization error:", error); // Added console.error
        setIsAuthorized(false);
      } finally {
        setIsCheckingAuth(false); // Kept setIsCheckingAuth for consistency
      }
    };

    checkAuth();

    // Check if BarcodeDetector is supported
    if ('BarcodeDetector' in window) {
      setBarcodeDetectorAvailable(true);
      console.log("BarcodeDetector is supported");
    } else {
      console.log("BarcodeDetector not supported");
      setBarcodeDetectorAvailable(false);
    }

    return () => {
      stopScanning();
    };
  }, []);

  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
    },
  });

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.pathname);
  };

  const startScanning = async () => {
    try {
      setError(null);
      setScanResult(null);
      setBookingDetails(null); // Clear previous booking details

      console.log("Starting camera...");

      // Check if BarcodeDetector is available
      if (!('BarcodeDetector' in window)) {
        setError("QR Code scanning is not supported on this browser. Please use Chrome, Edge, or Samsung Internet browser, or use manual input below.");
        return;
      }
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log("Camera stream obtained:", stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setScanning(true);
        
        console.log("Video element setup complete");
        
        // Wait for video to load and start playing
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          videoRef.current.play()
            .then(() => {
              console.log("Video playing successfully");
              
              // Start scanning loop after video starts
              scanIntervalRef.current = setInterval(() => {
                scanQRCode();
              }, 500);
            })
            .catch(playErr => {
              console.error("Error playing video:", playErr);
              setError("Failed to start camera preview. Please try again.");
              stopScanning();
            });
        };
        
        // Fallback: try to play immediately
        setTimeout(() => {
          if (videoRef.current && videoRef.current.paused) {
            console.log("Attempting fallback play");
            videoRef.current.play().catch(e => console.error("Fallback play failed:", e));
          }
        }, 500);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      
      let errorMessage = "Unable to access camera. ";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage += "Camera permission denied. Please allow camera access and try again.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage += "No camera found on this device.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage += "Camera is already in use by another application.";
      } else {
        errorMessage += "Please check permissions or use manual input.";
      }
      
      setError(errorMessage);
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const scanQRCode = async () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    try {
      // Use BarcodeDetector API
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await barcodeDetector.detect(video);
        
        if (barcodes.length > 0) {
          console.log("QR Code detected:", barcodes[0].rawValue);
          handleQRCodeDetected(barcodes[0].rawValue);
        }
      }
    } catch (err) {
      console.error("Error scanning QR code:", err);
    }
  };

  // Helper to parse time slots more robustly
  const parseTimeSlot = (slot) => {
    try {
      const timeStr = slot.split('-')[0].trim();
      let parsed;
      
      // Try 'h:mm a' (e.g., 1:00 PM)
      parsed = parse(timeStr, 'h:mm a', new Date());
      if (!isNaN(parsed.getTime())) return parsed;
      
      // Try 'HH:mm' (e.g., 13:00)
      parsed = parse(timeStr, 'HH:mm', new Date());
      if (!isNaN(parsed.getTime())) return parsed;

      // Try 'H:mm' (e.g., 1:00)
      parsed = parse(timeStr, 'H:mm', new Date());
      if (!isNaN(parsed.getTime())) return parsed;

      // Try 'hh:mm a' (e.g., 01:00 PM)
      parsed = parse(timeStr, 'hh:mm a', new Date());
      if (!isNaN(parsed.getTime())) return parsed;

      return null;
    } catch (e) {
      console.error("Error parsing time slot:", e);
      return null;
    }
  };

  const canScanBooking = (booking) => {
    try {
      // Check if booking date is today
      const bookingDate = new Date(booking.booking_date);
      const today = new Date();
      
      if (!isSameDay(bookingDate, today)) {
        return {
          valid: false,
          reason: `This booking is for ${format(bookingDate, 'MMM d, yyyy')}. QR codes can only be scanned on the booking date.`
        };
      }

      // Parse the time slot
      const slotTime = parseTimeSlot(booking.time_slot);
      if (!slotTime) {
        return { valid: false, reason: 'Invalid time slot format. Please contact staff.' };
      }

      // Create the session datetime for today
      const sessionDateTime = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        slotTime.getHours(),
        slotTime.getMinutes(),
        0
      );

      const now = new Date();
      const oneHourBefore = subHours(sessionDateTime, 1);

      // Check if we're within the 1-hour window before the session (or after, up to session start)
      if (now < oneHourBefore) {
        const minutesUntil = Math.floor((oneHourBefore - now) / 60000);
        return {
          valid: false,
          reason: `Check-in opens 1 hour before your session. Please return in ${minutesUntil} minutes (at ${format(oneHourBefore, 'h:mm a')}).`
        };
      }

      // Check if session has already started (allow check-in up to session time)
      if (now > sessionDateTime) {
        return {
          valid: false,
          reason: `Your session started at ${format(sessionDateTime, 'h:mm a')}. Please contact staff for assistance.`
        };
      }

      return { valid: true };
    } catch (error) {
      console.error("Error validating scan time:", error);
      return { valid: false, reason: 'Error validating booking time. Please try again.' };
    }
  };

  const processBooking = async (code) => { // Renamed from processBookingCode
    setIsProcessing(true);
    setError(null);
    setScanResult(null);
    setBookingDetails(null);

    try {
      const bookings = await base44.entities.Booking.filter({ booking_code: code });

      if (bookings.length === 0) {
        setError("Booking not found. Please check the code and try again.");
        setIsProcessing(false);
        return;
      }

      const booking = bookings[0];

      if (booking.status === 'cancelled') {
        setError("This booking has been cancelled and cannot be checked in.");
        setIsProcessing(false);
        return;
      }

      if (booking.status === 'completed') {
        setBookingDetails(booking); // Show details for already completed booking
        setScanResult({ success: true, message: "This booking has already been checked in!", booking: booking });
        setIsProcessing(false);
        return;
      }

      // Validate scan timing
      const scanValidation = canScanBooking(booking);
      if (!scanValidation.valid) {
        setError(scanValidation.reason);
        setIsProcessing(false);
        return;
      }

      // Update to completed
      await updateBookingMutation.mutateAsync({
        id: booking.id,
        data: { status: 'completed' }
      });

      // Update booking details for display (with new status)
      const updatedBooking = { ...booking, status: 'completed' };
      setBookingDetails(updatedBooking);
      setScanResult({
        success: true,
        message: "Check-in successful! Welcome to Boeba Restaurant.",
        booking: updatedBooking
      });

      setManualCode(""); // Clear manual code on success
    } catch (error) {
      console.error("Error processing booking:", error);
      setError("Failed to process booking. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQRCodeDetected = async (qrData) => {
    stopScanning();
    await processBooking(qrData); // Call the updated processBooking
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    await processBooking(manualCode); // Call the updated processBooking
  };

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    setBookingDetails(null);
    setManualCode("");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-3">
            <img 
              src="/logo.png" 
              alt="Boeba" 
              className="w-12 h-12 md:w-16 md:h-16 rounded-full shadow-lg"
            />
            <div className="text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">QR Scanner</h1>
              <p className="text-sm md:text-base text-gray-600">Scan booking QR codes to check-in</p>
            </div>
          </div>
        </div>

        {/* Loading Modal */}
        <Dialog open={isProcessing}>
          <DialogContent className="sm:max-w-md">
            <div className="flex flex-col items-center justify-center p-6">
              <div className="relative mb-6">
                <div className="w-20 h-20 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="w-10 h-10 text-teal-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Check-In</h3>
              <p className="text-sm text-gray-600 text-center">
                Please wait while we verify and complete the booking...
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Browser Compatibility Notice */}
        {!barcodeDetectorAvailable && (
          <Alert className="mb-6 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>QR scanning not available on this browser.</strong> Please use Chrome, Edge, or Samsung Internet for camera scanning, or use manual input below.
            </AlertDescription>
          </Alert>
        )}

        {/* Success Result */}
        {scanResult && scanResult.success && (
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-green-200/50 mb-6">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">{scanResult.message || "Check-In Successful!"}</h2>
              <p className="text-center text-green-50">Guest has been checked in</p>
            </div>
            <CardContent className="p-4 md:p-6">
              {bookingDetails && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                    <div>
                      <p className="text-gray-600 flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Booking Code
                      </p>
                      <p className="font-semibold">{bookingDetails.booking_code}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Customer
                      </p>
                      <p className="font-semibold">{bookingDetails.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                      </p>
                      <p className="font-semibold">
                        {format(new Date(bookingDetails.booking_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time
                      </p>
                      <p className="font-semibold">{bookingDetails.time_slot}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Guests
                      </p>
                      <p className="font-semibold">{bookingDetails.party_size} people</p>
                    </div>
                  </div>
                </div>
              )}
              <Button 
                onClick={handleReset}
                className="w-full mt-4 md:mt-6 bg-teal-600 hover:bg-teal-700 h-10 md:h-12 text-sm md:text-base"
              >
                Scan Next Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Scanner Card */}
        {!scanResult && (
          <Card style={{ backgroundColor: '#fffffd' }} className="backdrop-blur-sm border-teal-200/50">
            <CardHeader className="border-b border-teal-100 p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <QrCode className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
                Scan QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {/* Camera Scanner */}
              <div className="mb-4">
                <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-3 w-full" style={{ height: '280px', maxHeight: '400px' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: scanning ? 'block' : 'none'
                    }}
                  />
                  {scanning && (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 md:w-64 md:h-64 border-4 border-teal-500 rounded-lg shadow-lg animate-pulse"></div>
                      </div>
                      <div className="absolute bottom-2 md:bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm">
                        Position QR code within frame
                      </div>
                    </>
                  )}
                  {!scanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 px-4">
                      <Camera className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4" />
                      <p className="text-xs md:text-sm text-center">Camera preview will appear here</p>
                      <p className="text-xs mt-2 text-gray-500 text-center">
                        {barcodeDetectorAvailable 
                          ? "Make sure to allow camera access" 
                          : "QR scanning requires Chrome/Edge browser"}
                      </p>
                    </div>
                  )}
                </div>

                {!scanning ? (
                  <Button 
                    onClick={startScanning}
                    disabled={!barcodeDetectorAvailable}
                    className="w-full bg-teal-600 hover:bg-teal-700 h-10 md:h-12 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                    {barcodeDetectorAvailable ? "Start Camera" : "Camera Not Supported"}
                  </Button>
                ) : (
                  <Button 
                    onClick={stopScanning}
                    variant="outline"
                    className="w-full border-2 border-teal-200 h-10 md:h-12 text-sm md:text-base"
                  >
                    Stop Camera
                  </Button>
                )}
              </div>

              {/* Manual Input */}
              <div className="pt-4 md:pt-6 border-t border-gray-200">
                <p className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3 text-center">
                  Or enter booking code manually
                </p>
                <form onSubmit={handleManualSubmit} className="space-y-2 md:space-y-3">
                  <div>
                    <Label htmlFor="manual-code" className="sr-only">Booking Code</Label>
                    <Input
                      id="manual-code"
                      type="text"
                      placeholder="e.g., BK12345678"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      className="text-center text-base md:text-lg font-mono h-10 md:h-12"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!manualCode || updateBookingMutation.isPending || isProcessing}
                    className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 h-10 md:h-12 text-sm md:text-base"
                  >
                    {updateBookingMutation.isPending || isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 md:w-5 md:h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                        Check In
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}