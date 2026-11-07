import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../use-auth-store";
import { Send, Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 mb-4 animate-pulse">
          <Send className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 tracking-wider uppercase">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span>Verifying Session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // Preserve intended destination after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

