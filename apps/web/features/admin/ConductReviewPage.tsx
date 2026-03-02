import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Star, Sliders, MessageSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { sendReviewReportEmail } from '../../lib/api';
import { GoalType, GoalStatus } from '../../types';
import type { User as UserType, Goal, Review, ProgressHistory } from '../../types';

interface ConductReviewPageProps {
    employee: UserType;
    onBack: () => void;
}

const formatMonthLabel = (month: string) => {
    return new Date(month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const RatingSelector: React.FC<{ value: number; onChange: (v: number) => void; }> = ({ value, onChange }) => {
    return (
        <div className="flex items-center gap-1.5">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(value === n ? 0 : n)}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-150 border ${
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

const ConductReviewPage: React.FC<ConductReviewPageProps> = ({ employee, onBack }) => {
    const { updateGoal, updateEmployee, createReview, refreshEmployees, refreshNotifications, currentUser, employees } = useApp();

    const currentMonth = new Date().toISOString().slice(0, 7);

    const { monthlyTasks, roleGoals, categorizedTasks } = useMemo(() => {
        const tasks = employee.goals.filter((g) => {
            if (g.type !== GoalType.MONTHLY_TASK) return false;
            if (g.reviewPeriod === currentMonth) return true;
            if (!g.reviewPeriod) return g.status !== GoalStatus.COMPLETED;
            return g.reviewPeriod < currentMonth && g.status !== GoalStatus.COMPLETED;
        });
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

    const [taskScores, setTaskScores] = useState<Record<string, number>>({});
    const [taskFeedback, setTaskFeedback] = useState<Record<string, string>>({});
    const [roleGoalProgress, setRoleGoalProgress] = useState<Record<string, number>>({});
    const [managerFeedback, setManagerFeedback] = useState('');

    useEffect(() => {
        setTaskScores({});
        setTaskFeedback({});
        setManagerFeedback('');
        setRoleGoalProgress(
            roleGoals.reduce((acc, goal) => {
                acc[String(goal.id)] = goal.progress;
                return acc;
            }, {} as Record<string, number>)
        );
    }, [roleGoals]);

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
            createdAt: new Date().toISOString(),
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
            pendingTaskIds,
            roleGoalProgress: Object.entries(roleGoalProgress).map(([goalId, progress]) => ({ goalId, progress })),
            monthlyTaskCategoryDistribution,
            taskScores,
            taskFeedback
        });

        await refreshEmployees();
        await refreshNotifications();
        await handleDownloadReview(newReview);
        onBack();
    };

    const sortedReviews = useMemo(() => {
        return [...(employee.reviews || [])].sort((a, b) => {
            const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
            const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
            return bTime - aTime;
        });
    }, [employee.reviews]);
    const reviewKey = (review: Review) => `${review.month}::${review.createdAt || ''}`;
    const [selectedReviewMonth, setSelectedReviewMonth] = useState(sortedReviews[0] ? reviewKey(sortedReviews[0]) : '');
    const selectedReview = sortedReviews.find(review => reviewKey(review) === selectedReviewMonth);
    const goalLookup = useMemo(() => {
        return employee.goals.reduce((acc, goal) => {
            acc[String(goal.id)] = goal.title;
            return acc;
        }, {} as Record<string, string>);
    }, [employee.goals]);

    useEffect(() => {
        setSelectedReviewMonth(sortedReviews[0] ? reviewKey(sortedReviews[0]) : '');
    }, [sortedReviews]);

    const monthName = new Date(currentMonth + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const totalScore = Object.values(taskScores).reduce((sum, r) => sum + r, 0);
    const maxPossible = monthlyTasks.length * 10;

    const handleDownloadReview = async (review: Review) => {
        try {
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 40;
            const contentWidth = pageWidth - margin * 2;
            const lineHeight = 16;
            let y = margin;

            // ── Color palette ──
            const colors = {
                brand: [109, 40, 217] as [number, number, number],
                brandLight: [237, 233, 254] as [number, number, number],
                green: [34, 197, 94] as [number, number, number],
                yellow: [234, 179, 8] as [number, number, number],
                red: [239, 68, 68] as [number, number, number],
                gray: [107, 114, 128] as [number, number, number],
                grayLight: [229, 231, 235] as [number, number, number],
                grayDark: [55, 65, 81] as [number, number, number],
                white: [255, 255, 255] as [number, number, number],
                black: [17, 24, 39] as [number, number, number],
                blue: [59, 130, 246] as [number, number, number],
                orange: [249, 115, 22] as [number, number, number],
                teal: [20, 184, 166] as [number, number, number],
            };
            const chartColors = [colors.brand, colors.blue, colors.green, colors.orange, colors.teal, colors.red, colors.yellow];

            const scoreColor = (s: number): [number, number, number] => s >= 7 ? colors.green : s >= 4 ? colors.yellow : colors.red;

            // ── Helpers ──
            const ensureSpace = (needed: number) => {
                if (y + needed > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }
            };

            const addText = (text: string, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'center' | 'right'; maxWidth?: number }) => {
                const size = opts?.size ?? 10;
                const bold = opts?.bold ?? false;
                const color = opts?.color ?? colors.black;
                const align = opts?.align ?? 'left';
                const maxW = opts?.maxWidth ?? contentWidth;
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                doc.setFontSize(size);
                doc.setTextColor(...color);
                const wrapped = doc.splitTextToSize(text, maxW);
                wrapped.forEach((line: string) => {
                    ensureSpace(lineHeight);
                    const xPos = align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - margin : margin;
                    doc.text(line, xPos, y, { align });
                    y += lineHeight;
                });
            };

            const addSection = (title: string) => {
                ensureSpace(30);
                y += 8;
                doc.setDrawColor(...colors.brand);
                doc.setLineWidth(2);
                doc.line(margin, y, margin + 40, y);
                y += 12;
                addText(title, { size: 13, bold: true, color: colors.grayDark });
                y += 2;
            };

            const drawRoundedRect = (x: number, ry: number, w: number, h: number, r: number, fill: [number, number, number], border?: [number, number, number]) => {
                doc.setFillColor(...fill);
                if (border) { doc.setDrawColor(...border); doc.setLineWidth(0.5); }
                doc.roundedRect(x, ry, w, h, r, r, border ? 'FD' : 'F');
            };

            // ── Gather history data ──
            const allReviews = [...(employee.reviews || []), review].sort((a, b) => a.month.localeCompare(b.month));
            const uniqueMonthReviews: Review[] = [];
            const seenMonths = new Set<string>();
            for (const r of allReviews) {
                if (!seenMonths.has(r.month)) {
                    seenMonths.add(r.month);
                    uniqueMonthReviews.push(r);
                }
            }

            const history = [...employee.progressHistory].sort((a, b) => a.date.localeCompare(b.date));
            // Ensure current month is in history
            const currentEntry = history.find(h => h.date === review.month);
            if (!currentEntry) {
                const lastH = history[history.length - 1] || { score: 0, tasksCompleted: 0 };
                history.push({ date: review.month, score: lastH.score + review.score, tasksCompleted: lastH.tasksCompleted + review.completedTaskIds.length });
            }

            const monthLabel = formatMonthLabel(review.month);
            const reviewedAt = review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Not available';
            const completedTasks = review.completedTaskIds.map(id => goalLookup[String(id)] || `Goal ${id}`);
            const pendingTasks = (review.pendingTaskIds || []).map(id => goalLookup[String(id)] || `Goal ${id}`);
            const categories = review.monthlyTaskCategoryDistribution || {};
            const roleProgress = review.roleGoalProgress || [];

            // ═══════════════════════════════════════════════════════
            // PAGE 1: COVER + SUMMARY CARD + SCORE GAUGE
            // ═══════════════════════════════════════════════════════

            // Header bar
            drawRoundedRect(margin, y, contentWidth, 60, 6, colors.brand);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(...colors.white);
            doc.text('Performance Review Report', margin + 16, y + 26);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`${employee.name}  •  ${employee.department}  •  ${monthLabel}`, margin + 16, y + 46);
            y += 76;

            // Summary cards row
            const cardW = (contentWidth - 20) / 3;
            const cardH = 60;
            const summaryCards = [
                { label: 'Total Score', value: String(review.score), color: colors.brand },
                { label: 'Tasks Scored', value: `${review.completedTaskIds.length} / ${review.completedTaskIds.length + pendingTasks.length}`, color: colors.green },
                { label: 'Reviewed', value: reviewedAt, color: colors.blue },
            ];
            summaryCards.forEach((card, i) => {
                const cx = margin + i * (cardW + 10);
                drawRoundedRect(cx, y, cardW, cardH, 4, colors.white, colors.grayLight);
                doc.setFillColor(...card.color);
                doc.roundedRect(cx, y, 4, cardH, 2, 2, 'F');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...colors.gray);
                doc.text(card.label, cx + 14, y + 22);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(...colors.black);
                doc.text(card.value, cx + 14, y + 44);
            });
            y += cardH + 20;

            // ── Current Review: Task Scores (horizontal bar chart) ──
            if (review.taskScores && Object.keys(review.taskScores).length > 0) {
                const taskEntries = Object.entries(review.taskScores);
                const chartH = Math.max(taskEntries.length * 28 + 50, 100);
                ensureSpace(chartH + 30);

                addSection('Task Scores — This Review');
                const chartTop = y;
                const barAreaX = margin + 180;
                const barMaxW = contentWidth - 190;

                taskEntries.forEach(([taskId, score], i) => {
                    const taskTitle = goalLookup[taskId] || `Goal ${taskId}`;
                    const barY = chartTop + i * 28;
                    const barW = (score / 10) * barMaxW;
                    const clr = scoreColor(score);

                    // Label
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(...colors.grayDark);
                    const truncated = taskTitle.length > 30 ? taskTitle.slice(0, 28) + '…' : taskTitle;
                    doc.text(truncated, margin, barY + 12);

                    // Bar background
                    drawRoundedRect(barAreaX, barY + 2, barMaxW, 16, 3, colors.grayLight);
                    // Bar fill
                    if (barW > 0) {
                        drawRoundedRect(barAreaX, barY + 2, Math.max(barW, 6), 16, 3, clr);
                    }
                    // Score label
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    doc.setTextColor(...colors.white);
                    if (barW > 24) {
                        doc.text(`${score}`, barAreaX + barW - 16, barY + 14);
                    } else {
                        doc.setTextColor(...clr);
                        doc.text(`${score}`, barAreaX + barW + 6, barY + 14);
                    }
                });
                y = chartTop + taskEntries.length * 28 + 10;

                // Scale markers
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(...colors.gray);
                [0, 2, 4, 6, 8, 10].forEach(v => {
                    const xPos = barAreaX + (v / 10) * barMaxW;
                    doc.text(String(v), xPos, y + 10, { align: 'center' });
                });
                y += 20;
            }

            // ── Task Feedback Details ──
            if (review.taskFeedback && Object.values(review.taskFeedback).some(f => f.trim())) {
                ensureSpace(60);
                addSection('Task Feedback Details');
                Object.entries(review.taskScores || {}).forEach(([taskId, score]) => {
                    const feedback = review.taskFeedback?.[taskId]?.trim();
                    if (!feedback) return;
                    const taskTitle = goalLookup[taskId] || `Goal ${taskId}`;
                    ensureSpace(40);
                    const clr = scoreColor(score);
                    doc.setFillColor(...clr);
                    doc.circle(margin + 4, y + 4, 3, 'F');
                    addText(`${taskTitle} (${score}/10)`, { size: 10, bold: true, color: colors.grayDark });
                    addText(feedback, { size: 9, color: colors.gray });
                    y += 4;
                });
            }

            // ═══════════════════════════════════════════════════════
            // CUMULATIVE CHARTS PAGE
            // ═══════════════════════════════════════════════════════
            if (history.length > 1) {
                doc.addPage();
                y = margin;

                // Header
                drawRoundedRect(margin, y, contentWidth, 36, 4, colors.brandLight);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(...colors.brand);
                doc.text('Cumulative Performance Over Time', margin + 12, y + 24);
                y += 52;

                // ── Line chart: Cumulative Score ──
                const chartW = contentWidth;
                const chartH = 180;
                const chartLeft = margin + 40;
                const chartRight = margin + chartW - 10;
                const chartTop = y + 20;
                const chartBottom = y + chartH;
                const drawW = chartRight - chartLeft;
                const drawH = chartBottom - chartTop;

                addText('Cumulative Score Trend', { size: 11, bold: true, color: colors.grayDark });
                y += 4;

                const scores = history.map(h => h.score);
                const maxScore = Math.max(...scores, 10);
                const yScale = (v: number) => chartBottom - (v / maxScore) * drawH;

                // Grid
                doc.setDrawColor(...colors.grayLight);
                doc.setLineWidth(0.3);
                const gridSteps = 5;
                for (let i = 0; i <= gridSteps; i++) {
                    const gy = chartBottom - (i / gridSteps) * drawH;
                    doc.line(chartLeft, gy, chartRight, gy);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.setTextColor(...colors.gray);
                    const labelVal = Math.round((i / gridSteps) * maxScore);
                    doc.text(String(labelVal), chartLeft - 6, gy + 3, { align: 'right' });
                }

                // Plot line
                doc.setDrawColor(...colors.brand);
                doc.setLineWidth(2);
                const points: [number, number][] = history.map((h, i) => {
                    const px = chartLeft + (i / Math.max(history.length - 1, 1)) * drawW;
                    const py = yScale(h.score);
                    return [px, py];
                });
                for (let i = 1; i < points.length; i++) {
                    doc.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
                }

                // Dots + labels
                points.forEach(([px, py], i) => {
                    doc.setFillColor(...colors.white);
                    doc.setDrawColor(...colors.brand);
                    doc.setLineWidth(1.5);
                    doc.circle(px, py, 4, 'FD');
                    doc.setFillColor(...colors.brand);
                    doc.circle(px, py, 2, 'F');

                    // Value label
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(8);
                    doc.setTextColor(...colors.brand);
                    doc.text(String(scores[i]), px, py - 10, { align: 'center' });

                    // Month label
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.setTextColor(...colors.gray);
                    const mLabel = new Date(history[i].date + '-02T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                    doc.text(mLabel, px, chartBottom + 14, { align: 'center' });
                });

                y = chartBottom + 30;

                // ── Bar chart: Monthly Scores (non-cumulative) ──
                const monthlyScores = uniqueMonthReviews.map(r => ({ month: r.month, score: r.score, tasks: r.completedTaskIds.length }));

                if (monthlyScores.length > 0) {
                    const barChartH = 160;
                    ensureSpace(barChartH + 60);
                    y += 10;

                    addText('Monthly Scores & Tasks Completed', { size: 11, bold: true, color: colors.grayDark });
                    y += 4;

                    const barChartTop = y + 10;
                    const barChartBottom = y + barChartH;
                    const barDrawH = barChartBottom - barChartTop;
                    const barCount = monthlyScores.length;
                    const groupW = drawW / Math.max(barCount, 1);
                    const barW = Math.min(groupW * 0.3, 30);
                    const maxMonthly = Math.max(...monthlyScores.map(m => m.score), ...monthlyScores.map(m => m.tasks), 10);

                    // Grid
                    doc.setDrawColor(...colors.grayLight);
                    doc.setLineWidth(0.3);
                    for (let i = 0; i <= 4; i++) {
                        const gy = barChartBottom - (i / 4) * barDrawH;
                        doc.line(chartLeft, gy, chartRight, gy);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(7);
                        doc.setTextColor(...colors.gray);
                        doc.text(String(Math.round((i / 4) * maxMonthly)), chartLeft - 6, gy + 3, { align: 'right' });
                    }

                    monthlyScores.forEach((m, i) => {
                        const cx = chartLeft + (i + 0.5) * groupW;

                        // Score bar
                        const scoreH = (m.score / maxMonthly) * barDrawH;
                        drawRoundedRect(cx - barW - 1, barChartBottom - scoreH, barW, scoreH, 2, colors.brand);

                        // Tasks bar
                        const taskH = (m.tasks / maxMonthly) * barDrawH;
                        drawRoundedRect(cx + 1, barChartBottom - taskH, barW, taskH, 2, colors.green);

                        // Value labels on top of bars
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(7);
                        doc.setTextColor(...colors.brand);
                        if (scoreH > 12) doc.text(String(m.score), cx - barW / 2 - 1, barChartBottom - scoreH - 4, { align: 'center' });
                        doc.setTextColor(...colors.green);
                        if (taskH > 12) doc.text(String(m.tasks), cx + barW / 2 + 1, barChartBottom - taskH - 4, { align: 'center' });

                        // Month label
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(7);
                        doc.setTextColor(...colors.gray);
                        const mLbl = new Date(m.month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
                        doc.text(mLbl, cx, barChartBottom + 14, { align: 'center' });
                    });

                    // Legend
                    const legendY = barChartBottom + 28;
                    doc.setFillColor(...colors.brand);
                    doc.roundedRect(chartLeft, legendY, 10, 8, 2, 2, 'F');
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    doc.setTextColor(...colors.grayDark);
                    doc.text('Score', chartLeft + 14, legendY + 7);

                    doc.setFillColor(...colors.green);
                    doc.roundedRect(chartLeft + 60, legendY, 10, 8, 2, 2, 'F');
                    doc.text('Tasks Completed', chartLeft + 74, legendY + 7);

                    y = legendY + 24;
                }

                // ── Category Distribution (pie-like horizontal stacked bar) ──
                if (Object.keys(categories).length > 0) {
                    ensureSpace(80);
                    y += 10;
                    addText('Task Category Distribution — This Review', { size: 11, bold: true, color: colors.grayDark });
                    y += 6;

                    const totalCat = Object.values(categories).reduce((s, c) => s + c, 0);
                    let barX = chartLeft;
                    const catBarH = 24;
                    const catEntries = Object.entries(categories);

                    // Stacked bar
                    catEntries.forEach(([, count], i) => {
                        const segW = (count / totalCat) * drawW;
                        doc.setFillColor(...chartColors[i % chartColors.length]);
                        if (i === 0) {
                            doc.roundedRect(barX, y, segW, catBarH, 4, 4, 'F');
                        } else if (i === catEntries.length - 1) {
                            doc.roundedRect(barX, y, segW, catBarH, 4, 4, 'F');
                        } else {
                            doc.rect(barX, y, segW, catBarH, 'F');
                        }
                        // Label inside bar if wide enough
                        if (segW > 30) {
                            doc.setFont('helvetica', 'bold');
                            doc.setFontSize(8);
                            doc.setTextColor(...colors.white);
                            doc.text(String(count), barX + segW / 2, y + catBarH / 2 + 3, { align: 'center' });
                        }
                        barX += segW;
                    });
                    y += catBarH + 8;

                    // Legend
                    catEntries.forEach(([cat], i) => {
                        const lx = chartLeft + (i % 3) * (drawW / 3);
                        const ly = y + Math.floor(i / 3) * 16;
                        doc.setFillColor(...chartColors[i % chartColors.length]);
                        doc.roundedRect(lx, ly, 8, 8, 2, 2, 'F');
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(8);
                        doc.setTextColor(...colors.grayDark);
                        doc.text(cat, lx + 12, ly + 7);
                    });
                    y += Math.ceil(catEntries.length / 3) * 16 + 10;
                }
            }

            // ═══════════════════════════════════════════════════════
            // DETAILED TEXT REPORT
            // ═══════════════════════════════════════════════════════
            doc.addPage();
            y = margin;

            drawRoundedRect(margin, y, contentWidth, 36, 4, colors.brandLight);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...colors.brand);
            doc.text('Detailed Review — ' + monthLabel, margin + 12, y + 24);
            y += 52;

            addText(`Employee: ${employee.name}  |  Department: ${employee.department}  |  Role: ${employee.role}`, { size: 9, color: colors.gray });
            addText(`Reviewed: ${reviewedAt}  |  Total Score: ${review.score}  |  Generated: ${new Date().toLocaleString()}`, { size: 9, color: colors.gray });
            y += 6;

            addSection('Manager Feedback');
            addText(review.managerFeedback?.trim() || 'No feedback recorded.', { size: 10, color: colors.grayDark });

            addSection('Task Scores & Feedback');
            if (review.taskScores && Object.keys(review.taskScores).length > 0) {
                Object.entries(review.taskScores).forEach(([taskId, score]) => {
                    const taskTitle = goalLookup[taskId] || `Goal ${taskId}`;
                    const feedback = review.taskFeedback?.[taskId] || '';
                    ensureSpace(30);
                    addText(`• ${taskTitle}: ${score}/10`, { size: 10, bold: true, color: scoreColor(score) });
                    if (feedback) {
                        addText(`  ${feedback}`, { size: 9, color: colors.gray });
                    }
                });
            } else {
                completedTasks.forEach(task => addText(`• ${task}`, { size: 10 }));
            }

            if (pendingTasks.length > 0) {
                addSection('Pending Tasks');
                pendingTasks.forEach(task => addText(`• ${task}`, { size: 10, color: colors.gray }));
            }

            if (roleProgress.length > 0) {
                addSection('Role Goal Progress');
                roleProgress.forEach(item => {
                    const goalTitle = goalLookup[String(item.goalId)] || `Goal ${item.goalId}`;
                    ensureSpace(24);
                    addText(`${goalTitle}: ${item.progress}%`, { size: 10, color: colors.grayDark });
                    // Mini progress bar
                    const barY = y - 2;
                    drawRoundedRect(margin, barY, contentWidth, 8, 3, colors.grayLight);
                    const fillW = (item.progress / 100) * contentWidth;
                    if (fillW > 0) {
                        drawRoundedRect(margin, barY, Math.max(fillW, 6), 8, 3, item.progress >= 75 ? colors.green : item.progress >= 40 ? colors.yellow : colors.red);
                    }
                    y += 10;
                });
            }

            // ── Save & Email ──
            const fileName = `${employee.name.replace(/\s+/g, '_')}_Review_${review.month}.pdf`;
            const dataUri = doc.output('datauristring');
            const contentBase64 = dataUri.split(',')[1] ?? '';
            const managerEmail = employee.managerId
                ? employees.find(manager => String(manager.id) === String(employee.managerId))?.email
                : undefined;
            const recipients = Array.from(
                new Set([employee.email, managerEmail, currentUser?.email].filter(Boolean))
            ) as string[];

            if (contentBase64 && recipients.length > 0) {
                try {
                    await sendReviewReportEmail({
                        to: recipients,
                        subject: `Performance Review Report - ${employee.name}`,
                        text: `Attached is the performance review report for ${employee.name} (${monthLabel}). Reviewed at: ${reviewedAt}.`,
                        filename: fileName,
                        contentBase64
                    });
                } catch (error) {
                    console.error('Failed to send review email', error);
                    alert('Unable to email the PDF report right now.');
                }
            }

            doc.save(fileName);
        } catch (error) {
            console.error('Failed to generate PDF', error);
            alert('Unable to generate the PDF report right now.');
        }
    };

    return (
        <div className="space-y-6">
            <header className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-nyx-600 dark:text-nyx-400">PERFORMANCE REVIEW</p>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">Conducting Review for {employee.name}</h1>
                        <p className="text-lg text-gray-500 dark:text-gray-400">{monthName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{employee.department} · <span className="capitalize">{employee.role}</span></p>
                    </div>
                    <div className="flex items-center gap-4">
                        {monthlyTasks.length > 0 && (
                            <div className="inline-flex items-center gap-2 bg-nyx-50 dark:bg-nyx-500/10 border border-nyx-200 dark:border-nyx-500/30 rounded-lg px-4 py-2">
                                <Star className="w-5 h-5 text-nyx-600 dark:text-nyx-400" />
                                <span className="text-lg font-bold text-nyx-700 dark:text-nyx-300">{totalScore}/{maxPossible}</span>
                            </div>
                        )}
                        <Button variant="outline" onClick={onBack}>Back to Admin</Button>
                    </div>
                </div>
            </header>

            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 pb-3 border-b dark:border-gray-700 flex items-center">
                        <Star className="w-6 h-6 mr-3 text-gray-400 dark:text-gray-500" />
                        Monthly Tasks — Rate &amp; Review
                    </h2>
                    <Card>
                        <div className="p-5">
                            <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-2">
                                {monthlyTasks.length > 0 ? (
                                    Object.entries(categorizedTasks).map(([category, tasks]) => (
                                        <div key={category}>
                                             <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-gray-700 pb-2">
                                                {category}
                                            </h3>
                                            <div className="space-y-4 pt-1">
                                                {tasks.map(task => {
                                                    const currentScore = taskScores[String(task.id)] || 0;
                                                    return (
                                                        <div key={task.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-gray-800 dark:text-gray-200">{task.title}</p>
                                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{task.description}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 ml-4">
                                                                    <Badge variant="purple">{task.points} pts</Badge>
                                                                    {currentScore > 0 && (
                                                                        <Badge variant={currentScore >= 7 ? 'success' : currentScore >= 4 ? 'warning' : 'danger'}>
                                                                            {currentScore}/10
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="mb-3">
                                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Score (1-10)</label>
                                                                <RatingSelector
                                                                    value={currentScore}
                                                                    onChange={(v) => handleScoreChange(task.id, v)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Task Feedback</label>
                                                                <textarea
                                                                    value={taskFeedback[String(task.id)] || ''}
                                                                    onChange={(e) => handleTaskFeedbackChange(task.id, e.target.value)}
                                                                    placeholder="Provide specific feedback for this task..."
                                                                    className="w-full h-20 p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nyx-500 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-white resize-none"
                                                                />
                                                            </div>
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 pb-3 border-b dark:border-gray-700 flex items-center">
                        <Sliders className="w-6 h-6 mr-3 text-gray-400 dark:text-gray-500" />
                        Role Goal Progress Update
                    </h2>
                    <Card>
                        <div className="p-5">
                            <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
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
                                                value={roleGoalProgress[String(goal.id)] || 0}
                                                onChange={(e) => handleProgressChange(goal.id, Number(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                           />
                                           <span className="font-semibold text-gray-800 dark:text-gray-200 w-12 text-center">{roleGoalProgress[String(goal.id)] || 0}%</span>
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 pb-3 border-b dark:border-gray-700 flex items-center">
                        <MessageSquare className="w-6 h-6 mr-3 text-gray-400 dark:text-gray-500" />
                        Manager's Overall Feedback
                    </h2>
                    <Card>
                         <div className="p-5">
                             <textarea
                                value={managerFeedback}
                                onChange={(e) => setManagerFeedback(e.target.value)}
                                placeholder="Provide qualitative feedback, commendations, and areas for improvement..."
                                className="w-full h-36 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nyx-500 bg-white text-gray-900 dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                required
                            />
                        </div>
                    </Card>
                </div>

                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 pb-3 border-b dark:border-gray-700">
                        Previous Reviews
                    </h2>
                    <Card>
                        <div className="p-5 space-y-4">
                            {sortedReviews.length === 0 ? (
                                <p className="text-gray-500 dark:text-gray-400">No previous reviews available yet.</p>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="review-month">
                                            Select a month to view
                                        </label>
                                        <select
                                            id="review-month"
                                            value={selectedReviewMonth}
                                            onChange={(event) => setSelectedReviewMonth(event.target.value)}
                                            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            {sortedReviews.map((review, index) => (
                                                <option key={`${review.month}-${index}`} value={reviewKey(review)}>
                                                    {formatMonthLabel(review.month)} ({review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'sem data'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedReview && (
                                        <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                            <div className="flex justify-end">
                                                <Button size="sm" variant="outline" onClick={() => handleDownloadReview(selectedReview)}>
                                                    Download PDF
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                                                <span><strong className="text-gray-800 dark:text-gray-200">Total Score:</strong> {selectedReview.score}</span>
                                                <span><strong className="text-gray-800 dark:text-gray-200">Tasks Scored:</strong> {selectedReview.completedTaskIds.length}</span>
                                                <span><strong className="text-gray-800 dark:text-gray-200">Tasks Pending:</strong> {selectedReview.pendingTaskIds?.length || 0}</span>
                                                <span><strong className="text-gray-800 dark:text-gray-200">Reviewed At:</strong> {selectedReview.createdAt ? new Date(selectedReview.createdAt).toLocaleDateString() : 'Not available'}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Manager Feedback</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{selectedReview.managerFeedback || 'No feedback recorded.'}</p>
                                            </div>
                                            {/* Task Scores & Feedback for new reviews */}
                                            {selectedReview.taskScores && Object.keys(selectedReview.taskScores).length > 0 && (
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Task Scores & Feedback</p>
                                                    <div className="space-y-2">
                                                        {Object.entries(selectedReview.taskScores).map(([taskId, score]) => (
                                                            <div key={taskId} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{goalLookup[taskId] || `Goal ${taskId}`}</span>
                                                                    <Badge variant={score >= 7 ? 'success' : score >= 4 ? 'warning' : 'danger'}>{score}/10</Badge>
                                                                </div>
                                                                {selectedReview.taskFeedback?.[taskId] && (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedReview.taskFeedback[taskId]}</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedReview.monthlyTaskCategoryDistribution && (
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Completed Tasks by Category</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(selectedReview.monthlyTaskCategoryDistribution).map(([category, count]) => (
                                                            <Badge key={category} variant="purple">{category}: {count}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedReview.pendingTaskIds?.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Pending Tasks</p>
                                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                                        {selectedReview.pendingTaskIds.map((taskId) => (
                                                            <div key={taskId}>
                                                                {goalLookup[String(taskId)] || `Goal ${taskId}`}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedReview.roleGoalProgress.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Role Goal Progress</p>
                                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                                        {selectedReview.roleGoalProgress.map(progress => (
                                                            <div key={progress.goalId} className="flex items-center justify-between">
                                                                <span>{goalLookup[String(progress.goalId)] || `Goal ${progress.goalId}`}</span>
                                                                <span className="font-semibold text-gray-800 dark:text-gray-200">{progress.progress}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 mt-8">
                    <Button variant="secondary" size="lg" onClick={onBack}>Cancel</Button>
                    <Button variant="primary" size="lg" onClick={handleFinalizeClick}>Finalize & Generate Report</Button>
                </div>
            </div>
        </div>
    );
};

export default ConductReviewPage;
