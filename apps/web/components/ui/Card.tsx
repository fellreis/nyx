import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
    <div 
        className={`bg-white rounded-xl shadow-sm border border-gray-200/80 dark:bg-gray-800 dark:border-gray-700 ${className}`}
        {...props}
    >
        {children}
    </div>
);

export default Card;