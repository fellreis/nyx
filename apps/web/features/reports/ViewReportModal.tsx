import React from 'react';
import { MessageSquare, CheckCircle, Sliders, Award, Star, Calendar, Target, Hash } from 'lucide-react';
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

// Dot score visualization component — renders 10 dots, filled to the score
const DotScore: React.FC<{ score: number; size?: number }> = ({ score, size = 10 }) => {
    const dots = [];
    for (let i = 1; i <= 10; i++) {
        const isFilled = i <= score;
        const isRed = isFilled && score <= 3;
        const isYellow = isFilled && score >= 4 && score <= 6;
        const isGreen = isFilled && score >= 7;

        let colorClass = 'bg-gray-600/30 dark:bg-gray-600/40';
        if (isGreen) colorClass = 'bg-emerald-400';
        else if (isYellow) colorClass = 'bg-yellow-400';
        else if (isRed) colorClass = 'bg-rose-400';

        dots.push(
            <div
                key={i}
                className={`rounded-full ${colorClass} transition-all`}
                style={{ width: size, height: size }}
            />
        );
    }
    return <div className="flex items-center gap-1">{dots}</div>;
};

// Score badge with colored background like the PDF
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
    let bgClass = 'bg-rose-500 text-white';
    if (score >= 7) bgClass = 'bg-emerald-500 text-white';
    else if (score >= 4) bgClass = 'bg-yellow-400 text-gray-900';

    return (
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${bgClass}`}>
            {score}
        </div>
    );
};

// Stacked category bar
const CategoryBar: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    if (total === 0) return null;

    const categoryColors: Record<string, string> = {
        'Creative Strategy': '#f472b6',
        'Strategic Research': '#fbbf24',
        'Concept Development': '#34d399',
        'Project Management': '#60a5fa',
        'Team Leadership': '#a78bfa',
        'Creative Excellence': '#f97316',
        '90-Day Plan': '#06b6d4',
        'General': '#ec4899',
    };
    const fallbackColors = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f97316', '#06b6d4', '#ec4899', '#818cf8', '#fb923c', '#4ade80', '#e879f9'];

    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

    return (
        <div>
            {/* Stacked bar */}
            <div className="flex rounded-lg overflow-hidden h-10 mb-3">
                {entries.map(([cat, count], i) => {
                    const pct = (count / total) * 100;
                    const color = categoryColors[cat] || fallbackColors[i % fallbackColors.length];
                    return (
                        <div
                            key={cat}
                            className="flex items-center justify-center text-xs font-bold transition-all relative group"
                            style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 8 ? undefined : 24 }}
                            title={`${cat}: ${count}`}
                        >
                            {pct > 12 && (
                                <span className="text-gray-900/80 truncate px-1 text-[11px]">
                                    {cat.length > 14 ? cat.substring(0, 12) + '…' : cat}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {entries.map(([cat, count], i) => {
                    const color = categoryColors[cat] || fallbackColors[i % fallbackColors.length];
                    return (
                        <div key={cat} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-500 dark:text-gray-400">{cat}: {count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const ViewReportModal: React.FC<ViewReportModalProps> = ({ isOpen, onClose, review, user }) => {

    const completedTasks = user.goals.filter(g => review.completedTaskIds.some(id => String(id) === String(g.id)));
    const pendingTasks = user.goals.filter(g => review.pendingTaskIds?.some(id => String(id) === String(g.id)));
    const roleGoalsWithProgress = user.goals
        .filter(g => review.roleGoalProgress.some(p => String(p.goalId) === String(g.id)))
        .map(goal => {
            const progressData = review.roleGoalProgress.find(p => String(p.goalId) === String(goal.id));
            return { ...goal, reviewedProgress: progressData?.progress ?? goal.progress };
        });

    const monthName = new Date(review.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const shortMonth = new Date(review.month + '-02').toLocaleString('default', { month: 'long', timeZone: 'UTC' });
    const year = new Date(review.month + '-02').getFullYear();
    const hasTaskScores = review.taskScores && Object.keys(review.taskScores).length > 0;

    const totalPossible = completedTasks.length * 10;
    const scorePercent = totalPossible > 0 ? Math.round((review.score / totalPossible) * 100) : 0;
    const reviewDate = review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-GB') : '—';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Performance Report - ${monthName}`}>
            <div className="space-y-6">

                {/* ═══ HERO STATS GRID (inspired by PDF page 1) ═══ */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4 bg-gradient-to-br from-pink-500 to-rose-500">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Total Score</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-4xl font-black text-white">{review.score}</span>
                            <span className="text-sm font-semibold text-white/70">PTS</span>
                        </div>
                    </div>
                    <div className="rounded-xl p-4 bg-gradient-to-br from-yellow-400 to-amber-400">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-800/60">Score %</p>
                        <span className="text-4xl font-black text-gray-900">{scorePercent}%</span>
                    </div>
                    <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-400 to-green-500">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Tasks Scored</p>
                        <span className="text-4xl font-black text-white">
                            {completedTasks.length}/{completedTasks.length + pendingTasks.length}
                        </span>
                    </div>
                    <div className="rounded-xl p-4 bg-gradient-to-br from-orange-400 to-orange-500">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Reviewed</p>
                        <span className="text-2xl font-black text-white mt-1 block">{reviewDate}</span>
                    </div>
                </div>

                {/* ═══ MANAGER FEEDBACK ═══ */}
                <Card>
                    <div className="p-5">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center">
                           <MessageSquare className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Manager's Feedback
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{review.managerFeedback || "No feedback was provided for this review."}</p>
                    </div>
                </Card>

                {/* ═══ TASK SCORES WITH DOT VISUALIZATION ═══ */}
                {hasTaskScores ? (
                    <Card>
                        <div className="p-5">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                                <Star className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Task Scores
                            </h3>
                            <div className="space-y-2">
                                {completedTasks.length > 0 ? completedTasks.map(task => {
                                    const taskScore = review.taskScores?.[String(task.id)] || 0;
                                    const taskFb = review.taskFeedback?.[String(task.id)] || '';
                                    return (
                                        <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                                            {/* Score badge */}
                                            <ScoreBadge score={taskScore} />
                                            {/* Task info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm leading-snug">{task.title}</p>
                                                {taskFb && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{taskFb}</p>
                                                )}
                                            </div>
                                            {/* Dot visualization */}
                                            <div className="hidden sm:block flex-shrink-0">
                                                <DotScore score={taskScore} size={11} />
                                            </div>
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

                {/* ═══ CATEGORIES — STACKED BAR ═══ */}
                {review.monthlyTaskCategoryDistribution && Object.keys(review.monthlyTaskCategoryDistribution).length > 0 && (
                    <Card>
                        <div className="p-5">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                                <Hash className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> Categories
                            </h3>
                            <CategoryBar data={review.monthlyTaskCategoryDistribution} />
                        </div>
                    </Card>
                )}

                {/* ═══ ROLE GOAL PROGRESS ═══ */}
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
