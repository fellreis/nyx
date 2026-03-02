import React, { useState, useMemo } from 'react';
import type { User, Goal, Review } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { Target, Lock, Calendar, CalendarCheck, FileText } from 'lucide-react';
import { getStatusColor, getProgressColor } from '../../lib/utils';
import { GoalStatus, GoalType } from '../../types';
import ViewReportModal from '../reports/ViewReportModal';

interface ProfileViewProps {
    user: User;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState('Role');
    const [viewingReport, setViewingReport] = useState<Review | null>(null);
    
    const stats = React.useMemo(() => {
        const userGoals = user.goals || [];
        const completedGoals = userGoals.filter(g => g.status === 'Completed');
        const totalPoints = user.progressHistory.slice(-1)[0]?.score || 0;
        return {
            totalGoals: userGoals.length,
            completedGoals: completedGoals.length,
            totalPoints,
        };
    }, [user.goals, user.progressHistory]);

    const { monthlyTasks, roleGoals, sortedReviews } = React.useMemo(() => {
        const allGoals = user.goals || [];
        return {
            monthlyTasks: allGoals.filter(g => g.type === GoalType.MONTHLY_TASK).sort((a, b) => (b.reviewPeriod || '').localeCompare(a.reviewPeriod || '')),
            roleGoals: allGoals.filter(g => g.type === GoalType.ROLE),
            sortedReviews: [...(user.reviews || [])].sort((a,b) => b.month.localeCompare(a.month)),
        };
    }, [user.goals, user.reviews]);

    const categorizedMonthlyTasks = useMemo(() => {
        return monthlyTasks.reduce((acc, goal) => {
            const category = goal.category || 'General';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(goal);
            return acc;
        }, {} as Record<string, Goal[]>);
    }, [monthlyTasks]);

    const EmptyState = ({ message }: { message: string }) => (
        <Card className="p-8 text-center border-dashed dark:border-gray-700 dark:bg-gray-800/50">
            <Target className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">No Goals Assigned</h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
        </Card>
    );

    const renderGoalCard = (goal: Goal) => {
        const dependenciesMet = (goal.dependencies || []).every(depId =>
            user.goals.find(g => String(g.id) === String(depId))?.status === GoalStatus.COMPLETED
        );
        return (
            <Card key={goal.id} className={`p-4 ${!dependenciesMet ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}>
                <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {!dependenciesMet && <span title="Blocked by other goals"><Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" /></span>}
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{goal.title}</h4>
                            {goal.isPromotionBlocker && <Badge variant="warning">Promotion Blocker</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{goal.description}</p>
                        
                        {goal.type === GoalType.MONTHLY_TASK && goal.reviewPeriod ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
                                <CalendarCheck className="w-3 h-3 mr-1.5" />
                                Review Period: {new Date(goal.reviewPeriod + '-02').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                            </div>
                        ) : goal.deadline && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center">
                                <Calendar className="w-3 h-3 mr-1.5" />
                                Deadline: {new Date(goal.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                            </div>
                        )}

                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Badge variant="purple">{goal.points} pts</Badge>
                        <Badge className={getStatusColor(goal.status)}>{goal.status}</Badge>
                    </div>
                </div>
                <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{goal.progress}%</span>
                    </div>
                    <ProgressBar value={goal.progress} color={getProgressColor(goal.status)} />
                </div>
            </Card>
        )
    };

    const renderMonthlyTasks = () => (
        <div className="space-y-6">
            {Object.entries(categorizedMonthlyTasks).map(([category, tasks]) => {
                const completedCount = tasks.filter(t => t.status === GoalStatus.COMPLETED).length;
                return (
                    <div key={category}>
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-700 pb-2">
                            {category} ({completedCount}/{tasks.length})
                        </h3>
                        <div className="space-y-4 pt-2">
                            {tasks.map(renderGoalCard)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
    
    const renderReviewHistory = () => (
        <div className="space-y-3">
            {sortedReviews.length > 0 ? (
                sortedReviews.map(review => {
                    const dateObj = new Date(review.month + '-02T00:00:00Z');
                    const monthLong = dateObj.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
                    const year = dateObj.getFullYear();
                    return (
                        <Card key={review.month} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                             <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{monthLong.slice(0,3).toUpperCase()}</span>
                                    <span className="text-lg font-bold text-gray-800 dark:text-gray-200">{year}</span>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Performance Report</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{review.score} points earned</p>
                                </div>
                             </div>
                            <button onClick={() => setViewingReport(review)} className="text-nyx-600 dark:text-nyx-400 font-medium text-sm flex items-center gap-2 hover:underline">
                                <FileText className="w-4 h-4" /> View Report
                            </button>
                        </Card>
                    );
                })
            ) : (
                 <Card className="p-8 text-center border-dashed dark:border-gray-700 dark:bg-gray-800/50">
                    <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">No Review History</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">This employee has not had a performance review recorded yet.</p>
                </Card>
            )}
        </div>
    );

    return (
        <>
            <div className="space-y-6">
                <header>
                     <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-nyx-100 dark:bg-nyx-500/20 rounded-full flex items-center justify-center text-nyx-600 dark:text-nyx-300 font-bold text-2xl">
                            {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user.name}</h2>
                            <p className="text-gray-600 dark:text-gray-300">{user.department} Department</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-4 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Goals</p>
                        <p className="text-2xl font-bold dark:text-white">{stats.totalGoals}</p>
                    </Card>
                     <Card className="p-4 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Goals Completed</p>
                        <p className="text-2xl font-bold dark:text-white">{stats.completedGoals}</p>
                    </Card>
                     <Card className="p-4 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Cumulative Points</p>
                        <p className="text-2xl font-bold dark:text-white">{stats.totalPoints}</p>
                    </Card>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Employee Details</h3>
                     <div className="border-b dark:border-gray-700">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button onClick={() => setActiveTab('Role')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'Role' ? 'border-nyx-500 text-nyx-600 dark:text-nyx-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}`}>
                                Role Goals <Badge className="ml-2">{roleGoals.length}</Badge>
                            </button>
                            <button onClick={() => setActiveTab('Monthly')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'Monthly' ? 'border-nyx-500 text-nyx-600 dark:text-nyx-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}`}>
                                Monthly Tasks <Badge className="ml-2">{monthlyTasks.length}</Badge>
                            </button>
                             <button onClick={() => setActiveTab('History')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'History' ? 'border-nyx-500 text-nyx-600 dark:text-nyx-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}`}>
                                Review History <Badge className="ml-2">{sortedReviews.length}</Badge>
                            </button>
                        </nav>
                    </div>
                    <div className="pt-5 space-y-4">
                        {activeTab === 'Role' && (roleGoals.length > 0 ? roleGoals.map(renderGoalCard) : <EmptyState message="No role goals assigned yet." />)}
                        {activeTab === 'Monthly' && (monthlyTasks.length > 0 ? renderMonthlyTasks() : <EmptyState message="No monthly tasks have been set." />)}
                        {activeTab === 'History' && renderReviewHistory()}
                    </div>
                </div>
            </div>

            {viewingReport && (
                <ViewReportModal
                    isOpen={!!viewingReport}
                    onClose={() => setViewingReport(null)}
                    review={viewingReport}
                    user={user}
                />
            )}
        </>
    );
};

export default ProfileView;
