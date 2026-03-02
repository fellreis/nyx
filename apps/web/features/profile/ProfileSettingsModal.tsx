import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useApp } from '../../context/AppContext';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
    const { currentUser, updateUserPassword } = useApp();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const handleClose = () => {
        // Reset state on close
        setError('');
        setSuccess('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!currentUser) {
            setError('No user is logged in.');
            return;
        }

        if (currentUser.password !== currentPassword) {
            setError('Your current password does not match.');
            return;
        }
        
        if (newPassword.length < 8) {
             setError('New password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        // FIX: The updateUserPassword function returns `void`, so its return value cannot be tested for truthiness.
        // The original implementation had a type error and a logical bug. The code now correctly assumes the update is successful.
        updateUserPassword(currentUser.id, newPassword);
        setSuccess('Password updated successfully!');
        setTimeout(() => {
            handleClose();
        }, 1500);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Profile Settings">
            <form onSubmit={handleSubmit} className="space-y-4">
                 <h3 className="text-lg font-semibold dark:text-white">Change Your Password</h3>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                 {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button type="submit">Update Password</Button>
                </div>
            </form>
        </Modal>
    );
};
export default ProfileSettingsModal;