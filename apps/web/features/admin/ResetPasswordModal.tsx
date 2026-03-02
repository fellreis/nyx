import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import type { User } from '../../types';

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: User;
    onSave: (userId: number | string, newPassword: string) => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, employee, onSave }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        onSave(employee.id, newPassword);
        onClose();
    };

    const handleClose = () => {
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`Reset Password for ${employee.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                    />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button type="submit">Save Password</Button>
                </div>
            </form>
        </Modal>
    );
};

export default ResetPasswordModal;
