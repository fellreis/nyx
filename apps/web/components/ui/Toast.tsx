import React from 'react';

type ToastTone = 'error' | 'success' | 'info';

interface ToastProps {
    message: string;
    tone?: ToastTone;
    onClose?: () => void;
}

const toneStyles: Record<ToastTone, string> = {
    error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100',
    success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/60 dark:text-green-100',
    info: 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
};

const Toast: React.FC<ToastProps> = ({ message, tone = 'info', onClose }) => {
    return (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
            <div
                className={`pointer-events-auto w-full max-w-md rounded-lg border px-4 py-3 shadow-lg ${toneStyles[tone]}`}
                role="status"
                aria-live="polite"
            >
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{message}</p>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Dismiss notification"
                            className="text-sm font-semibold opacity-70 transition hover:opacity-100"
                        >
                            x
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Toast;
