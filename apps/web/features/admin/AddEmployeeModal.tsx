import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { UserRole } from '../../types';
import type { User } from '../../types';

interface AddEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddEmployee: (newEmployeeData: Omit<User, 'id' | 'goals' | 'progressHistory' | 'reviews'>) => Promise<void>;
    managers: User[];
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onAddEmployee, managers }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [department, setDepartment] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
    const [managerId, setManagerId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onAddEmployee({
                name,
                email,
                password,
                department,
                role,
                managerId,
                roleTemplateId: 1, // Default template
            });
            // Reset form
            setName('');
            setEmail('');
            setPassword('');
            setDepartment('');
            setRole(UserRole.EMPLOYEE);
            setManagerId(null);
        } catch {
            // Keep user input so they can fix and retry.
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Employee">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        minLength={6}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                    <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            {Object.values(UserRole).map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manager</label>
                        <select value={managerId ?? ''} onChange={e => setManagerId(e.target.value ? e.target.value : null)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">None</option>
                            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit">Add Employee</Button>
                </div>
            </form>
        </Modal>
    );
};

export default AddEmployeeModal;
