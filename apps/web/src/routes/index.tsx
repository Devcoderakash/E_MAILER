import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";
import { ProtectedRoute, PublicOnlyRoute } from "@/features";
import {
  LoginPage,
  SignUpPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./auth";
import { DashboardOverviewPage } from "./dashboard";
import { CampaignsPage } from "./campaigns";
import { ContactsPage } from "./contacts";
import { TemplatesPage } from "./templates";
import { ScheduleCenterPage } from "./schedule";
import { AnalyticsPage } from "./analytics";
import { AutomationBuilderPage } from "./automations";
import { SettingsPage } from "./settings";

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Auth Callback and Recovery Routes (Accessible with or without session) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Protected Dashboard SaaS Application Shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardOverviewPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/schedule" element={<ScheduleCenterPage />} />
          <Route path="/schedule-center" element={<Navigate to="/schedule" replace />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/automations" element={<AutomationBuilderPage />} />
          <Route path="/automation-builder" element={<Navigate to="/automations" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
