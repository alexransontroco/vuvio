// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const useLocationMock = vi.fn(() => ({ pathname: '/admin/analytics' }));
const useAuthMock = vi.fn();

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => useLocationMock(),
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => useAuthMock(),
}));

import ProtectedRoute from '../ProtectedRoute.jsx';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useLocationMock.mockClear();
    useAuthMock.mockReset();
  });

  it('renders children for authenticated users', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'user-1' },
      userProfile: { onboardingCompleted: true },
      authLoading: false,
    });

    render(
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('protected content').textContent).toBe('protected content');
  });

  it('redirects unauthenticated users to login with returnTo', () => {
    useAuthMock.mockReturnValue({
      user: null,
      userProfile: null,
      authLoading: false,
    });

    render(
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    );

    const redirect = screen.getByTestId('navigate');
    expect(redirect.getAttribute('data-to')).toBe('/login');
  });
});
