import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import type { User } from '../../types';
import Card from '../../components/ui/Card';
import ProgressBar from '../../components/ui/ProgressBar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ProfileView from './ProfileView';

const TeamView: React.FC = () => {
    const { employees, currentUser } = useApp();
    const [selectedMember, setSelectedMember] = useState<User | null>(null);
    
    const teamMembers = employees.filter(e => {
        if (!currentUser || e.id === currentUser.id) return false;

        switch (currentUser.role) {
            case UserRole.ADMIN:
                // Admins can see all users.
                return true;
            
            case UserRole.MANAGER:
                // Managers can only see employees assigned to them.
                return String(e.managerId) === String(currentUser.id);
            
            default:
                // Employees or other roles should not see anyone.
                return false;
        }
    });

    return (
        <>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Team Overview</h1>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">Monitor your team's career development progress.</p>
                </div>

                {teamMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teamMembers.map(member => {
                            const completedGoals = member.goals.filter(g => g.status === 'Completed').length;
                            const totalGoals = member.goals.length;
                            const progress = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
                            const totalPoints = member.goals.filter(g => g.status === 'Completed').reduce((acc, g) => acc + g.points, 0);

                            return (
                                <Card key={member.id} className="p-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-nyx-100 dark:bg-nyx-500/20 rounded-full flex items-center justify-center text-nyx-600 dark:text-nyx-300 font-bold text-lg">
                                            {member.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{member.department}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-600 dark:text-gray-400">Goal Completion</span>
                                                <span className="font-medium dark:text-gray-200">{progress}%</span>
                                            </div>
                                            <ProgressBar value={progress} />
                                        </div>
                                        <div className="flex justify-between text-sm pt-2">
                                            <span className="text-gray-600 dark:text-gray-400">Goals Completed:</span>
                                            <span className="font-medium dark:text-gray-200">{completedGoals}/{totalGoals}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Total Points:</span>
                                            <span className="font-medium dark:text-gray-200">{totalPoints}</span>
                                        </div>
                                        <div className="pt-2">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="w-full"
                                            onClick={() => setSelectedMember(member)}
                                        >
                                            View Full Profile
                                        </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                     <Card className="p-12 text-center border-dashed dark:border-gray-700 dark:bg-gray-800/50">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">No Team Members Found</h3>
                        <p className="text-gray-600 dark:text-gray-400">There are no employees assigned to you yet.</p>
                    </Card>
                )}
            </div>
            
            {selectedMember && (
                <Modal
                    isOpen={!!selectedMember}
                    onClose={() => setSelectedMember(null)}
                    title={`${selectedMember.name}'s Profile`}
                >
                    <ProfileView user={selectedMember} />
                </Modal>
            )}
        </>
    );
};

export default TeamView;
