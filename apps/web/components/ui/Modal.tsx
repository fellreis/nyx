import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex min-h-screen items-center justify-center p-4 text-center">
                <div className="fixed inset-0 bg-black/70 transition-opacity" aria-hidden="true" onClick={onClose}></div>
                <div className="relative transform text-left bg-white dark:bg-gray-800 rounded-xl shadow-xl transition-all max-w-2xl w-full max-h-[90vh] flex flex-col slide-in">
                    <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b dark:bg-gray-800/80 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-10">
                        <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="px-6 py-5 overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;