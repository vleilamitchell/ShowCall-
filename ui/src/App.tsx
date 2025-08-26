import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from "@/components/theme-provider";
import { LoginForm } from '@/components/login-form';
import { Navbar } from '@/components/navbar';
import { AppSidebar } from '@/components/appSidebar';
import { ConnectionStatus } from '@/components/connection-status';
import { Home } from '@/pages/Home';
import { Settings } from '@/pages/Settings';
import Events from '@/pages/Events';
import EventsRecurring from '@/pages/EventsRecurring';
import Departments from '@/pages/Departments';
import Contacts from '@/pages/Contacts';
import Areas from '@/pages/Areas';
import Inventory from '@/pages/Inventory';
import Employees from '@/pages/Employees';
import Scheduling from '@/pages/Scheduling';
// Inventory UI removed
import InventoryAssetsTable from '@/pages/InventoryAssetsTable';
import EventsCalendar from '@/pages/EventsCalendar';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"></div>;
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col w-full min-h-screen bg-background">
        <Navbar />
        {!user ? (
          <main className="flex flex-col items-center justify-center flex-1 p-4">
            <LoginForm />
          </main>
        ) : (
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset className="flex-1">
              <main className="flex-1 routeFadeWrapper">
                <div key={(location.pathname.split('/')[1] || 'root')} className="routeFadeItem">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/recurring" element={<EventsRecurring />} />
                    <Route path="/events/recurring/:seriesId" element={<EventsRecurring />} />
                    <Route path="/events/calendar" element={<EventsCalendar />} />
                    <Route path="/events/:eventId" element={<Events />} />
                    {null}
                    <Route path="/scheduling" element={<Scheduling />} />
                    <Route path="/scheduling/:shiftId" element={<Scheduling />} />
                    <Route path="/departments" element={<Departments />} />
                    <Route path="/departments/:departmentId" element={<Departments />} />
                    <Route path="/departments/:departmentId/scheduling" element={<Scheduling />} />
                    <Route path="/departments/:departmentId/scheduling/:shiftId" element={<Scheduling />} />
                    <Route path="/departments/:departmentId/employees" element={<Employees />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/employees/:employeeId" element={<Employees />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/inventory/assets" element={<InventoryAssetsTable />} />
                    <Route path="/inventory/:itemId" element={<Inventory />} />
                    <Route path="/areas" element={<Areas />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/contacts/:contactId" element={<Contacts />} />
                    <Route path="/areas/:areaId" element={<Areas />} />
                  </Routes>
                </div>
              </main>
              <ConnectionStatus />
            </SidebarInset>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        storageKey="volo-app-theme"
      >
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
