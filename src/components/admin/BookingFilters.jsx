import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BookingFilters({ filters, onFiltersChange, onClearFilters, timeSessions = [] }) {
  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.timeSlot !== 'all';

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-teal-200/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-4 h-4 text-teal-600" />
            Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="text-xs text-gray-600 hover:text-gray-900"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm">Search Customer</Label>
            <Input
              id="search"
              placeholder="Name, code, or phone..."
              value={filters.search || ''}
              onChange={(e) => handleChange('search', e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm">Status</Label>
            <Select value={filters.status || 'all'} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger id="status" className="h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeSlot" className="text-sm">Time Slot</Label>
            <Select value={filters.timeSlot || 'all'} onValueChange={(value) => handleChange('timeSlot', value)}>
              <SelectTrigger id="timeSlot" className="h-9">
                <SelectValue placeholder="All Sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                {timeSessions.map((session) => (
                  <SelectItem key={session} value={session}>{session}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateFrom" className="text-sm">Date From</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleChange('dateFrom', e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2 md:col-start-2 lg:col-start-auto">
            <Label htmlFor="dateTo" className="text-sm">Date To</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleChange('dateTo', e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}