import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { UserRole } from '../../types';
import type { User } from '../../types';

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: User;
    onUpdate: (employeeId: number | string, data: Partial<User>) => void;
    onDelete: (employeeId: number | string) => void;
    managers: User[];
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, employee, onUpdate, onDelete, managers }) => {
    const [formData, setFormData] = useState({ ...employee });

    useEffect(() => {
        if (isOpen) {
            setFormData({ ...employee });
        }
    }, [isOpen, employee]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const managerId = e.target.value ? e.target.value : null;
        setFormData(prev => ({ ...prev, managerId }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate(employee.id, formData);
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${employee.name}? This action cannot be undone.`)) {
            onDelete(employee.id);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Edit Profile for ${employee.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                    <input type="text" name="department" value={formData.department} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                        <select name="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            {Object.values(UserRole).map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manager</label>
                        <select value={formData.managerId ?? ''} onChange={handleManagerChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">None</option>
                            {managers.filter(m => String(m.id) !== String(employee.id)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t dark:border-gray-700">
                    <Button type="button" variant="danger" onClick={handleDelete}>Delete Employee</Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default EditEmployeeModal;
