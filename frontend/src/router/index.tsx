import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import AdminPage from "../pages/admin/AdminPage";
import StaffPage from "../pages/staff/StaffPage";
import GuestPage from "../pages/guest/GuestPage";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "../components/ProtectedRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
