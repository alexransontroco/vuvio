// @vitest-environment jsdom
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const navigateMock = vi.fn();
const useAuthMock = vi.fn();
const getDocsMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: (...args) => getDocsMock(...args),
}));

vi.mock('../../firebase.js', () => ({
  db: {},
}));

import AnalyticsPage from '../AnalyticsPage.jsx';

describe('AnalyticsPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthMock.mockReset();
    getDocsMock.mockReset();
  });

  it('redirects non-admin users to watch', async () => {
    useAuthMock.mockReturnValue({
      user: { email: 'someone@example.com' },
      authLoading: false,
    });

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/watch', { replace: true });
    });
  });

  it('loads analytics for whitelisted admins', async () => {
    useAuthMock.mockReturnValue({
      user: { email: 'alexandre.ranson@gmail.com' },
      authLoading: false,
    });

    getDocsMock.mockResolvedValue({
      docs: [
        {
          data: () => ({
            streamId: 'stream-1',
            title: 'Demo stream',
            engagementScore: 12.34,
            viewStarts: 9,
            retention30sRate: 42,
            impressions: 5,
            status: 'live',
          }),
        },
      ],
    });

    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(getDocsMock).toHaveBeenCalledTimes(3);
    });
  });
});
