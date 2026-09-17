import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VerifyEmailPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/watch', { replace: true });
  }, [navigate]);

  return null;
}
