import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AgentsPage from './pages/Agents';
import AIOperationsPage from './pages/AIOperations';
import AnalyticsPage from './pages/Analytics';
import LoginPage from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import OrdersPage from './pages/Orders';
import TrackingPage from './pages/Tracking';
import { AgentDashboardPage, AgentMapPage, ExceptionsPage, NotificationsPage, ProfilePage } from './pages/UtilityPages';

function ProtectedLayout() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content"><Outlet /></main>
    </div>
  );
}

function ManagerOnly() {
  const { user } = useAuth();
  return user?.role === 'manager' || user?.role === 'admin'
    ? <Outlet />
    : <Navigate to="/orders" replace />;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'agent' ? '/orders' : '/dashboard'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="agent-dashboard" element={<AgentDashboardPage />} />
            <Route path="agent-map" element={<AgentMapPage />} />
            <Route path="dashboard" element={<ManagerOnly />}>
              <Route index element={<ManagerDashboard />} />
            </Route>
            <Route path="agents" element={<ManagerOnly />}>
              <Route index element={<AgentsPage />} />
            </Route>
            <Route path="dispatch" element={<ManagerOnly />}>
              <Route index element={<OrdersPage />} />
            </Route>
            <Route path="ai-ops" element={<ManagerOnly />}>
              <Route index element={<AIOperationsPage />} />
            </Route>
            <Route path="tracking" element={<ManagerOnly />}>
              <Route index element={<TrackingPage />} />
            </Route>
            <Route path="analytics" element={<ManagerOnly />}>
              <Route index element={<AnalyticsPage />} />
            </Route>
            <Route path="exceptions" element={<ManagerOnly />}>
              <Route index element={<ExceptionsPage />} />
            </Route>
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
