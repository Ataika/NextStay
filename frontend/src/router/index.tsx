import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import AdminPage from "../pages/admin/AdminPage";
import StaffPage from "../pages/staff/StaffPage";
import GuestPage from "../pages/guest/GuestPage";
import ReportsPage from "../pages/reports/ReportsPage";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import IndexRedirect from "./IndexRedirect";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/guest/:token" element={<GuestPage />} />

        <Route element={<AppLayout />}>
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="OWNER">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute requiredRole="STAFF">
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRole="OWNER">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
