import React from 'react';
import { BellOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const NotificationCenter: React.FC = () => {
    const { notifications, markNotificationRead, currentUser } = useApp();
    const userNotifications = notifications
        .filter(n => n.userId === currentUser?.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const markAsRead = async (id: number) => {
        await markNotificationRead(id);
    };

    return (
        <div className="absolute right-0 top-14 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 z-50 slide-in">
            <div className="p-4 border-b dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">Notifications</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {userNotifications.length > 0 ? (
                    userNotifications.map(notif => (
                        <div
                            key={notif.id}
                            className={`p-4 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${!notif.read ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                            onClick={() => markAsRead(notif.id)}
                        >
                            <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}`}>{notif.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(notif.timestamp).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                        <BellOff className="w-8 h-8 mb-2 text-gray-400" />
                        <p>No new notifications</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationCenter;
