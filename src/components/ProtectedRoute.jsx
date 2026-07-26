import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, requireOnboarding = true }) {
  const { user, userProfile, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return null;

  if (!user) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  if (requireOnboarding && userProfile && userProfile.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { user, authLoading } = useAuth();

  if (authLoading) return null;

  if (user) {
    return <Navigate to="/watch" replace />;
  }

  return children;
}
