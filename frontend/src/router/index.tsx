import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import AdminPage from "../pages/admin/AdminPage";
import StaffPage from "../pages/staff/StaffPage";
import ChatPage from "../pages/staff/ChatPage";
import GuestPage from "../pages/guest/GuestPage";
import NextStayPage from "../pages/NextStayPage";
import BookingPage from "../pages/booking/BookingPage";
import BookingSuccessPage from "../pages/booking/BookingSuccessPage";
import BookingCancelPage from "../pages/booking/BookingCancelPage";
import ReportsPage from "../pages/reports/ReportsPage";
import BookingsPage from "../pages/admin/BookingsPage";
import PricingLabPage from "../pages/admin/PricingLabPage";
import ModelTrainingPage from "../pages/admin/ModelTrainingPage";
import PricingConfigPage from "../pages/admin/PricingConfigPage";
import InventorySetupPage from "../pages/admin/InventorySetupPage";
import EngineHubPage from "../pages/admin/EngineHubPage";
import TeamPage from "../pages/admin/TeamPage";
import SettingsPage from "../pages/SettingsPage";
import NotFoundPage from "../pages/NotFoundPage";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import IndexRedirect from "./IndexRedirect";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/nextstay" element={<NextStayPage />} />
        <Route path="/booking/success" element={<BookingSuccessPage />} />
        <Route path="/booking/cancel" element={<BookingCancelPage />} />
        <Route path="/guest/:token" element={<GuestPage />} />

        <Route element={<AppLayout />}>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={["STAFF"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/tasks"
            element={
              <ProtectedRoute allowedRoles={["STAFF"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route path="/staff/overview" element={<Navigate to="/staff" replace />} />
          <Route
            path="/staff/schedule"
            element={
              <ProtectedRoute allowedRoles={["STAFF"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/calendar"
            element={
              <ProtectedRoute allowedRoles={["STAFF"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/hours"
            element={
              <ProtectedRoute allowedRoles={["STAFF"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF"]}>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <BookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing-lab"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <PricingLabPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/model-training"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN"]}>
                <ModelTrainingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/engine-tuning"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN"]}>
                <PricingConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory-setup"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <InventorySetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/engine"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <EngineHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"]}>
                <TeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 404 - catch all route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
