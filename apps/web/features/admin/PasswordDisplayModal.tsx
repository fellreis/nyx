import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

interface PasswordDisplayModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeName: string;
    tempPassword: string;
}

const PasswordDisplayModal: React.FC<PasswordDisplayModalProps> = ({ isOpen, onClose, employeeName, tempPassword }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(tempPassword).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Temporary Password Generated">
            <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">The password for <strong className="dark:text-white">{employeeName}</strong> has been set to:</p>
                <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-between my-4">
                    <span className="text-lg font-mono font-bold text-gray-800 dark:text-gray-100">{tempPassword}</span>
                    <Button size="sm" variant="secondary" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                </div>
                <p className="text-sm text-orange-600 dark:text-orange-400">Please share this temporary password with the employee. They should change it from their profile settings after logging in.</p>
                <Button onClick={onClose} className="mt-6 w-full">Done</Button>
            </div>
        </Modal>
    );
};

export default PasswordDisplayModal;
