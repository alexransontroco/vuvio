import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import LivePage from './routes/LivePage.jsx';
import ExplorePage from './routes/ExplorePage.jsx';
import MapPage from './routes/MapPage.jsx';
import ProfilePage from './routes/ProfilePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/explore" replace />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/explore" replace />} />
      </Route>
    </Routes>
  );
}
