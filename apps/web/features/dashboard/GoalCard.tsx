import React, { useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, Trash2, Plus, Lock, CalendarCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { getProgressColor, getStatusColor } from '../../lib/utils';
import { GoalStatus, GoalType } from '../../types';
import type { Goal, Subtask } from '../../types';

interface GoalCardProps {
    goal: Goal;
    allGoals: Goal[];
    onUpdate: (goalId: number | string, updates: Partial<Goal>) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, allGoals, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    const { dependenciesMet, dependencyGoals } = useMemo(() => {
        if (!goal.dependencies || goal.dependencies.length === 0) {
            return { dependenciesMet: true, dependencyGoals: [] };
        }
        
        const deps = allGoals.filter(g => goal.dependencies.some(depId => String(depId) === String(g.id)));
        const allCompleted = deps.every(g => g.status === GoalStatus.COMPLETED);
        
        return { dependenciesMet: allCompleted, dependencyGoals: deps };
    }, [goal.dependencies, allGoals]);

    const calculatedProgress = useMemo(() => {
        const hasSubtasks = goal.subtasks && goal.subtasks.length > 0;

        if (hasSubtasks) {
            // When subtasks exist, they are the single source of truth for progress calculation.
            const completedCount = goal.subtasks.filter(st => st.completed).length;
            const totalCount = goal.subtasks.length;
            // Ensure progress is exactly 100% when all subtasks are complete.
            if (totalCount > 0 && completedCount === totalCount) {
                return 100;
            }
            return Math.round((completedCount / totalCount) * 100);
        }
        
        // For goals without subtasks, use the manually set progress value.
        return goal.progress;
    }, [goal.subtasks, goal.progress]);

    const handleSubtaskUpdate = (newSubtasks: Subtask[]) => {
        const completedCount = newSubtasks.filter(st => st.completed).length;
        const totalCount = newSubtasks.length;
    
        // Ensure progress is exactly 100% when all subtasks are complete.
        const newProgress = totalCount > 0 
            ? (completedCount === totalCount ? 100 : Math.round((completedCount / totalCount) * 100))
            : 0;
            
        const getNewStatus = (): GoalStatus => {
            // Rule 1: Completion has the highest priority.
            if (newProgress === 100) {
                return GoalStatus.COMPLETED;
            }
    
            // Rule 2: Blocked by dependencies.
            if (!dependenciesMet) {
                // A blocked goal is 'Not Started', unless manually marked 'At Risk'.
                return goal.status === GoalStatus.AT_RISK ? GoalStatus.AT_RISK : GoalStatus.NOT_STARTED;
            }
    
            // Rule 3: Automatic 'At Risk' for role goals with approaching deadlines.
            if (goal.type === GoalType.ROLE && goal.deadline) {
                const now = new Date();
                const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                const deadlineParts = goal.deadline.split('-').map(s => parseInt(s, 10));
                const deadlineUTC = new Date(Date.UTC(deadlineParts[0], deadlineParts[1] - 1, deadlineParts[2]));
                const timeDiff = deadlineUTC.getTime() - todayUTC.getTime();
                const daysRemaining = Math.round(timeDiff / (1000 * 3600 * 24));
    
                if (daysRemaining <= 7 && newProgress < 75) {
                    return GoalStatus.AT_RISK;
                }
            }
    
            // Rule 4: Progress-based status changes.
            if (newProgress > 0) {
                // Handles starting from 'Not Started' or un-completing from 'Completed'.
                if (goal.status === GoalStatus.NOT_STARTED || goal.status === GoalStatus.COMPLETED) {
                    return GoalStatus.IN_PROGRESS;
                }
                // If the goal was 'At Risk' but no longer meets the auto-at-risk criteria, move it to 'In Progress'.
                if (goal.status === GoalStatus.AT_RISK) {
                    return GoalStatus.IN_PROGRESS;
                }
                // Otherwise, preserve the current status (e.g., 'On Track' set by the user).
                return goal.status;
            }
    
            // Rule 5: No progress means 'Not Started', unless manually marked 'At Risk'.
            return goal.status === GoalStatus.AT_RISK ? GoalStatus.AT_RISK : GoalStatus.NOT_STARTED;
        };
    
        const newStatus = getNewStatus();
    
        onUpdate(goal.id, { subtasks: newSubtasks, progress: newProgress, status: newStatus });
    };

    const handleToggleSubtask = (subtaskId: number | string) => {
        const newSubtasks = goal.subtasks.map(st => 
            String(st.id) === String(subtaskId) ? { ...st, completed: !st.completed } : st
        );
        handleSubtaskUpdate(newSubtasks);
    };
    
    const handleAddSubtask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubtaskTitle.trim()) return;
        const newSubtask: Subtask = {
            id: Date.now(),
            title: newSubtaskTitle.trim(),
            completed: false,
        };
        const newSubtasks = [...goal.subtasks, newSubtask];
        handleSubtaskUpdate(newSubtasks);
        setNewSubtaskTitle('');
    };

    const handleDeleteSubtask = (subtaskId: number | string) => {
        const newSubtasks = goal.subtasks.filter(st => String(st.id) !== String(subtaskId));
        handleSubtaskUpdate(newSubtasks);
    };

    return (
        <Card className={`p-6 flex flex-col transition-all ${!dependenciesMet ? 'bg-gray-100/50 dark:bg-gray-800/50 border-l-4 border-orange-300 dark:border-orange-600' : 'bg-white dark:bg-gray-800'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-4">
                     <div className="flex items-center gap-2 flex-wrap">
                        {!dependenciesMet && <span title="This goal is locked"><Lock className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" /></span>}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{goal.title}</h3>
                        {goal.isPromotionBlocker && <Badge variant="warning">Promotion Blocker</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{goal.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Badge variant="purple">{goal.points} pts</Badge>
                    <Badge className={getStatusColor(goal.status)}>
                        {goal.status}
                    </Badge>
                </div>
            </div>

            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Progress</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{calculatedProgress}%</span>
                </div>
                <ProgressBar value={calculatedProgress} color={getProgressColor(goal.status)} />
            </div>
            
            {goal.type === GoalType.MONTHLY_TASK && goal.reviewPeriod ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                    <CalendarCheck className="w-4 h-4 mr-2" />
                    Review Period: {new Date(goal.reviewPeriod + '-02').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </div>
            ) : goal.deadline && (
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Deadline: {new Date(goal.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                </div>
            )}
            
            <div className="mt-auto pt-4 border-t border-gray-200/80 dark:border-gray-700">
                <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? 'Hide Details' : 'Manage Goal'}
                    {isExpanded ? <ChevronUp className="w-4 h-4 ml-2"/> : <ChevronDown className="w-4 h-4 ml-2"/>}
                </Button>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-dashed dark:border-gray-700">
                    <div className="space-y-4">
                         {!dependenciesMet && (
                            <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-sm">
                                <p className="font-semibold mb-2">This goal is locked.</p>
                                <p>Complete the following goals to unlock:</p>
                                <ul className="list-disc list-inside mt-1">
                                    {dependencyGoals.map(dep => (
                                        <li key={dep.id} className={dep.status === GoalStatus.COMPLETED ? 'line-through' : ''}>
                                            {dep.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className={`grid ${goal.type === GoalType.ROLE ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                                <select 
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-nyx-500 focus:outline-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={goal.status}
                                    onChange={(e) => onUpdate(goal.id, { status: e.target.value as GoalStatus })}
                                >
                                    {Object.values(GoalStatus).map(status => {
                                        const isDisabled = !dependenciesMet && [GoalStatus.IN_PROGRESS, GoalStatus.ON_TRACK, GoalStatus.COMPLETED].includes(status);
                                        return <option key={status} value={status} disabled={isDisabled}>{status}</option>
                                    })}
                                </select>
                            </div>
                            {goal.type === GoalType.ROLE && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Deadline</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-nyx-500 focus:outline-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={goal.deadline || ''}
                                        onChange={(e) => onUpdate(goal.id, { deadline: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                        <div>
                             <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Subtasks</h4>
                             <div className="space-y-2">
                                {goal.subtasks.map(subtask => (
                                    <div key={subtask.id} className="flex items-center gap-2 p-2 rounded-md bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700/50 dark:hover:bg-gray-700">
                                        <input type="checkbox" checked={subtask.completed} onChange={() => handleToggleSubtask(subtask.id)} className="w-4 h-4 text-nyx-600 bg-gray-200 border-gray-300 rounded focus:ring-nyx-500 disabled:cursor-not-allowed dark:bg-gray-600 dark:border-gray-500" disabled={!dependenciesMet} />
                                        <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'} ${!dependenciesMet ? 'text-gray-500' : ''}`}>{subtask.title}</span>
                                        <button onClick={() => handleDeleteSubtask(subtask.id)} className="text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:text-gray-300 dark:hover:text-red-400 dark:disabled:text-gray-500" disabled={!dependenciesMet}><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                {goal.subtasks.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No subtasks yet.</p>}
                             </div>
                             <form onSubmit={handleAddSubtask} className="flex gap-2 mt-3">
                                 <input
                                    type="text"
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    placeholder={dependenciesMet ? "Add a new subtask..." : "Unlock goal to add subtasks"}
                                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-nyx-500 focus:outline-none disabled:bg-gray-200/70 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-700/50"
                                    disabled={!dependenciesMet}
                                 />
                                 <Button type="submit" size="sm" variant="outline" disabled={!dependenciesMet}><Plus size={16} /></Button>
                             </form>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default GoalCard;
