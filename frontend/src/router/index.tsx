import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import AdminPage from "../pages/admin/AdminPage";
import StaffPage from "../pages/staff/StaffPage";
import GuestPage from "../pages/guest/GuestPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/guest/:token" element={<GuestPage />} />
      </Routes>
    </BrowserRouter>
  );
}
