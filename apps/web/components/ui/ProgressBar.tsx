import React from 'react';

interface ProgressBarProps {
    value: number;
    max?: number;
    className?: string;
    color?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, max = 100, className = '', color = 'bg-nyx-600' }) => (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 ${className}`}>
        <div 
            className={`${color} h-2.5 rounded-full transition-all duration-500 ease-out`} 
            style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
        />
    </div>
);

export default ProgressBar;