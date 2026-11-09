import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../use-auth-store";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AppContentSkeleton } from "@/components/common/AppContentSkeleton";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    // 1. App ka frame turant dikhe (Sidebar + Top Bar)
    // 2. Content area mein grey skeleton blocks
    // 3. Top par 2px indigo progress line
    // 4. Insaani aur chhota progressive text
    return (
      <DashboardLayout>
        <AppContentSkeleton />
      </DashboardLayout>
    );
  }

  if (!user) {
    // Preserve intended destination after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

