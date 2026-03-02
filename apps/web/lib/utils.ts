import { GoalStatus } from '../types';

export const getStatusColor = (status: GoalStatus): string => {
    switch (status) {
        case GoalStatus.ON_TRACK: return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-500/20';
        case GoalStatus.IN_PROGRESS: return 'text-nyx-700 bg-nyx-100 dark:text-nyx-300 dark:bg-nyx-500/20';
        case GoalStatus.AT_RISK: return 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-500/20';
        case GoalStatus.COMPLETED: return 'text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-500/20';
        default: return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700/50';
    }
};

export const getProgressColor = (status: GoalStatus): string => {
    switch (status) {
        case GoalStatus.ON_TRACK: return 'bg-green-500';
        case GoalStatus.IN_PROGRESS: return 'bg-nyx-500';
        case GoalStatus.AT_RISK: return 'bg-orange-500';
        case GoalStatus.COMPLETED: return 'bg-purple-500';
        default: return 'bg-gray-400 dark:bg-gray-500';
    }
};

export const generateTemporaryPassword = (length: number = 10): string => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
};