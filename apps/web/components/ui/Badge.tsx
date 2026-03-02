import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
    className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
    const variants = {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        danger: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        info: 'bg-nyx-100 text-nyx-800 dark:bg-nyx-900/50 dark:text-nyx-300',
        purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    };

    return (
        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full inline-block ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;