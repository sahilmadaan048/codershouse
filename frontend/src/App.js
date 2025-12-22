import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Navigation from "./components/shared/Navigation/Navigation.jsx";
import Home from "./pages/Home/Home.jsx";
import Authenticate from "./pages/Authenticate/Authenticate.jsx";
import Activate from './pages/Activate/Activate.jsx';
import Room from './pages/Room/Room.jsx';
import Rooms from './pages/Rooms/Rooms.jsx';
import { useLoadingWithRefresh } from './hooks/useLoadingWithRefresh.js';
import Loader from './components/shared/Loader/Loader.jsx';

function App() {
  // call refresh endpoint
  const { loading } = useLoadingWithRefresh();

  return loading ? (<Loader message="Loading, please wait..."/>) : (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<GuestRoute><Home /></GuestRoute>} />
        <Route path="/authenticate" element={<GuestRoute><Authenticate /></GuestRoute>} />
        <Route path="/activate" element={<SemiProtectedRoute><Activate /></SemiProtectedRoute>} />
        <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
        <Route path="/room/:id" element={<ProtectedRoute><Room /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

// GuestRoute: For non-authenticated users 
const GuestRoute = ({ children }) => {
  const { isAuth } = useSelector((state) => state.auth);
  return isAuth ? <Navigate to="/rooms" /> : children;
};

// SemiProtectedRoute: For authenticated but not activated users
const SemiProtectedRoute = ({ children }) => {
  const { user, isAuth } = useSelector((state) => state.auth);

  if (!isAuth) return <Navigate to="/" />;
  if (isAuth && !user.activated) return children;
  return <Navigate to="/rooms" />;
};

// ProtectedRoute: For fully authenticated & activated users
const ProtectedRoute = ({ children }) => {
  const { user, isAuth } = useSelector((state) => state.auth);

  if (!isAuth) return <Navigate to="/" />;
  if (isAuth && !user.activated) return <Navigate to="/activate" />;
  return children;
};

export default App;
