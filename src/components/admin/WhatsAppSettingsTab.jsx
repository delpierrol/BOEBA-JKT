import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Loader2,
  LogOut,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  WifiOff,
} from 'lucide-react';

export default function WhatsAppSettingsTab({ active }) {
  const [statusData, setStatusData] = useState(null);
  const [lastQrUpdated, setLastQrUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState('');

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const data = await base44.whatsapp.status();
      setStatusData((prev) => {
        if (data?.qrcode && data.qrcode !== prev?.qrcode) {
          setLastQrUpdated(new Date().toLocaleTimeString());
        }
        return data;
      });
    } catch (err) {
      setError(err.message || 'Gagal mengambil status WPPConnect');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      fetchStatus();
    }
  }, [active, fetchStatus]);

  // Auto-poll every 2 seconds while waiting for QR scan or initializing (rotates QR automatically like WA Web)
  useEffect(() => {
    if (!active || !statusData) return;
    if (statusData.status === 'QRCODE' || statusData.status === 'INITIALIZING') {
      const timer = setInterval(() => {
        fetchStatus(true);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [active, statusData, fetchStatus]);

  const handleStartSession = async () => {
    setIsStarting(true);
    setError('');
    try {
      const data = await base44.whatsapp.start();
      setStatusData(data);
      if (data?.qrcode) {
        setLastQrUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      setError(err.message || 'Gagal memulai sesi WhatsApp');
    } finally {
      setIsStarting(false);
    }
  };

  const handleLogout = async () => {
    setIsDisconnecting(true);
    setError('');
    try {
      await base44.whatsapp.logout();
      await fetchStatus(true);
    } catch (err) {
      setError(err.message || 'Gagal memutus sesi WhatsApp');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setIsSendingTest(true);
    setTestResult('');
    setError('');
    try {
      await base44.whatsapp.sendTest(
        testPhone.trim(),
        'Test pesan dari Boeba JKT Reservation System. Koneksi WhatsApp aktif!'
      );
      setTestResult('Pesan test berhasil dikirim!');
    } catch (err) {
      setError(err.message || 'Gagal mengirim pesan test');
    } finally {
      setIsSendingTest(false);
    }
  };

  const isConnected = statusData?.connected;
  const statusText = statusData?.status || 'UNKNOWN';

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">WPPConnect WhatsApp Session</h3>
          </div>
          <p className="text-xs text-gray-500">
            Session: <span className="font-mono font-medium text-gray-700">{statusData?.session || '-'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge className="bg-green-100 text-green-800 border-green-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </Badge>
          ) : statusText === 'QRCODE' || statusText === 'INITIALIZING' ? (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" /> {statusText}
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex items-center gap-1">
              <WifiOff className="w-3.5 h-3.5" /> {statusText}
            </Badge>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchStatus()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs break-all">{error}</AlertDescription>
        </Alert>
      )}

      {!isConnected && (
        <div className="p-5 border rounded-lg bg-white text-center space-y-4">
          {statusData?.qrcode ? (
            <>
              <p className="text-sm font-medium text-gray-800">
                Scan QR Code ini dari aplikasi WhatsApp (Perangkat Tertaut / Linked Devices)
              </p>
              <div className="inline-block p-3 bg-white border-2 border-teal-200 rounded-xl shadow-sm">
                <img
                  src={statusData.qrcode}
                  alt="WPPConnect QR Code"
                  className="w-60 h-60 object-contain mx-auto"
                />
              </div>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                QR otomatis diperbarui tiap 2 detik{lastQrUpdated ? ` (update terakhir: ${lastQrUpdated})` : ''}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStartSession}
                disabled={isStarting}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isStarting ? 'animate-spin' : ''}`} />
                Generate Ulang QR Code
              </Button>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600">
                Sesi WhatsApp saat ini tidak aktif. Klik tombol di bawah untuk memulai sesi dan menampilkan QR Code.
              </p>
              <Button
                type="button"
                onClick={handleStartSession}
                disabled={isStarting}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Connect &amp; Show QR Code
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {isConnected && (
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-green-50/70 border-green-200 space-y-3">
            <Label htmlFor="wa-test-phone" className="text-sm font-semibold text-green-900">
              Kirim Pesan Test WhatsApp
            </Label>
            <form onSubmit={handleSendTest} className="flex gap-2">
              <Input
                id="wa-test-phone"
                type="text"
                placeholder="08118306639"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="bg-white"
              />
              <Button
                type="submit"
                disabled={isSendingTest || !testPhone.trim()}
                className="bg-teal-600 hover:bg-teal-700 shrink-0"
              >
                {isSendingTest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" /> Test
                  </>
                )}
              </Button>
            </form>
            {testResult && <p className="text-xs font-medium text-green-700">{testResult}</p>}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isDisconnecting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-1.5" />
              )}
              Disconnect WhatsApp Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
