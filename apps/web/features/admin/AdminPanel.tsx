import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Users, Edit, FileText, Upload, KeyRound, UserPlus, ListChecks, LayoutTemplate } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import * as api from '../../lib/api';
import { UserRole } from '../../types';
import type { User } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import ManageGoalsModal from './ManageGoalsModal';
import AddEmployeeModal from './AddEmployeeModal';
import ResetPasswordModal from './ResetPasswordModal';
import EditEmployeeModal from './EditEmployeeModal';
import { generateTemporaryPassword } from '../../lib/utils';

interface AdminPanelProps {
    onConductReview?: (employee: User) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onConductReview }) => {
    const { employees, currentUser, updateUserPassword, updateEmployee, registerEmployee, deleteEmployee, refreshEmployees } = useApp();
    const [managingGoalsFor, setManagingGoalsFor] = useState<User | null>(null);
    const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [resettingPasswordFor, setResettingPasswordFor] = useState<User | null>(null);
    const [toast, setToast] = useState<{ message: string; tone: 'error' | 'success' | 'info' } | null>(null);
    const toastTimerRef = useRef<number | null>(null);

    const showToast = useCallback((message: string, tone: 'error' | 'success' | 'info' = 'info') => {
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        setToast({ message, tone });
        toastTimerRef.current = window.setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
        }, 4000);
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    const manageableEmployees = employees.filter(e => {
        if (!currentUser || String(e.id) === String(currentUser.id)) return false;

        switch (currentUser.role) {
            case UserRole.ADMIN:
                // Admins can see all users.
                return true;
            case UserRole.MANAGER:
                return String(e.managerId) === String(currentUser.id);
            default:
                return false;
        }
    });
    
    const managers = useMemo(() => employees.filter(e => e.role === UserRole.MANAGER || e.role === UserRole.ADMIN), [employees]);

    const handleUpdateEmployee = async (updatedUser: User) => {
        await updateEmployee(updatedUser.id, {
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            managerId: updatedUser.managerId,
            department: updatedUser.department,
            roleTemplateId: updatedUser.roleTemplateId,
            progressHistory: updatedUser.progressHistory
        });
        await refreshEmployees();
    };
    
    const handleUpdateEmployeeDetails = async (employeeId: number | string, data: Partial<User>) => {
        await updateEmployee(employeeId, data);
        await refreshEmployees();
    };

    const handleDeleteEmployee = async (employeeId: number | string) => {
        await deleteEmployee(employeeId);
        await refreshEmployees();
    };

    const handleResetPassword = (employee: User) => {
        setResettingPasswordFor(employee);
    };
    
    const handleSaveNewPassword = async (userId: number | string, newPassword: string) => {
        await updateUserPassword(userId, newPassword);
        setResettingPasswordFor(null);
    };

    const handleAddEmployee = async (newEmployeeData: Omit<User, 'id' | 'goals' | 'progressHistory' | 'reviews'>) => {
        try {
            await registerEmployee({
                ...newEmployeeData,
                password: newEmployeeData.password ?? generateTemporaryPassword()
            });
            setIsAddModalOpen(false);
            showToast('Employee created successfully.', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create employee.';
            showToast(message, 'error');
            throw error;
        }
    };

    const handleApplyTemplate = async (employee: User) => {
        if (!confirm(`Apply the default goals template to ${employee.name}? This will add all standard goals and monthly tasks.`)) return;
        try {
            const result = await api.applyTemplate(String(employee.id));
            showToast(`Template applied: ${result.goalsCreated} goals added to ${employee.name}`, 'success');
            await refreshEmployees();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to apply template.';
            showToast(message, 'error');
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            processCSV(text);
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };

    const processCSV = async (csvText: string) => {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['name', 'email', 'role', 'department'];
        if (!requiredHeaders.every(h => headers.includes(h))) {
            alert('CSV must contain name, email, role, and department columns.');
            return;
        }

        let added = 0;
        let updated = 0;
        let failed = 0;

        const updatedEmployees = [...employees];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) {
                console.error(`Skipping row ${i+1}: Mismatched column count.`);
                failed++;
                continue;
            }
            
            const rowData: any = {};
            headers.forEach((header, index) => {
                rowData[header] = values[index];
            });

            if (!rowData.name || !rowData.email || !rowData.role || !rowData.department) {
                console.error(`Skipping row ${i+1}: Missing required fields.`);
                failed++;
                continue;
            }

            const existingEmployeeIndex = rowData.id
                ? updatedEmployees.findIndex(emp => String(emp.id) === String(rowData.id))
                : updatedEmployees.findIndex(emp => emp.email === rowData.email);
            const hasManagerColumn = Object.prototype.hasOwnProperty.call(rowData, 'managerid');
            const managerIdValue = rowData.managerid ? String(rowData.managerid) : null;

            if (existingEmployeeIndex > -1) {
                // Update existing employee
                const emp = updatedEmployees[existingEmployeeIndex];
                emp.name = rowData.name;
                emp.email = rowData.email;
                emp.role = rowData.role as UserRole;
                emp.department = rowData.department;
                if (hasManagerColumn) {
                    emp.managerId = managerIdValue;
                }
                await updateEmployee(emp.id, {
                    name: emp.name,
                    email: emp.email,
                    role: emp.role,
                    department: emp.department,
                    managerId: emp.managerId
                });
                updated++;
            } else {
                // Add new employee
                const newUser = {
                    name: rowData.name,
                    email: rowData.email,
                    password: generateTemporaryPassword(),
                    role: rowData.role as UserRole,
                    department: rowData.department,
                    managerId: hasManagerColumn ? managerIdValue : null
                };
                await registerEmployee({ ...newUser, password: newUser.password ?? generateTemporaryPassword() });
                added++;
            }
        }
        await refreshEmployees();
        alert(`CSV Import Summary:\n- ${added} new employees added.\n- ${updated} employees updated.\n- ${failed} rows failed.`);
    };
    
    const pageTitle = currentUser?.role === UserRole.MANAGER ? "Team Management" : "Admin Panel";
    const pageDescription = currentUser?.role === UserRole.MANAGER 
        ? "Manage goals and conduct performance reviews for your team members."
        : "Manage users, goals, and conduct reviews for all employees.";

    return (
        <>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{pageTitle}</h1>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">{pageDescription}</p>
                </div>
                
                 {currentUser?.role === UserRole.ADMIN && (
                    <Card className="p-4">
                        <div className="flex items-center gap-2">
                             <Button onClick={() => setIsAddModalOpen(true)}>
                                <UserPlus className="w-4 h-4 mr-2"/> Add Employee
                            </Button>
                            <Button variant="secondary" onClick={() => document.getElementById('csv-upload')?.click()}>
                                <Upload className="w-4 h-4 mr-2"/> Import CSV
                            </Button>
                            <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange} className="hidden" />
                        </div>
                    </Card>
                )}

                {manageableEmployees.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {manageableEmployees.map(member => (
                            <Card key={member.id} className="p-6 flex flex-col transition-all duration-200 hover:shadow-lg hover:border-nyx-500/30 dark:hover:border-nyx-500/30">
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-12 h-12 bg-nyx-100 dark:bg-nyx-500/20 rounded-full flex items-center justify-center text-nyx-700 dark:text-nyx-300 font-bold text-lg flex-shrink-0">
                                        {member.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{member.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{member.department} / <span className="capitalize">{member.role}</span></p>
                                    </div>
                                </div>

                                <div className="space-y-2 mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        className="w-full"
                                        onClick={() => onConductReview?.(member)}
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Conduct Review
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setManagingGoalsFor(member)}
                                    >
                                        <ListChecks className="w-4 h-4 mr-2" />
                                        Manage Goals
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="w-full"
                                        onClick={() => handleApplyTemplate(member)}
                                    >
                                        <LayoutTemplate className="w-4 h-4 mr-2" />
                                        Apply Template
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => setEditingEmployee(member)}
                                        >
                                            <Edit className="w-3.5 h-3.5 mr-1.5" />
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => handleResetPassword(member)}
                                        >
                                            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                                            Password
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                     <Card className="p-12 text-center border-dashed dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center">
                            <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">No Manageable Employees</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">There are no employees available for you to manage.</p>
                    </Card>
                )}
            </div>
            
            {managingGoalsFor && (
                <ManageGoalsModal
                    isOpen={!!managingGoalsFor}
                    onClose={() => setManagingGoalsFor(null)}
                    employee={managingGoalsFor}
                />
            )}
             {editingEmployee && (
                <EditEmployeeModal
                    isOpen={!!editingEmployee}
                    onClose={() => setEditingEmployee(null)}
                    employee={editingEmployee}
                    onUpdate={handleUpdateEmployeeDetails}
                    onDelete={handleDeleteEmployee}
                    managers={managers}
                />
            )}
            <AddEmployeeModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onAddEmployee={handleAddEmployee} 
                managers={managers} 
            />
            {resettingPasswordFor && (
                <ResetPasswordModal
                    isOpen={!!resettingPasswordFor}
                    onClose={() => setResettingPasswordFor(null)}
                    employee={resettingPasswordFor}
                    onSave={handleSaveNewPassword}
                />
            )}
            {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
        </>
    );
};

export default AdminPanel;
