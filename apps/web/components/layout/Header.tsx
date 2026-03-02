import React, { useState, useRef, useEffect } from 'react';
import { Home, Users, Shield, Bell, LogOut, Sun, Moon, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import NotificationCenter from '../../features/notifications/NotificationCenter';
import Button from '../ui/Button';
import ProfileSettingsModal from '../../features/profile/ProfileSettingsModal';

interface HeaderProps {
    activeView: string;
    onViewChange: (view: string) => void;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, onLogout }) => {
    const { currentUser, notifications, theme, toggleTheme } = useApp();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => n.userId === currentUser?.id && !n.read).length;

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home, roles: [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN] },
        { id: 'team', label: 'Team', icon: Users, roles: [UserRole.MANAGER, UserRole.ADMIN] },
        { id: 'admin', label: 'Admin', icon: Shield, roles: [UserRole.ADMIN, UserRole.MANAGER] }
    ];

    const availableNavItems = navItems.filter(item => 
        currentUser?.role && item.roles.includes(currentUser.role)
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <>
            <header className="border-b border-gray-200/80 sticky top-0 z-40 glass-morphism dark-glass-morphism dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-nyx-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">NYX</span>
                                </div>
                                <span className="font-semibold text-lg text-gray-800 dark:text-gray-200 hidden sm:inline">Career Dev</span>
                            </div>
                            
                            <nav className="hidden md:flex items-center gap-2">
                                {availableNavItems.map(item => {
                                    const Icon = item.icon;
                                    const label = item.id === 'admin' && currentUser?.role === UserRole.MANAGER ? 'Team Management' : item.label;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onViewChange(item.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                activeView === item.id
                                                    ? 'bg-nyx-100 text-nyx-700 dark:bg-nyx-500/20 dark:text-nyx-300'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                                aria-label="Toggle theme"
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </button>
                            <div className="relative" ref={notificationRef}>
                                <button
                                    onClick={() => setShowNotifications(prev => !prev)}
                                    className="relative p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                                {showNotifications && <NotificationCenter />}
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentUser?.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{currentUser?.role}</p>
                                </div>
                                <button
                                    onClick={() => setShowProfileSettings(true)}
                                    className="p-2 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                                    aria-label="Profile Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                <Button size="sm" variant="secondary" onClick={onLogout} className="!p-2">
                                    <LogOut className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <ProfileSettingsModal
                isOpen={showProfileSettings}
                onClose={() => setShowProfileSettings(false)}
            />
        </>
    );
};

export default Header;
