import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from "lucide-react";

export default function BulkUploadDialog({ open, onOpenChange }) {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      
      if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setUploadStatus(null);
        setResults(null);
      } else {
        setUploadStatus({ type: 'error', message: 'Please upload a valid Excel or CSV file' });
        setFile(null);
      }
    }
  };

  const formatWhatsAppNumber = (number) => {
    if (!number) return null;
    let formatted = String(number).replace(/[\s\-\(\)\+]/g, '');
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    return formatted;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''));
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  const getTimeSessions = () => {
    const settings = queryClient.getQueryData(['settings']) || [];
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

  const convertToTimeRange = (startTime) => {
    const timeSessions = getTimeSessions();
    const currentIndex = timeSessions.indexOf(startTime.trim());
    
    if (currentIndex !== -1 && currentIndex < timeSessions.length - 1) {
      const nextSession = timeSessions[currentIndex + 1];
      return `${startTime.trim()} - ${nextSession}`;
    }
    
    return startTime.trim();
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setUploadStatus({ type: 'info', message: 'Reading file...' });

    try {
      // Read file content
      const text = await file.text();
      
      setUploadStatus({ type: 'info', message: 'Parsing data...' });

      // Parse CSV
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        throw new Error('No data found in file');
      }

      // Transform to booking format
      const bookingsData = parsedData.map(row => ({
        name: row.name || row.customer_name,
        email: row.email || row.customer_email || null,
        whatsapp: row.whatsapp || row.whatsapp_number || null,
        date: row.date || row.booking_date,
        session: row.session || row.time_slot,
        number_of_people: parseInt(row.number_of_people || row.party_size || '0')
      })).filter(b => b.name && b.date && b.session && b.number_of_people > 0);
      
      setUploadStatus({ type: 'info', message: `Creating ${bookingsData.length} bookings...` });

      // Create bookings
      const createdBookings = [];
      const errors = [];

      for (const booking of bookingsData) {
        try {
          const bookingCode = `BK${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          
          // Convert session to time range if it's just a start time
          let timeSlot = booking.session;
          if (!timeSlot.includes('-')) {
            timeSlot = convertToTimeRange(timeSlot);
          }
          
          await base44.entities.Booking.create({
            booking_code: bookingCode,
            customer_name: booking.name,
            customer_email: booking.email || null,
            whatsapp_number: formatWhatsAppNumber(booking.whatsapp) || null,
            booking_date: booking.date,
            time_slot: timeSlot,
            party_size: booking.number_of_people,
            status: "confirmed"
          });

          createdBookings.push(booking.name);
        } catch (error) {
          errors.push({ name: booking.name, error: error.message });
        }
      }

      queryClient.invalidateQueries(['bookings']);

      setResults({
        success: createdBookings.length,
        failed: errors.length,
        errors
      });

      if (errors.length === 0) {
        setUploadStatus({ 
          type: 'success', 
          message: `Successfully created ${createdBookings.length} bookings!` 
        });
      } else {
        setUploadStatus({ 
          type: 'warning', 
          message: `Created ${createdBookings.length} bookings, ${errors.length} failed` 
        });
      }

    } catch (error) {
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Failed to process file' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadStatus(null);
    setResults(null);
    setIsProcessing(false);
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const csvContent = "name,email,whatsapp(62811xxx),date(YYYY-MM-DD),session,number_of_people\nJohn Doe,john@example.com,`6281234567890,2025-01-15,11:00,4\nJane Smith,,`6282345678901,2025-01-16,18:00,2";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_booking_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            Bulk Upload Reservations
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              Upload an Excel or CSV file with columns: <strong>name</strong>, <strong>email</strong> (optional), 
              <strong>whatsapp</strong> (optional), <strong>date</strong> (YYYY-MM-DD), <strong>session</strong>, 
              <strong>number_of_people</strong>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="text-xs"
            >
              <Download className="w-3 h-3 mr-2" />
              Download Template
            </Button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-teal-400 transition-colors">
            <input
              type="file"
              id="bulk-upload-file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
            <label
              htmlFor="bulk-upload-file"
              className={`cursor-pointer ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                {file ? file.name : 'Click to select Excel or CSV file'}
              </p>
              <p className="text-xs text-gray-500">
                Supported formats: .xlsx, .xls, .csv
              </p>
            </label>
          </div>

          {uploadStatus && (
            <Alert className={
              uploadStatus.type === 'success' ? 'bg-green-50 border-green-200' :
              uploadStatus.type === 'error' ? 'bg-red-50 border-red-200' :
              uploadStatus.type === 'warning' ? 'bg-amber-50 border-amber-200' :
              'bg-blue-50 border-blue-200'
            }>
              {uploadStatus.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {uploadStatus.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
              {uploadStatus.type === 'warning' && <AlertCircle className="h-4 w-4 text-amber-600" />}
              {uploadStatus.type === 'info' && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
              <AlertDescription className={
                uploadStatus.type === 'success' ? 'text-green-800' :
                uploadStatus.type === 'error' ? 'text-red-800' :
                uploadStatus.type === 'warning' ? 'text-amber-800' :
                'text-blue-800'
              }>
                {uploadStatus.message}
              </AlertDescription>
            </Alert>
          )}

          {results && results.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-2">Failed bookings:</p>
              {results.errors.map((err, idx) => (
                <p key={idx} className="text-xs text-red-700">
                  • {err.name}: {err.error}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Close
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || isProcessing}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & Create
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}