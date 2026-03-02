import React, { useMemo, useState } from 'react';
import { Target, CheckCircle, Clock, TrendingUp, Activity, CalendarDays, Download, LineChart, BarChart3, List, Focus, MessageSquare, Award, PieChart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import GoalCard from './GoalCard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { GoalStatus, GoalType } from '../../types';
import type { Goal, ProgressHistory, User, Review } from '../../types';
import Button from '../../components/ui/Button';
import ViewReportModal from '../reports/ViewReportModal';
import MonthlyTaskItem from './MonthlyTaskItem';

interface ProcessedHistoryItem extends ProgressHistory {
    dateObj: Date;
    increase: number;
    monthlyTasksCompleted: number;
    isKeyMonth: boolean;
}

const AnalyticsView: React.FC<{ history: ProcessedHistoryItem[]; theme: 'light' | 'dark' }> = ({ history, theme }) => {
    const chartHeight = 250;
    const chartColor = theme === 'light' ? "rgb(0 254 138)" : "rgb(85 247 153)"; // nyx-500 light, nyx-400 dark
    
    const scoreChartData = useMemo(() => {
        if (history.length < 2) return null;
        const maxScore = Math.max(...history.map(item => item.score), 0);
        const points = history.map((item, i) => {
            const x = (i / (history.length - 1)) * 100;
            const y = 100 - (item.score / maxScore) * 100;
            return { x, y, score: item.score, date: item.dateObj };
        });
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return { points, path, maxScore };
    }, [history]);

    const tasksChartData = useMemo(() => {
        if (history.length === 0) return null;
        const maxMonthlyTasks = Math.max(...history.map(item => item.monthlyTasksCompleted), 0);
        if (maxMonthlyTasks === 0) return null;
        const bars = history.map((item, i) => ({
            height: (item.monthlyTasksCompleted / maxMonthlyTasks) * 100,
            tasks: item.monthlyTasksCompleted,
            date: item.dateObj,
        }));
        return { bars, maxMonthlyTasks };
    }, [history]);

    if (history.length < 2) {
         return <div className="text-center py-12 text-gray-500 dark:text-gray-400"><p>Not enough data to display analytics yet. Check back after a couple of months!</p></div>;
    }

    return (
        <div className="space-y-6">
             <Card>
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center"><LineChart className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400"/>Cumulative Score Over Time</h3>
                    {scoreChartData && (
                        <div className="relative pl-8 pr-4">
                            <div className="absolute left-0 top-0 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 font-medium">{scoreChartData.maxScore}</div>
                            <div className="absolute left-0 bottom-0 text-xs text-gray-500 dark:text-gray-400 font-medium">0</div>
                            <svg viewBox="0 0 100 100" className="w-full" style={{ height: chartHeight }} preserveAspectRatio="none">
                                <line x1="0" y1="0" x2="100" y2="0" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="0.5" />
                                <line x1="0" y1="50" x2="100" y2="50" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="0.5" strokeDasharray="2" />
                                <line x1="0" y1="100" x2="100" y2="100" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="0.5" />
                                <path d={scoreChartData.path} fill="none" stroke={chartColor} strokeWidth="0.8" />
                                {scoreChartData.points.map((p, i) => (
                                    <g key={i} className="group">
                                        <circle cx={p.x} cy={p.y} r="3" fill="transparent" />
                                        <circle cx={p.x} cy={p.y} r="1.2" fill={chartColor} className="group-hover:r-2 transition-all" />
                                        <title>{`Score: ${p.score} on ${p.date.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`}</title>
                                    </g>
                                ))}
                            </svg>
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 border-t dark:border-gray-700 pt-2">
                               <span>{history[0].dateObj.toLocaleDateString('default', { month: 'short', year: 'numeric' })}</span>
                               <span>{history[history.length-1].dateObj.toLocaleDateString('default', { month: 'short', year: 'numeric' })}</span>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
            <Card>
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center"><BarChart3 className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400"/>Tasks Completed Per Month</h3>
                    {tasksChartData ? (
                        <div className="relative pl-8 pr-4">
                            <div className="absolute left-0 top-0 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 font-medium">{tasksChartData.maxMonthlyTasks}</div>
                            <div className="absolute left-0 bottom-0 text-xs text-gray-500 dark:text-gray-400 font-medium">0</div>
                            <div className="flex w-full items-end border-b border-gray-200 dark:border-gray-700" style={{ height: chartHeight }}>
                                {tasksChartData.bars.map((bar, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full px-1 group relative">
                                        <div className="absolute bottom-full mb-1 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none dark:bg-gray-200 dark:text-gray-900">
                                            {bar.tasks} task{bar.tasks !== 1 ? 's' : ''}
                                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800 dark:border-t-gray-200"></div>
                                        </div>
                                        <div 
                                            className="w-full bg-nyx-500/80 hover:bg-nyx-600 dark:bg-nyx-500/70 dark:hover:bg-nyx-500 rounded-t-sm transition-colors" 
                                            style={{ height: `${bar.height}%` }}
                                            title={`${bar.tasks} task${bar.tasks !== 1 ? 's' : ''} in ${bar.date.toLocaleString('default', { month: 'long', year: 'numeric' })}`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="relative w-full h-4 mt-1 pt-1">
                                {history.map((item, i, arr) => {
                                    const numItems = arr.length;
                                    const maxLabels = 12;
                                    const shouldShow = numItems <= maxLabels ? true : i % Math.ceil(numItems / maxLabels) === 0;
                                    if (!shouldShow) return null;
                                    const position = ((i + 0.5) / numItems) * 100;
                                    return (
                                        <span key={item.date} className="absolute text-xs text-gray-500 dark:text-gray-400 -translate-x-1/2" style={{ left: `${position}%` }}>
                                            {item.dateObj.toLocaleString('default', { month: 'short' })}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400"><p>No monthly task completion data to display.</p></div>
                    )}
                </div>
            </Card>
        </div>
    );
};

const DetailedHistoryView: React.FC<{ history: ProcessedHistoryItem[] }> = ({ history }) => {
    if (history.length === 0) {
        return <div className="text-center py-12 text-gray-500 dark:text-gray-400"><p>No progress history available yet.</p></div>;
    }
    
    return (
        <Card>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 uppercase">
                        <tr>
                            <th className="px-6 py-3 font-medium">Month</th>
                            <th className="px-6 py-3 font-medium text-right">Cumulative Score</th>
                            <th className="px-6 py-3 font-medium text-right">Score Change</th>
                            <th className="px-6 py-3 font-medium text-right">New Tasks Completed</th>
                            <th className="px-6 py-3 font-medium text-right">Total Tasks Done</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {history.map(item => (
                            <tr key={item.dateObj.getTime()} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-semibold text-gray-800 dark:text-gray-200">{item.dateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}</td>
                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-100 text-right">{item.score}</td>
                                <td className="px-6 py-4 text-right">
                                    {item.increase > 0 ? (
                                        <span className="font-semibold text-green-600 dark:text-green-400">+{item.increase}</span>
                                    ) : (
                                        <span className="text-gray-500 dark:text-gray-400">{item.increase}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-300 text-right">{item.monthlyTasksCompleted}</td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-right">{item.tasksCompleted}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const ProgressReports: React.FC = () => {
    const { currentUser, theme } = useApp();
    const [activeTab, setActiveTab] = useState('Reports');
    const [viewingReport, setViewingReport] = useState<Review | null>(null);
    
    const pieChartColors = [
        '#00fe8a', '#55f799', '#8cfab8', '#bbfcd3',
        '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe',
        '#f97316', '#fb923c', '#fdba74', '#fed7aa'
    ];

    const MonthlyFocusDisplay: React.FC<{ data: Record<string, number> }> = ({ data }) => {
        const total = Object.values(data).reduce((sum, value) => sum + value, 0);
        if (total === 0) return null;

        let cumulativePercent = 0;
        const segments = Object.entries(data).map(([category, count], index) => {
            const percent = count / total;
            const startAngle = cumulativePercent * 360;
            cumulativePercent += percent;
            const endAngle = cumulativePercent * 360;
            const largeArcFlag = percent > 0.5 ? 1 : 0;

            const startX = 50 + 45 * Math.cos(Math.PI * (startAngle - 90) / 180);
            const startY = 50 + 45 * Math.sin(Math.PI * (startAngle - 90) / 180);
            const endX = 50 + 45 * Math.cos(Math.PI * (endAngle - 90) / 180);
            const endY = 50 + 45 * Math.sin(Math.PI * (endAngle - 90) / 180);

            const pathData = `M 50,50 L ${startX},${startY} A 45,45 0 ${largeArcFlag},1 ${endX},${endY} Z`;
            
            return {
                path: pathData,
                color: pieChartColors[index % pieChartColors.length],
                category,
                percent: Math.round(percent * 100),
            };
        }).sort((a,b) => b.percent - a.percent);

        return (
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Monthly Focus</h4>
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 flex-shrink-0">
                        <svg viewBox="0 0 100 100">
                            {segments.map(segment => (
                                <path key={segment.category} d={segment.path} fill={segment.color} />
                            ))}
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        {segments.map(segment => (
                            <p key={segment.category} className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">
                               {segment.percent}%
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const processedHistory = useMemo(() => {
        if (!currentUser?.progressHistory || currentUser.progressHistory.length === 0) return [];
        
        const datedHistory = [...currentUser.progressHistory]
            .map(item => ({
                ...item,
                dateObj: new Date(item.date + '-02T00:00:00Z'),
            }))
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        let maxIncrease = -1;
        let keyProgressMonthDate: Date | null = null;
        
        const historyWithDeltas = datedHistory.map((item, index) => {
            const prevScore = index > 0 ? datedHistory[index - 1].score : 0;
            const prevTasks = index > 0 ? datedHistory[index - 1].tasksCompleted : 0;
            const increase = item.score - prevScore;
            const monthlyTasksCompleted = item.tasksCompleted - prevTasks;

            if (increase > maxIncrease) {
                maxIncrease = increase;
                keyProgressMonthDate = item.dateObj;
            }

            return { ...item, increase, monthlyTasksCompleted };
        }).map(item => ({...item, isKeyMonth: keyProgressMonthDate !== null && item.dateObj.getTime() === keyProgressMonthDate.getTime()}));
        
        return historyWithDeltas.reverse();
    }, [currentUser]);

    const chronologicalHistory = useMemo(() => [...processedHistory].reverse(), [processedHistory]);
    
    const sortedReviews = useMemo(() => {
        return [...(currentUser?.reviews || [])].sort((a,b) => b.month.localeCompare(a.month));
    }, [currentUser?.reviews]);

    const handleExport = () => {
        if (chronologicalHistory.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = ['Month', 'Cumulative Score', 'Score Change', 'Tasks This Month', 'Total Tasks Completed'];
        const rows = chronologicalHistory.map(item => [
            `"${item.dateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}"`,
            item.score,
            item.increase,
            item.monthlyTasksCompleted,
            item.tasksCompleted
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const userName = currentUser?.name.replace(/\s/g, '_') || 'User';
        link.setAttribute("download", `${userName}_Progress_History.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderReports = () => {
        if (!sortedReviews || sortedReviews.length === 0) {
            return <div className="text-center py-12 text-gray-500 dark:text-gray-400"><p>No performance reports are available yet. Your first report will appear here after your manager completes it.</p></div>;
        }

        return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {sortedReviews.map(review => {
                    const dateObj = new Date(review.month + '-02T00:00:00Z');
                    const monthLong = dateObj.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
                    const year = dateObj.getFullYear();

                    return (
                        <Card key={review.month} className="p-6 flex flex-col h-full transition-all hover:shadow-md hover:border-nyx-300 dark:hover:border-nyx-500">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                                Performance Report - {monthLong} {year}
                            </h3>
                            
                            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                <p>{review.completedTaskIds.length} task{review.completedTaskIds.length !== 1 ? 's' : ''} completed.</p>
                                <p className="truncate" title={review.managerFeedback}>
                                    M: {review.managerFeedback.substring(0, 50)}{review.managerFeedback.length > 50 ? '...' : ''}
                                </p>
                            </div>
                            
                            <div className="flex-grow" />
                            
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex flex-wrap gap-3 items-end justify-between">
                                    <div className="min-w-[140px] flex-1">
                                        {review.monthlyTaskCategoryDistribution &&
                                        Object.keys(review.monthlyTaskCategoryDistribution).length > 0 ? (
                                            <MonthlyFocusDisplay data={review.monthlyTaskCategoryDistribution} />
                                        ) : (
                                            <div />
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full sm:w-auto flex-shrink-0"
                                        onClick={() => setViewingReport(review)}
                                    >
                                        View Full Report
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <Card>
                <div className="p-4">
                    <div className="p-1 bg-gray-100 dark:bg-gray-800/60 rounded-lg flex space-x-1 mb-6">
                        {['Reports', 'Analytics', 'Detailed History'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`w-full px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-nyx-500 focus:ring-offset-2 ${
                                    activeTab === tab
                                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                                        : 'bg-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                            {activeTab === 'Reports' ? 'Performance Reports' : 'Progress History'}
                        </h2>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export Complete Data
                        </Button>
                    </div>

                    {activeTab === 'Reports' && renderReports()}
                    {activeTab === 'Analytics' && <AnalyticsView history={chronologicalHistory} theme={theme} />}
                    {activeTab === 'Detailed History' && <DetailedHistoryView history={chronologicalHistory} />}
                </div>
            </Card>
            {viewingReport && currentUser && (
                <ViewReportModal 
                    isOpen={!!viewingReport}
                    onClose={() => setViewingReport(null)}
                    review={viewingReport}
                    user={currentUser}
                />
            )}
        </>
    );
};

const MonthlyTasks: React.FC<{ goals: Goal[] }> = ({ goals }) => {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = endOfMonth.getDate() - today.getDate();

    const categorizedTasks = useMemo(() => {
        return goals.reduce((acc, goal) => {
            const category = goal.category || 'General';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(goal);
            return acc;
        }, {} as Record<string, Goal[]>);
    }, [goals]);

    return (
        <Card>
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                            <Focus className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" /> This Month's Tasks
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">Tasks for review at the end of {today.toLocaleString('default', { month: 'long' })}.</p>
                    </div>
                    <div className="text-right flex-shrink-0 pl-4">
                        <p className="text-2xl font-bold text-nyx-600">{daysRemaining}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">day{daysRemaining !== 1 ? 's' : ''} left for review</p>
                    </div>
                </div>
                {goals.length > 0 ? (
                    <div className="space-y-4">
                        {Object.entries(categorizedTasks).map(([category, tasks]) => {
                            const completedCount = tasks.filter(t => t.status === GoalStatus.COMPLETED).length;
                            return (
                                <div key={category}>
                                    <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-700 pb-2">
                                        {category} ({completedCount}/{tasks.length})
                                    </h3>
                                    <div className="space-y-1 pt-1">
                                        {tasks.sort((a,b) => a.id - b.id).map(goal => (
                                            <MonthlyTaskItem key={goal.id} goal={goal} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No monthly tasks assigned for this period. Focus on your long-term role goals!</p>
                    </div>
                )}
            </div>
        </Card>
    )
}

const Dashboard: React.FC = () => {
    const { currentUser, updateGoal } = useApp();
    const user = currentUser!;
    
    const { monthlyTasks, roleGoals } = useMemo(() => {
        const allGoals = user.goals || [];
        const currentMonthPeriod = new Date().toISOString().slice(0, 7);
        return {
            monthlyTasks: allGoals.filter(g => g.type === GoalType.MONTHLY_TASK && g.reviewPeriod === currentMonthPeriod),
            roleGoals: allGoals.filter(g => g.type === GoalType.ROLE),
        };
    }, [user.goals]);

    const stats = useMemo(() => {
        const userGoals = user.goals || [];
        const completedGoals = userGoals.filter(g => g.status === 'Completed');
        const totalPoints = user.progressHistory.slice(-1)[0]?.score || 0;
        const averageProgress = userGoals.length > 0
            ? Math.round(userGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / userGoals.length)
            : 0;
            
        return {
            totalGoals: userGoals.length,
            completedGoals: completedGoals.length,
            inProgressGoals: userGoals.filter(g => g.status === 'In Progress' || g.status === 'On Track').length,
            totalPoints,
            averageProgress
        };
    }, [user.goals, user.progressHistory]);

    const upcomingDeadlines = useMemo(() => {
        if (!user.goals) return [];
    
        const now = new Date();
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
        return user.goals
            .filter(goal => goal.type === GoalType.ROLE && goal.deadline && goal.status !== GoalStatus.COMPLETED)
            .map(goal => {
                const deadlineParts = goal.deadline.split('-').map(s => parseInt(s, 10));
                const deadlineUTC = new Date(Date.UTC(deadlineParts[0], deadlineParts[1] - 1, deadlineParts[2]));
                
                const timeDiff = deadlineUTC.getTime() - todayUTC.getTime();
                const daysRemaining = Math.round(timeDiff / (1000 * 3600 * 24));
                
                return { ...goal, daysRemaining };
            })
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [user.goals]);

    const handleUpdateGoal = async (goalId: number | string, updates: Partial<Goal>) => {
        await updateGoal(goalId, updates);
    };

    const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => (
        <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                    <p className="text-2xl font-bold dark:text-white">{value}</p>
                </div>
                <div className={color}>{icon}</div>
            </div>
        </Card>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Welcome back, {user.name}!</h1>
                <p className="text-gray-600 dark:text-gray-300 text-lg">Here's your career development progress at a glance.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard icon={<Target size={24} />} label="Total Goals" value={stats.totalGoals} color="text-nyx-500" />
                <StatCard icon={<CheckCircle size={24} />} label="Completed" value={stats.completedGoals} color="text-green-500" />
                <StatCard icon={<Clock size={24} />} label="In Progress" value={stats.inProgressGoals} color="text-orange-500" />
                <StatCard icon={<TrendingUp size={24} />} label="Total Points" value={stats.totalPoints} color="text-purple-500" />
                <StatCard icon={<Activity size={24} />} label="Avg. Progress" value={`${stats.averageProgress}%`} color="text-indigo-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    <MonthlyTasks goals={monthlyTasks} />

                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Your Role Goals</h2>
                        {roleGoals.length > 0 ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {roleGoals.map(goal => (
                                    <GoalCard key={goal.id} goal={goal} allGoals={user.goals} onUpdate={handleUpdateGoal} />
                                ))}
                            </div>
                        ) : (
                            <Card className="p-12 text-center border-dashed dark:bg-gray-800/50 dark:border-gray-700">
                                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">No Role Goals Yet</h3>
                                <p className="text-gray-600 dark:text-gray-400">These are long-term goals for your career path. Contact your manager to define them.</p>
                            </Card>
                        )}
                    </div>
                </div>
                
                <div className="lg:col-span-1 space-y-8">
                     <Card>
                        <div className="p-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center">
                                <CalendarDays className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
                                Upcoming Deadlines
                            </h2>
                            {upcomingDeadlines.length > 0 ? (
                                <div className="space-y-3">
                                    {upcomingDeadlines.map(goal => {
                                        let badgeVariant: 'danger' | 'warning' | 'default' = 'default';
                                        let deadlineText: string;

                                        if (goal.daysRemaining < 0) {
                                            badgeVariant = 'danger';
                                            const daysOver = Math.abs(goal.daysRemaining);
                                            deadlineText = `Overdue by ${daysOver} day${daysOver > 1 ? 's' : ''}`;
                                        } else if (goal.daysRemaining === 0) {
                                            badgeVariant = 'danger';
                                            deadlineText = 'Due Today';
                                        } else if (goal.daysRemaining === 1) {
                                            badgeVariant = 'warning';
                                            deadlineText = 'Due Tomorrow';
                                        } else if (goal.daysRemaining <= 7) {
                                            badgeVariant = 'warning';
                                            deadlineText = `Due in ${goal.daysRemaining} days`;
                                        } else {
                                            deadlineText = `Due in ${goal.daysRemaining} days`;
                                        }
                                        
                                        const deadlineParts = goal.deadline.split('-').map(s => parseInt(s, 10));
                                        const deadlineDate = new Date(Date.UTC(deadlineParts[0], deadlineParts[1] - 1, deadlineParts[2]));
                                        const displayDate = deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

                                        return (
                                            <div key={goal.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-50/80 hover:bg-gray-100 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-700">
                                                <div>
                                                    <p className="font-medium text-gray-800 dark:text-gray-200">{goal.title}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Due on {displayDate}
                                                    </p>
                                                </div>
                                                <Badge variant={badgeVariant} className="flex-shrink-0">{deadlineText}</Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <p>No upcoming deadlines. Great job!</p>
                                </div>
                            )}
                        </div>
                    </Card>
                    <ProgressReports />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
