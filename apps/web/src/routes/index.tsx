import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";
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
      {/* Main SaaS Application Shell */}
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
        {/* 404 Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
