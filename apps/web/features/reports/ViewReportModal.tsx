import React from 'react';
import { MessageSquare, CheckCircle, Sliders, Award, Star } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { getProgressColor } from '../../lib/utils';
import type { Review, User, Goal } from '../../types';

interface ViewReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    review: Review;
    user: User;
}

const ViewReportModal: React.FC<ViewReportModalProps> = ({ isOpen, onClose, review, user }) => {

    const completedTasks = user.goals.filter(g => review.completedTaskIds.some(id => String(id) === String(g.id)));
    const roleGoalsWithProgress = user.goals
        .filter(g => review.roleGoalProgress.some(p => String(p.goalId) === String(g.id)))
        .map(goal => {
            const progressData = review.roleGoalProgress.find(p => String(p.goalId) === String(goal.id));
            return { ...goal, reviewedProgress: progressData?.progress ?? goal.progress };
        });

    const monthName = new Date(review.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const hasTaskScores = review.taskScores && Object.keys(review.taskScores).length > 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Performance Report - ${monthName}`}>
            <div className="space-y-6">

                <Card className="bg-nyx-50 border-nyx-200 dark:bg-nyx-500/10 dark:border-nyx-500/30">
                    <div className="p-5 text-center">
                        <Award className="w-10 h-10 text-nyx-500 mx-auto mb-2" />
                        <p className="text-sm text-nyx-800 dark:text-nyx-200 font-medium">Total Score This Month</p>
                        <p className="text-5xl font-bold text-nyx-700 dark:text-nyx-300">{review.score}</p>
                    </div>
                </Card>

                <Card>
                    <div className="p-5">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                           <MessageSquare className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Manager's Feedback
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{review.managerFeedback || "No feedback was provided for this review."}</p>
                    </div>
                </Card>

                {/* New: Task Scores & Feedback section for new-style reviews */}
                {hasTaskScores ? (
                    <Card>
                        <div className="p-5">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                                <Star className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Task Scores &amp; Feedback
                            </h3>
                            <div className="space-y-3">
                                {completedTasks.length > 0 ? completedTasks.map(task => {
                                    const taskScore = review.taskScores?.[String(task.id)] || 0;
                                    const taskFb = review.taskFeedback?.[String(task.id)] || '';
                                    return (
                                        <div key={task.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="font-medium text-gray-800 dark:text-gray-200">{task.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="purple">{task.points} pts</Badge>
                                                    <Badge variant={taskScore >= 7 ? 'success' : taskScore >= 4 ? 'warning' : 'danger'}>
                                                        {taskScore}/10
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
                                                <div
                                                    className={`h-1.5 rounded-full transition-all ${
                                                        taskScore >= 7 ? 'bg-green-500' : taskScore >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${taskScore * 10}%` }}
                                                />
                                            </div>
                                            {taskFb && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 italic">{taskFb}</p>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No tasks were scored in this period.</p>
                                )}
                            </div>
                        </div>
                    </Card>
                ) : (
                    /* Legacy: old binary checkbox display */
                    <Card>
                        <div className="p-5">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                               <CheckCircle className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Completed Monthly Tasks
                            </h3>
                            <div className="space-y-2">
                                {completedTasks.length > 0 ? completedTasks.map(task => (
                                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-500/10">
                                        <p className="font-medium text-green-800 dark:text-green-200">{task.title}</p>
                                        <Badge variant="purple">{task.points} pts</Badge>
                                    </div>
                                )) : (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No monthly tasks were completed in this period.</p>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                <Card>
                    <div className="p-5">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                            <Sliders className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Role Goal Progress Snapshot
                        </h3>
                        <div className="space-y-4">
                           {roleGoalsWithProgress.length > 0 ? roleGoalsWithProgress.map(goal => (
                               <div key={goal.id}>
                                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{goal.title}</label>
                                   <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Progress as of review</span>
                                        <span className="font-medium text-gray-800 dark:text-gray-200">{goal.reviewedProgress}%</span>
                                    </div>
                                   <ProgressBar value={goal.reviewedProgress} color={getProgressColor(goal.status)} />
                               </div>
                           )) : (
                                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No role goal progress was updated in this review.</p>
                           )}
                        </div>
                    </div>
                </Card>

            </div>
        </Modal>
    );
};

export default ViewReportModal;
