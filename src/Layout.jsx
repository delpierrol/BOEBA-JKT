import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, ClipboardCheck, List, QrCode, LayoutDashboard, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const isAdmin = user?.role === 'admin';

      // Backend pages that should show sidebar - use URL path instead of prop
      const backendPages = ['dashboard', 'checkin', 'qrscanner'];
      const currentPath = location.pathname.split('/').filter(Boolean)[0] || '';
      const isBackendPage = backendPages.includes(currentPath.toLowerCase());

      const navItems = [
        ...(isAdmin ? [{ 
          path: "Dashboard", 
          icon: LayoutDashboard, 
          label: "Dashboard",
          adminOnly: true 
        }] : []),
        { 
          path: "CheckIn", 
          icon: ClipboardCheck, 
          label: "Check-In" 
        },
        { 
          path: "QRScanner", 
          icon: QrCode, 
          label: "QR Scanner" 
        }
      ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Public/frontend pages without sidebar
  if (!isBackendPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-teal-200/50 shadow-lg transition-all duration-300 flex flex-col fixed h-full z-40`}>
        {/* Logo Section */}
        <div className="p-4 border-b border-teal-200/50">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Boeba" 
              className="w-10 h-10 rounded-full"
            />
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-base font-bold text-gray-900">Boeba</h1>
                <p className="text-xs text-teal-600">{isAdmin ? 'Admin' : 'Staff'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === createPageUrl(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={createPageUrl(item.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-gray-700 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Collapse Button */}
        <div className="p-4 border-t border-teal-200/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300`}>
        {children}
      </main>
    </div>
  );
}