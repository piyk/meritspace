import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AppearanceProvider } from './context/AppearanceContext';
import { LanguageProvider } from './context/LanguageContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CreateExam from './pages/CreateExam';
import TakeExam from './pages/TakeExam';
import AdminPanel from './pages/AdminPanel';
import MonitoringDashboard from './pages/MonitoringDashboard';
import Navbar from './components/Navbar';
import Appearance from './pages/Appearance';
import { GOOGLE_CLIENT_ID } from './config';

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <div className="loading">Loading...</div>;
    if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

    return <>{children}</>;
};

// Inner component so we can access useTheme for AppearanceProvider
const AppInner: React.FC = () => {
    const { isDark } = useTheme();
    return (
        <AppearanceProvider isDark={isDark}>
            <LanguageProvider>
                <AuthProvider>
                    <Router basename="/app">
                        <div className="min-h-screen">
                            <Navbar />
                            <Routes>
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                                <Route path="/appearance" element={<ProtectedRoute><Appearance /></ProtectedRoute>} />
                                <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminPanel /></ProtectedRoute>} />
                                <Route path="/create-form" element={<ProtectedRoute roles={['LECTURER', 'ADMIN']}><CreateExam /></ProtectedRoute>} />
                                <Route path="/edit-form/:examId" element={<ProtectedRoute roles={['LECTURER', 'ADMIN']}><CreateExam /></ProtectedRoute>} />
                                <Route path="/monitor/:examId" element={<ProtectedRoute roles={['LECTURER', 'ADMIN']}><MonitoringDashboard /></ProtectedRoute>} />
                                <Route path="/take-form/:examId" element={<ProtectedRoute><TakeExam /></ProtectedRoute>} />
                            </Routes>
                        </div>
                    </Router>
                </AuthProvider>
            </LanguageProvider>
        </AppearanceProvider>
    );
};
function App() {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <ThemeProvider>
                <AppInner />
            </ThemeProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
