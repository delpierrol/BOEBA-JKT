/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDashboard from './pages/AdminDashboard';
import BookTable from './pages/BookTable';
import BookingDetails from './pages/BookingDetails';
import CheckIn from './pages/CheckIn';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import ModifyBooking from './pages/ModifyBooking';
import OrderList from './pages/OrderList';
import QRScanner from './pages/QRScanner';
import Reschedule from './pages/Reschedule';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "BookTable": BookTable,
    "BookingDetails": BookingDetails,
    "CheckIn": CheckIn,
    "Dashboard": Dashboard,
    "Home": Home,
    "ModifyBooking": ModifyBooking,
    "OrderList": OrderList,
    "QRScanner": QRScanner,
    "Reschedule": Reschedule,
}

export const pagesConfig = {
    mainPage: "BookTable",
    Pages: PAGES,
    Layout: __Layout,
};