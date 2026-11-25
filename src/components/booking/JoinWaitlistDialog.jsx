import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Users, CheckCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function JoinWaitlistDialog({ 
  open, 
  onOpenChange, 
  selectedDate, 
  selectedTimeSlot 
}) {
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    partySize: 2
  });
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const formatWhatsAppNumber = (number) => {
    let formatted = number.replace(/[\s\-\(\)\+]/g, '');
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substring(1);
    }
    return formatted;
  };

  const createWaitlistMutation = useMutation({
    mutationFn: (data) => base44.entities.WaitingList.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['waitingList']);
      setSuccess(true);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    await createWaitlistMutation.mutateAsync({
      customer_name: formData.name,
      whatsapp_number: formatWhatsAppNumber(formData.whatsapp),
      booking_date: selectedDate,
      time_slot: selectedTimeSlot,
      party_size: formData.partySize,
      status: 'waiting',
      notes: ''
    });
  };

  const handleClose = () => {
    setFormData({ name: '', whatsapp: '', partySize: 2 });
    setSuccess(false);
    onOpenChange(false);
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              You're on the Waitlist!
            </h3>
            <p className="text-gray-600 mb-4">
              We'll notify you via WhatsApp if a spot becomes available for:
            </p>
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200 mb-4">
              <p className="font-semibold text-teal-900">
                {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-teal-700">{selectedTimeSlot}</p>
            </div>
            <Button onClick={handleClose} className="bg-teal-600 hover:bg-teal-700">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Join Waitlist
          </DialogTitle>
          <DialogDescription>
            This session is fully booked. Join our waitlist and we'll notify you if a spot opens up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <p className="text-sm font-medium text-amber-900">
              {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-amber-700">{selectedTimeSlot}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Your Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp Number *</Label>
            <Input
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="08123456789"
              required
            />
            <p className="text-xs text-gray-500">We'll notify you via WhatsApp if a spot opens</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partySize">Number of Guests *</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setFormData({ ...formData, partySize: Math.max(1, formData.partySize - 1) })}
              >
                -
              </Button>
              <span className="w-12 text-center text-lg font-semibold">{formData.partySize}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setFormData({ ...formData, partySize: Math.min(20, formData.partySize + 1) })}
              >
                +
              </Button>
              <Users className="w-4 h-4 text-gray-400 ml-2" />
            </div>
          </div>

          {createWaitlistMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Failed to join waitlist. Please try again.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-amber-600 hover:bg-amber-700"
              disabled={createWaitlistMutation.isPending || !formData.name || !formData.whatsapp}
            >
              {createWaitlistMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Waitlist'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}