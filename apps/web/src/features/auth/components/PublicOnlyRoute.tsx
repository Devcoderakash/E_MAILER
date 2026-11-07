import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../use-auth-store";
import { Send, Loader2 } from "lucide-react";

interface PublicOnlyRouteProps {
  children?: React.ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
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
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (user) {
    const destination = (location.state as any)?.from?.pathname || "/";
    return <Navigate to={destination} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

