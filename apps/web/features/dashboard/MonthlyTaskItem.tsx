import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import { GoalStatus } from '../../types';
import type { Goal } from '../../types';

interface MonthlyTaskItemProps {
    goal: Goal;
}

const MonthlyTaskItem: React.FC<MonthlyTaskItemProps> = ({ goal }) => {
    const isCompleted = goal.status === GoalStatus.COMPLETED;

    return (
        <div 
            className="flex items-center justify-between p-3 rounded-lg"
            aria-checked={isCompleted}
        >
            <div className="flex items-center gap-3">
                {isCompleted ? (
                    <CheckSquare className="w-5 h-5 text-nyx-600 dark:text-nyx-400 flex-shrink-0" />
                ) : (
                    <Square className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                )}
                <span className={`text-sm ${isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200 font-medium'}`}>
                    {goal.title}
                </span>
            </div>
            <Badge variant="purple" className="flex-shrink-0">{goal.points} pts</Badge>
        </div>
    );
};

export default MonthlyTaskItem;