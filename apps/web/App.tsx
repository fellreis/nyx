import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginScreen from './features/auth/LoginScreen';
import Dashboard from './features/dashboard/Dashboard';
import TeamView from './features/team/TeamView';
import AdminPanel from './features/admin/AdminPanel';
import ConductReviewPage from './features/admin/ConductReviewPage';
import Header from './components/layout/Header';
import { UserRole } from './types';
import type { User } from './types';

const MainApp = () => {
    const { currentUser, logout, theme, loading } = useApp();
    const [activeView, setActiveView] = useState('dashboard');
    const [reviewEmployee, setReviewEmployee] = useState<User | null>(null);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [theme]);

    const handleLogout = async () => {
        await logout();
        setActiveView('dashboard');
        setReviewEmployee(null);
    };
    
    const handleViewChange = (view: string) => {
        setActiveView(view);
        if (view !== 'admin') {
            setReviewEmployee(null);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-gray-600 dark:text-gray-300">Loading...</div>;
    }

    if (!currentUser) {
        return <LoginScreen />;
    }

    const renderActiveView = () => {
        switch(activeView) {
            case 'team':
                if (currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN) {
                    return <TeamView />;
                }
                return <Dashboard />;
            case 'admin':
                if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER) {
                    if (reviewEmployee) {
                        return (
                            <ConductReviewPage
                                employee={reviewEmployee}
                                onBack={() => setReviewEmployee(null)}
                            />
                        );
                    }
                    return (
                        <AdminPanel
                            onConductReview={(employee) => setReviewEmployee(employee)}
                        />
                    );
                }
                return <Dashboard />;
            case 'dashboard':
            default:
                return <Dashboard />;
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
            <Header 
                activeView={activeView} 
                onViewChange={handleViewChange} 
                onLogout={handleLogout}
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderActiveView()}
            </main>
        </div>
    );
};

const App: React.FC = () => (
    <AppProvider>
        <MainApp />
    </AppProvider>
);

export default App;
