import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../use-auth-store";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

interface PublicOnlyRouteProps {
  children?: React.ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="mb-4">
          <Logo variant="icon" size={40} />
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
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

