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
            const pH = doc.internal.pageSize.getHeight();
            const pW = doc.internal.pageSize.getWidth();
            let y = 0;

            // ── Bold color palette (Strava / dashboard inspired) ──
            type C3 = [number, number, number];
            const c = {
                black: [17, 17, 17] as C3,
                white: [255, 255, 255] as C3,
                offWhite: [245, 245, 240] as C3,
                hotPink: [255, 46, 99] as C3,
                electricYellow: [240, 230, 40] as C3,
                mintGreen: [0, 210, 140] as C3,
                deepOrange: [255, 95, 31] as C3,
                skyBlue: [58, 175, 255] as C3,
                coral: [255, 127, 80] as C3,
                teal: [0, 175, 160] as C3,
                purple: [109, 40, 217] as C3,
                darkGray: [55, 55, 60] as C3,
                midGray: [130, 130, 135] as C3,
                lightGray: [210, 210, 210] as C3,
            };
            const accentPalette: C3[] = [c.hotPink, c.electricYellow, c.mintGreen, c.deepOrange, c.skyBlue, c.coral, c.teal, c.purple];
            const scoreColor = (s: number): C3 => s >= 7 ? c.mintGreen : s >= 4 ? c.electricYellow : c.hotPink;

            // ── Helpers ──
            const fill = (x: number, fy: number, w: number, h: number, col: C3) => { doc.setFillColor(...col); doc.rect(x, fy, w, h, 'F'); };
            const rRect = (x: number, fy: number, w: number, h: number, r: number, col: C3) => { doc.setFillColor(...col); doc.roundedRect(x, fy, w, h, r, r, 'F'); };
            const txt = (text: string, x: number, ty: number, size: number, col: C3, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
                doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...col); doc.text(text, x, ty, { align });
            };

            // ── Gather data ──
            const allReviews = [...(employee.reviews || []), review].sort((a, b) => a.month.localeCompare(b.month));
            const uniqueMonthReviews: Review[] = [];
            const seenMonths = new Set<string>();
            for (const r of allReviews) { if (!seenMonths.has(r.month)) { seenMonths.add(r.month); uniqueMonthReviews.push(r); } }

            const history = [...employee.progressHistory].sort((a, b) => a.date.localeCompare(b.date));
            if (!history.find(h => h.date === review.month)) {
                const last = history[history.length - 1] || { score: 0, tasksCompleted: 0 };
                history.push({ date: review.month, score: last.score + review.score, tasksCompleted: last.tasksCompleted + review.completedTaskIds.length });
            }

            const monthLabel = formatMonthLabel(review.month);
            const reviewedAt = review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'N/A';
            const completedTasks = review.completedTaskIds.map(id => goalLookup[String(id)] || `Goal ${id}`);
            const pendingTasks = (review.pendingTaskIds || []).map(id => goalLookup[String(id)] || `Goal ${id}`);
            const categories = review.monthlyTaskCategoryDistribution || {};
            const roleProgress = review.roleGoalProgress || [];
            const tasksTotal = review.completedTaskIds.length + pendingTasks.length;
            const scorePct = tasksTotal > 0 ? Math.round((review.score / (tasksTotal * 10)) * 100) : 0;

            // ═══════════════════════════════════════════════════════
            // PAGE 1: BOLD COVER — BIG COLOR BLOCKS + GIANT NUMBERS
            // ═══════════════════════════════════════════════════════

            // Full-page black background
            fill(0, 0, pW, pH, c.black);

            // Top bar — brand stripe with logo text
            fill(0, 0, pW, 56, c.purple);
            txt('NYX', 32, 38, 22, c.white, true);
            txt('#PERFORMANCE', pW - 32, 38, 14, c.white, true, 'right');

            // Big title area
            y = 72;
            txt(monthLabel.toUpperCase().split(' ')[0].toUpperCase(), 32, y + 40, 42, c.offWhite, true);
            txt(monthLabel.split(' ')[1] || '', 32, y + 70, 22, c.midGray, false);
            y += 90;

            // Profile row
            rRect(32, y, 50, 50, 25, c.purple);
            const initials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            txt(initials, 57, y + 33, 18, c.white, true, 'center');
            txt(employee.name, 96, y + 22, 18, c.offWhite, true);
            txt(`${employee.department} · ${employee.role}`, 96, y + 40, 11, c.midGray);
            y += 72;

            // === STAT CARDS GRID (2x2 layout with bold colors) ===
            const cardW = (pW - 32 * 3) / 2;
            const cardH = 130;
            const gap = 16;

            // Card 1 — Total Score (hot pink)
            const c1x = 32, c1y = y;
            fill(c1x, c1y, cardW, cardH, c.hotPink);
            txt('TOTAL SCORE', c1x + 20, c1y + 28, 10, c.white, true);
            txt(String(review.score), c1x + 20, c1y + 90, 52, c.white, true);
            txt('PTS', c1x + cardW - 20, c1y + 90, 14, [255, 200, 200] as C3, false, 'right');

            // Card 2 — Score % (electric yellow on black)
            const c2x = 32 + cardW + gap, c2y = y;
            fill(c2x, c2y, cardW, cardH, c.electricYellow);
            txt('SCORE %', c2x + 20, c2y + 28, 10, c.black, true);
            txt(`${scorePct}%`, c2x + 20, c2y + 90, 52, c.black, true);
            // Draw a mini donut/arc
            const arcCx = c2x + cardW - 50, arcCy = c2y + 75;
            doc.setDrawColor(17, 17, 17); doc.setLineWidth(8);
            doc.circle(arcCx, arcCy, 28, 'S');
            if (scorePct > 0) {
                doc.setDrawColor(...c.black); doc.setLineWidth(8);
                // Approximate arc with line segments
                const arcStart = -Math.PI / 2;
                const arcEnd = arcStart + (scorePct / 100) * 2 * Math.PI;
                for (let a = arcStart; a < arcEnd; a += 0.1) {
                    const x1 = arcCx + 28 * Math.cos(a), y1 = arcCy + 28 * Math.sin(a);
                    const x2 = arcCx + 28 * Math.cos(a + 0.1), y2 = arcCy + 28 * Math.sin(a + 0.1);
                    doc.setDrawColor(17, 17, 17); doc.setLineWidth(6);
                    doc.line(x1, y1, x2, y2);
                }
            }

            y += cardH + gap;

            // Card 3 — Tasks Scored (mint green)
            const c3x = 32, c3y = y;
            fill(c3x, c3y, cardW, cardH, c.mintGreen);
            txt('TASKS SCORED', c3x + 20, c3y + 28, 10, c.black, true);
            txt(`${review.completedTaskIds.length}`, c3x + 20, c3y + 90, 52, c.black, true);
            txt(`/ ${tasksTotal}`, c3x + 110, c3y + 90, 20, [0, 100, 70] as C3, false);
            // Draw small task icons (dots)
            for (let i = 0; i < Math.min(tasksTotal, 20); i++) {
                const dx = c3x + cardW - 80 + (i % 5) * 16;
                const dy = c3y + 50 + Math.floor(i / 5) * 16;
                doc.setFillColor(...(i < review.completedTaskIds.length ? c.black : [0, 150, 100] as C3));
                doc.circle(dx, dy, 5, 'F');
            }

            // Card 4 — Days / Reviewed date (deep orange)
            const c4x = 32 + cardW + gap, c4y = y;
            fill(c4x, c4y, cardW, cardH, c.deepOrange);
            txt('REVIEWED', c4x + 20, c4y + 28, 10, c.white, true);
            txt(reviewedAt, c4x + 20, c4y + 90, 28, c.white, true);
            // Decorative arrow
            doc.setDrawColor(...c.white); doc.setLineWidth(3);
            doc.line(c4x + cardW - 60, c4y + 60, c4x + cardW - 30, c4y + 80);
            doc.line(c4x + cardW - 30, c4y + 80, c4x + cardW - 60, c4y + 100);

            y += cardH + gap;

            // === TASK SCORES — Colored dot grid visualization ===
            if (review.taskScores && Object.keys(review.taskScores).length > 0) {
                const taskEntries = Object.entries(review.taskScores);
                const sectionH = taskEntries.length * 36 + 60;
                if (y + sectionH > pH - 40) { doc.addPage(); fill(0, 0, pW, pH, c.black); y = 40; }

                // Section label
                fill(32, y, 4, 24, c.skyBlue);
                txt('TASK SCORES', 48, y + 18, 12, c.offWhite, true);
                y += 44;

                taskEntries.forEach(([taskId, score]) => {
                    const taskTitle = goalLookup[taskId] || `Goal ${taskId}`;
                    const clr = scoreColor(score);
                    const truncated = taskTitle.length > 36 ? taskTitle.slice(0, 34) + '…' : taskTitle;

                    // Score circle
                    rRect(32, y, 34, 28, 6, clr);
                    txt(String(score), 49, y + 20, 14, score >= 4 && score < 7 ? c.black : c.white, true, 'center');

                    // Task name
                    txt(truncated, 78, y + 12, 10, c.offWhite, false);

                    // Score dots (1-10)
                    for (let d = 1; d <= 10; d++) {
                        const dx = pW - 32 - (10 - d) * 18;
                        doc.setFillColor(...(d <= score ? clr : c.darkGray));
                        doc.circle(dx, y + 14, 5, 'F');
                    }

                    // Feedback below if exists
                    const fb = review.taskFeedback?.[taskId]?.trim();
                    if (fb) {
                        txt(fb.length > 70 ? fb.slice(0, 68) + '…' : fb, 78, y + 26, 8, c.midGray, false);
                        y += 36;
                    } else {
                        y += 32;
                    }
                });
            }

            // === CATEGORY BREAKDOWN — Colorful blocks at bottom ===
            if (Object.keys(categories).length > 0) {
                const catEntries = Object.entries(categories);
                const totalCat = Object.values(categories).reduce((s, cc) => s + cc, 0);

                if (y + 80 > pH - 20) { doc.addPage(); fill(0, 0, pW, pH, c.black); y = 40; }

                fill(32, y, 4, 24, c.coral);
                txt('CATEGORIES', 48, y + 18, 12, c.offWhite, true);
                y += 36;

                // Stacked horizontal blocks
                let bx = 32;
                const bW = pW - 64;
                catEntries.forEach(([cat, count], i) => {
                    const segW = (count / totalCat) * bW;
                    fill(bx, y, segW, 40, accentPalette[i % accentPalette.length]);
                    if (segW > 50) {
                        const textCol: C3 = (i === 1 || i === 4) ? c.black : c.white;
                        txt(cat, bx + 8, y + 16, 8, textCol, true);
                        txt(String(count), bx + 8, y + 32, 12, textCol, true);
                    }
                    bx += segW;
                });
                y += 56;

                // Legend dots
                catEntries.forEach(([cat, count], i) => {
                    const lx = 32 + (i % 3) * 180;
                    const ly = y + Math.floor(i / 3) * 18;
                    doc.setFillColor(...accentPalette[i % accentPalette.length]);
                    doc.circle(lx + 5, ly + 5, 4, 'F');
                    txt(`${cat}: ${count}`, lx + 14, ly + 9, 8, c.midGray);
                });
            }

            // ═══════════════════════════════════════════════════════
            // PAGE 2: CUMULATIVE PERFORMANCE — FUN CHARTS
            // ═══════════════════════════════════════════════════════
            if (history.length > 1) {
                doc.addPage();
                fill(0, 0, pW, pH, c.offWhite);

                // Top colored stripe
                fill(0, 0, pW, 56, c.black);
                txt('NYX', 32, 38, 22, c.white, true);
                txt('PERFORMANCE OVER TIME', pW - 32, 38, 12, c.midGray, true, 'right');
                y = 80;

                // ── CUMULATIVE SCORE — Big area chart style ──
                fill(32, y, 4, 24, c.purple);
                txt('CUMULATIVE SCORE', 48, y + 18, 13, c.black, true);
                y += 40;

                const chartLeft = 70, chartRight = pW - 40;
                const chartTop = y, chartH2 = 200, chartBottom = y + chartH2;
                const drawW = chartRight - chartLeft, drawH = chartBottom - chartTop;

                const cumScores = history.map(h => h.score);
                const maxCum = Math.max(...cumScores, 10);

                // Grid lines (light)
                doc.setDrawColor(...c.lightGray); doc.setLineWidth(0.5);
                for (let i = 0; i <= 4; i++) {
                    const gy = chartBottom - (i / 4) * drawH;
                    doc.line(chartLeft, gy, chartRight, gy);
                    txt(String(Math.round((i / 4) * maxCum)), chartLeft - 8, gy + 4, 8, c.midGray, false, 'right');
                }

                // Area fill under the line
                const pts: [number, number][] = history.map((h, i) => [
                    chartLeft + (i / Math.max(history.length - 1, 1)) * drawW,
                    chartBottom - (h.score / maxCum) * drawH
                ]);

                // Fill area with light purple (approximate area under curve)
                const areaColor: C3 = [225, 210, 245];
                pts.forEach(([px, py], i) => {
                    if (i < pts.length - 1) {
                        const nextX = pts[i + 1][0];
                        const nextY = pts[i + 1][1];
                        const w = nextX - px;
                        const h1 = chartBottom - py;
                        const h2 = chartBottom - nextY;
                        const avgH = (h1 + h2) / 2;
                        doc.setFillColor(...areaColor);
                        doc.rect(px, chartBottom - avgH, w, avgH, 'F');
                    }
                });

                // Line
                doc.setDrawColor(...c.purple); doc.setLineWidth(3);
                for (let i = 1; i < pts.length; i++) {
                    doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
                }

                // Dots + values
                pts.forEach(([px, py], i) => {
                    doc.setFillColor(...c.white); doc.setDrawColor(...c.purple); doc.setLineWidth(2);
                    doc.circle(px, py, 6, 'FD');
                    doc.setFillColor(...c.purple); doc.circle(px, py, 3, 'F');
                    txt(String(cumScores[i]), px, py - 14, 10, c.purple, true, 'center');
                    const mLabel = new Date(history[i].date + '-02T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
                    txt(mLabel, px, chartBottom + 16, 9, c.darkGray, false, 'center');
                });

                y = chartBottom + 40;

                // ── MONTHLY COMPARISON — Bold colored bars ──
                const mScores = uniqueMonthReviews.map(r => ({ month: r.month, score: r.score, tasks: r.completedTaskIds.length }));
                if (mScores.length > 0) {
                    fill(32, y, 4, 24, c.deepOrange);
                    txt('MONTHLY BREAKDOWN', 48, y + 18, 13, c.black, true);
                    y += 40;

                    const barChartTop = y, barChartH = 180, barChartBottom = y + barChartH;
                    const barDrawH = barChartBottom - barChartTop;
                    const barCount = mScores.length;
                    const groupW = drawW / Math.max(barCount, 1);
                    const barW2 = Math.min(groupW * 0.35, 36);
                    const maxM = Math.max(...mScores.map(m => m.score), ...mScores.map(m => m.tasks * 10), 10);

                    // Grid
                    doc.setDrawColor(...c.lightGray); doc.setLineWidth(0.5);
                    for (let i = 0; i <= 4; i++) {
                        const gy = barChartBottom - (i / 4) * barDrawH;
                        doc.line(chartLeft, gy, chartRight, gy);
                        txt(String(Math.round((i / 4) * maxM)), chartLeft - 8, gy + 4, 8, c.midGray, false, 'right');
                    }

                    mScores.forEach((m, i) => {
                        const cx = chartLeft + (i + 0.5) * groupW;
                        const sH = (m.score / maxM) * barDrawH;
                        const tH = ((m.tasks * 10) / maxM) * barDrawH;

                        // Score bar (deep orange)
                        rRect(cx - barW2 - 2, barChartBottom - sH, barW2, sH, 4, c.deepOrange);
                        if (sH > 18) txt(String(m.score), cx - barW2 / 2 - 2, barChartBottom - sH + 16, 10, c.white, true, 'center');

                        // Tasks bar (teal)
                        rRect(cx + 2, barChartBottom - tH, barW2, tH, 4, c.teal);
                        if (tH > 18) txt(String(m.tasks), cx + barW2 / 2 + 2, barChartBottom - tH + 16, 10, c.white, true, 'center');

                        const mLbl = new Date(m.month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
                        txt(mLbl, cx, barChartBottom + 16, 9, c.darkGray, true, 'center');
                    });

                    // Legend boxes
                    const legY = barChartBottom + 32;
                    rRect(chartLeft, legY, 14, 14, 3, c.deepOrange);
                    txt('Score', chartLeft + 20, legY + 11, 10, c.darkGray, true);
                    rRect(chartLeft + 80, legY, 14, 14, 3, c.teal);
                    txt('Tasks (×10)', chartLeft + 100, legY + 11, 10, c.darkGray, true);

                    y = legY + 36;
                }
            }

            // ═══════════════════════════════════════════════════════
            // PAGE 3: DETAILED REPORT — Clean white page
            // ═══════════════════════════════════════════════════════
            doc.addPage();
            fill(0, 0, pW, pH, c.white);

            // Header stripe
            fill(0, 0, pW, 60, c.black);
            txt('DETAILED REVIEW', 32, 26, 10, c.midGray, true);
            txt(monthLabel.toUpperCase(), 32, 46, 18, c.white, true);
            txt(`${employee.name}  ·  ${employee.department}`, pW - 32, 40, 10, c.midGray, false, 'right');
            y = 80;

            // Meta info
            txt(`Reviewed: ${reviewedAt}  |  Score: ${review.score} pts  |  Generated: ${new Date().toLocaleDateString()}`, 32, y, 9, c.midGray);
            y += 24;

            // Manager Feedback section
            fill(32, y, pW - 64, 2, c.purple); y += 12;
            txt('MANAGER FEEDBACK', 32, y + 10, 11, c.black, true); y += 22;
            const fbText = review.managerFeedback?.trim() || 'No feedback recorded.';
            const fbWrapped = doc.splitTextToSize(fbText, pW - 80);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...c.darkGray);
            fbWrapped.forEach((line: string) => { doc.text(line, 32, y); y += 14; });
            y += 10;

            // Task Scores section
            fill(32, y, pW - 64, 2, c.deepOrange); y += 12;
            txt('TASK SCORES & FEEDBACK', 32, y + 10, 11, c.black, true); y += 26;

            if (review.taskScores && Object.keys(review.taskScores).length > 0) {
                Object.entries(review.taskScores).forEach(([taskId, score]) => {
                    const taskTitle = goalLookup[taskId] || `Goal ${taskId}`;
                    const feedback = review.taskFeedback?.[taskId] || '';
                    const clr = scoreColor(score);

                    if (y + 36 > pH - 40) { doc.addPage(); fill(0, 0, pW, pH, c.white); y = 40; }

                    // Score badge
                    rRect(32, y - 4, 28, 18, 4, clr);
                    txt(String(score), 46, y + 9, 10, score >= 4 && score < 7 ? c.black : c.white, true, 'center');
                    txt(taskTitle, 70, y + 9, 10, c.black, true);
                    y += 18;
                    if (feedback) {
                        const w = doc.splitTextToSize(feedback, pW - 100);
                        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...c.midGray);
                        w.forEach((line: string) => { doc.text(line, 70, y); y += 12; });
                    }
                    y += 6;
                });
            } else {
                completedTasks.forEach(task => { txt(`· ${task}`, 32, y, 10, c.darkGray); y += 14; });
            }

            if (pendingTasks.length > 0) {
                y += 6;
                fill(32, y, pW - 64, 2, c.electricYellow); y += 12;
                txt('PENDING TASKS', 32, y + 10, 11, c.black, true); y += 26;
                pendingTasks.forEach(task => {
                    if (y + 16 > pH - 30) { doc.addPage(); fill(0, 0, pW, pH, c.white); y = 40; }
                    txt(`· ${task}`, 32, y, 9, c.midGray); y += 14;
                });
            }

            if (roleProgress.length > 0) {
                y += 6;
                fill(32, y, pW - 64, 2, c.mintGreen); y += 12;
                txt('ROLE GOAL PROGRESS', 32, y + 10, 11, c.black, true); y += 26;
                roleProgress.forEach(item => {
                    const goalTitle = goalLookup[String(item.goalId)] || `Goal ${item.goalId}`;
                    if (y + 28 > pH - 30) { doc.addPage(); fill(0, 0, pW, pH, c.white); y = 40; }
                    txt(`${goalTitle}: ${item.progress}%`, 32, y, 10, c.darkGray);
                    y += 14;
                    rRect(32, y, pW - 64, 10, 5, c.lightGray);
                    const fillW = (item.progress / 100) * (pW - 64);
                    if (fillW > 0) rRect(32, y, Math.max(fillW, 10), 10, 5, item.progress >= 75 ? c.mintGreen : item.progress >= 40 ? c.electricYellow : c.hotPink);
                    y += 18;
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
