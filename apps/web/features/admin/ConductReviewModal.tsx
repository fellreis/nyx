import React, { useState, useMemo, useEffect } from 'react';
import { Star, Sliders, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { GoalType, GoalStatus } from '../../types';
import type { User as UserType, Goal, Review, ProgressHistory } from '../../types';

interface ConductReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: UserType | null;
}

const RatingSelector: React.FC<{ value: number; onChange: (v: number) => void; }> = ({ value, onChange }) => {
    return (
        <div className="flex items-center gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(value === n ? 0 : n)}
                    className={`w-7 h-7 rounded-full text-xs font-bold transition-all duration-150 border ${
                        n <= value
                            ? 'bg-nyx-600 text-white border-nyx-700 dark:bg-nyx-500 dark:border-nyx-400'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:border-gray-600 dark:hover:bg-gray-600'
                    }`}
                    title={`${n}/10`}
                >
                    {n}
                </button>
            ))}
        </div>
    );
};

const ConductReviewModal: React.FC<ConductReviewModalProps> = ({ isOpen, onClose, employee }) => {
    const { createReview, updateGoal, updateEmployee, refreshEmployees, refreshNotifications } = useApp();

    const [taskScores, setTaskScores] = useState<Record<string, number>>({});
    const [taskFeedback, setTaskFeedback] = useState<Record<string, string>>({});
    const [roleGoalProgress, setRoleGoalProgress] = useState<Record<string, number>>({});
    const [managerFeedback, setManagerFeedback] = useState('');

    const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

    const { monthlyTasks, roleGoals, categorizedTasks } = useMemo(() => {
        if (!employee) return { monthlyTasks: [], roleGoals: [], categorizedTasks: {} };
        const tasks = employee.goals.filter(g => g.type === GoalType.MONTHLY_TASK && g.reviewPeriod === currentMonth);
        const categorized = tasks.reduce((acc, goal) => {
            const category = goal.category || 'General';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(goal);
            return acc;
        }, {} as Record<string, Goal[]>);

        return {
            monthlyTasks: tasks,
            roleGoals: employee.goals.filter(g => g.type === GoalType.ROLE),
            categorizedTasks: categorized,
        };
    }, [employee, currentMonth]);

    useEffect(() => {
        if (employee) {
            setTaskScores({});
            setTaskFeedback({});
            setManagerFeedback('');
            const initialProgress = employee.goals
                .filter(g => g.type === GoalType.ROLE)
                .reduce((acc, goal) => {
                    acc[String(goal.id)] = goal.progress;
                    return acc;
                }, {} as Record<string, number>);
            setRoleGoalProgress(initialProgress);
        }
    }, [employee]);

    if (!isOpen || !employee) {
        return null;
    }

    const handleScoreChange = (taskId: number | string, score: number) => {
        setTaskScores(prev => ({ ...prev, [String(taskId)]: score }));
    };

    const handleTaskFeedbackChange = (taskId: number | string, feedback: string) => {
        setTaskFeedback(prev => ({ ...prev, [String(taskId)]: feedback }));
    };

    const handleProgressChange = (goalId: number | string, progress: number) => {
        setRoleGoalProgress(prev => ({ ...prev, [String(goalId)]: progress }));
    };

    const handleFinalizeClick = async () => {
        const completedTaskIds = monthlyTasks
            .filter(task => (taskScores[String(task.id)] || 0) > 0)
            .map(task => task.id);

        const pendingTaskIds = monthlyTasks
            .filter(task => !completedTaskIds.some(id => String(id) === String(task.id)))
            .map(task => task.id);

        const monthlyTaskCategoryDistribution = monthlyTasks
            .filter(task => completedTaskIds.some(id => String(id) === String(task.id)))
            .reduce((acc, task) => {
                const category = task.category || 'General';
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        // Score = sum of all individual task ratings (each 0-10)
        const score = Object.values(taskScores).reduce((sum, rating) => sum + rating, 0);

        for (const taskId of completedTaskIds) {
            const taskRating = taskScores[String(taskId)] || 0;
            const progress = Math.round((taskRating / 10) * 100);
            const status = taskRating >= 7 ? GoalStatus.COMPLETED : taskRating > 0 ? GoalStatus.IN_PROGRESS : GoalStatus.NOT_STARTED;
            await updateGoal(taskId, { status, progress });
        }

        for (const goal of roleGoals) {
            const progressUpdate = roleGoalProgress[String(goal.id)];
            if (progressUpdate !== undefined && progressUpdate !== goal.progress) {
                const newStatus = progressUpdate === 100 ? GoalStatus.COMPLETED : progressUpdate > 0 ? GoalStatus.IN_PROGRESS : goal.status;
                await updateGoal(goal.id, { progress: progressUpdate, status: newStatus });
            }
        }

        const newReview: Review = {
            month: currentMonth,
            score,
            managerFeedback,
            completedTaskIds,
            pendingTaskIds,
            roleGoalProgress: Object.entries(roleGoalProgress).map(([goalId, progress]) => ({ goalId, progress })),
            monthlyTaskCategoryDistribution,
            taskScores,
            taskFeedback
        };

        const lastHistory = [...employee.progressHistory].sort((a,b) => a.date.localeCompare(b.date)).pop() || { score: 0, tasksCompleted: 0 };
        const newCumulativeScore = lastHistory.score + score;
        const newTotalTasksCompleted = lastHistory.tasksCompleted + completedTaskIds.length;

        const newHistoryEntry: ProgressHistory = { date: currentMonth, score: newCumulativeScore, tasksCompleted: newTotalTasksCompleted };

        const updatedProgressHistory = employee.progressHistory.filter(h => h.date !== currentMonth);
        updatedProgressHistory.push(newHistoryEntry);

        await updateEmployee(employee.id, { progressHistory: updatedProgressHistory });
        await createReview({
            revieweeId: String(employee.id),
            summary: managerFeedback || `Review ${currentMonth}`,
            score,
            month: currentMonth,
            managerFeedback,
            completedTaskIds,
            roleGoalProgress: Object.entries(roleGoalProgress).map(([goalId, progress]) => ({ goalId, progress })),
            monthlyTaskCategoryDistribution,
            taskScores,
            taskFeedback
        });

        await refreshEmployees();
        await refreshNotifications();

        onClose();
    };

    const monthName = new Date(currentMonth + '-02').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const totalScore = Object.values(taskScores).reduce((sum, r) => sum + r, 0);
    const maxPossible = monthlyTasks.length * 10;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Conducting Review for ${employee.name}`}>
            <div className="space-y-6">
                <header className="text-center">
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">Performance Review</p>
                    <p className="text-gray-500 dark:text-gray-400">{monthName}</p>
                    {monthlyTasks.length > 0 && (
                        <div className="mt-2 inline-flex items-center gap-2 bg-nyx-50 dark:bg-nyx-500/10 border border-nyx-200 dark:border-nyx-500/30 rounded-lg px-4 py-2">
                            <Star className="w-4 h-4 text-nyx-600 dark:text-nyx-400" />
                            <span className="text-sm font-semibold text-nyx-700 dark:text-nyx-300">Running Score: {totalScore}/{maxPossible}</span>
                        </div>
                    )}
                </header>
                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <Star className="w-5 h-5 mr-3 text-gray-400 dark:text-gray-500" />
                        Monthly Tasks — Rate &amp; Review
                    </h2>
                    <Card>
                        <div className="p-4">
                            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-2">
                                {monthlyTasks.length > 0 ? (
                                    Object.entries(categorizedTasks).map(([category, tasks]) => (
                                        <div key={category}>
                                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-700 pb-1">
                                                {category}
                                            </h3>
                                            <div className="space-y-4">
                                                {tasks.map(task => {
                                                    const currentScore = taskScores[String(task.id)] || 0;
                                                    return (
                                                        <div key={task.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="font-medium text-gray-800 dark:text-gray-200">{task.title}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="purple">{task.points} pts</Badge>
                                                                    {currentScore > 0 && (
                                                                        <Badge variant={currentScore >= 7 ? 'success' : currentScore >= 4 ? 'warning' : 'danger'}>
                                                                            {currentScore}/10
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="mb-2">
                                                                <RatingSelector
                                                                    value={currentScore}
                                                                    onChange={(v) => handleScoreChange(task.id, v)}
                                                                />
                                                            </div>
                                                            <textarea
                                                                value={taskFeedback[String(task.id)] || ''}
                                                                onChange={(e) => handleTaskFeedbackChange(task.id, e.target.value)}
                                                                placeholder="Provide feedback for this task..."
                                                                className="w-full h-16 p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nyx-500 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-white resize-none"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No monthly tasks assigned for this period.</p>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <Sliders className="w-5 h-5 mr-3 text-gray-400 dark:text-gray-500" />
                        Role Goal Progress Update
                    </h2>
                    <Card>
                        <div className="p-4">
                            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                {roleGoals.length > 0 ? roleGoals.map(goal => (
                                    <div key={goal.id}>
                                        <label htmlFor={`progress-${goal.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{goal.title}</label>
                                        <div className="flex items-center gap-4 mt-1">
                                            <input
                                                    id={`progress-${goal.id}`}
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={roleGoalProgress[String(goal.id)] ?? 0}
                                                    onChange={(e) => handleProgressChange(goal.id, Number(e.target.value))}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                            />
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 w-12 text-center">{roleGoalProgress[String(goal.id)] ?? 0}%</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No role goals found for this employee.</p>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <MessageSquare className="w-5 h-5 mr-3 text-gray-400 dark:text-gray-500" />
                        Manager's Overall Feedback
                    </h2>
                    <Card>
                            <div className="p-4">
                                <textarea
                                value={managerFeedback}
                                onChange={(e) => setManagerFeedback(e.target.value)}
                                placeholder="Provide qualitative feedback, commendations, and areas for improvement..."
                                className="w-full h-28 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nyx-500 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                required
                            />
                        </div>
                    </Card>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleFinalizeClick}>Finalize & Generate Report</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ConductReviewModal;
