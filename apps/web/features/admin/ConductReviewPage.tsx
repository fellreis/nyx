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

        // Auto-carry-forward: move unfinished tasks (scored <7) to next month
        const nextMonth = (() => {
            const [y, m] = currentMonth.split('-').map(Number);
            const d = new Date(y, m, 1); // month is 0-indexed so m already = next month
            return d.toISOString().slice(0, 7);
        })();
        for (const taskId of pendingTaskIds) {
            await updateGoal(taskId, { reviewPeriod: nextMonth } as Partial<Goal>);
        }
        // Also carry forward scored tasks that didn't reach completion (score >0 but <7)
        for (const taskId of completedTaskIds) {
            const taskRating = taskScores[String(taskId)] || 0;
            if (taskRating > 0 && taskRating < 7) {
                await updateGoal(taskId, { reviewPeriod: nextMonth } as Partial<Goal>);
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

            // ── NYX logo as base64 PNG (white on transparent) ──
            const NYX_LOGO_B64 = 'data:image/png;base64,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';
            const NYX_LOGO_RAW = NYX_LOGO_B64.replace(/^data:image\/\w+;base64,/, '');

            // ── Bold color palette (Strava / dashboard inspired) ──
            type C3 = [number, number, number];
            const c = {
                black: [17, 17, 17] as C3,
                white: [255, 255, 255] as C3,
                offWhite: [245, 245, 240] as C3,
                hotPink: [255, 46, 99] as C3,
                electricYellow: [240, 230, 40] as C3,
                mintGreen: [0, 210, 140] as C3,
                nyxGreen: [0, 254, 138] as C3,
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
            // PAGE 1: BOLD COVER — PILLAR CHART + COLOR BLOCKS
            // ═══════════════════════════════════════════════════════

            // Full-page black background
            fill(0, 0, pW, pH, c.black);

            // Top bar — logo image + brand tag
            fill(0, 0, pW, 56, [10, 10, 10] as C3);
            try { doc.addImage(NYX_LOGO_RAW, 'PNG', 24, 12, 80, 32); } catch { txt('NYX', 32, 38, 22, c.white, true); }
            txt('#PERFORMANCE', pW - 32, 38, 14, c.nyxGreen, true, 'right');
            y = 64;

            // ── PROGRESS OVER MONTHS — Tall pillar / column chart ──
            // Gather monthly score data for the pillar chart
            const pillarData = uniqueMonthReviews.map(r => {
                const ts = r.taskScores ? Object.values(r.taskScores) : [];
                const avg = ts.length > 0 ? ts.reduce((a, b) => a + b, 0) / ts.length : r.score / Math.max(r.completedTaskIds.length, 1);
                return { month: r.month, avg: Math.min(avg, 10), score: r.score };
            });

            if (pillarData.length > 0) {
                const pillarSection = 220;
                const pillarTop = y + 8;
                const pillarBottom = y + pillarSection - 24;
                const pillarH = pillarBottom - pillarTop;
                const pillarLeft = 48;
                const pillarRight = pW - 48;
                const pillarDrawW = pillarRight - pillarLeft;
                const maxAvg = Math.max(...pillarData.map(p => p.avg), 10);
                const colCount = pillarData.length;
                const groupWidth = pillarDrawW / Math.max(colCount, 1);
                const colWidth = Math.min(groupWidth * 0.55, 56);

                // Section title
                txt('PROGRESS OVER MONTHS', pillarLeft, pillarTop + 14, 11, c.midGray, true);

                // Subtle horizontal grid lines
                doc.setDrawColor(40, 40, 44); doc.setLineWidth(0.5);
                for (let i = 0; i <= 4; i++) {
                    const gy = pillarBottom - (i / 4) * (pillarH - 28);
                    doc.line(pillarLeft, gy, pillarRight, gy);
                    txt(String(Math.round((i / 4) * maxAvg * 10) / 10), pillarLeft - 6, gy + 4, 7, c.midGray, false, 'right');
                }

                // Draw pillars with gradient effect (NYX green #00fe8a)
                pillarData.forEach((p, i) => {
                    const cx = pillarLeft + (i + 0.5) * groupWidth;
                    const barH = Math.max((p.avg / maxAvg) * (pillarH - 28), 4);
                    const bx = cx - colWidth / 2;
                    const by = pillarBottom - barH;

                    // Gradient effect: draw from bottom to top with decreasing opacity simulation
                    const steps = 12;
                    const stepH = barH / steps;
                    for (let s = 0; s < steps; s++) {
                        const t = s / steps; // 0 = bottom, 1 = top
                        // Fade from bright green at bottom to darker green at top
                        const r = Math.round(0 + t * 0);
                        const g = Math.round(254 - t * 100);
                        const b = Math.round(138 - t * 60);
                        doc.setFillColor(r, g, b);
                        const sy = pillarBottom - (s + 1) * stepH;
                        doc.roundedRect(bx, sy, colWidth, stepH + 1, s === steps - 1 ? 6 : 0, s === steps - 1 ? 6 : 0, 'F');
                    }

                    // Glow effect at the bottom
                    doc.setFillColor(0, 254, 138);
                    doc.roundedRect(bx, pillarBottom - 3, colWidth, 3, 0, 0, 'F');

                    // Value on top of pillar
                    txt(p.avg.toFixed(1), cx, by - 8, 11, c.nyxGreen, true, 'center');

                    // Month label below
                    const mLbl = new Date(p.month + '-02T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
                    txt(mLbl, cx, pillarBottom + 16, 9, c.midGray, true, 'center');
                });

                y += pillarSection;
            } else {
                y += 16;
            }

            // Big title area
            txt(monthLabel.toUpperCase().split(' ')[0].toUpperCase(), 32, y + 28, 36, c.offWhite, true);
            txt(monthLabel.split(' ')[1] || '', 32, y + 52, 18, c.midGray, false);
            y += 64;

            // Profile row
            rRect(32, y, 44, 44, 22, c.nyxGreen);
            const initials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            txt(initials, 54, y + 30, 16, c.black, true, 'center');
            txt(employee.name, 88, y + 20, 16, c.offWhite, true);
            txt(`${employee.department} · ${employee.role}`, 88, y + 36, 10, c.midGray);
            y += 60;

            // === STAT CARDS GRID (2x2 layout with bold colors) ===
            const cardW = (pW - 32 * 3) / 2;
            const cardH = 90;
            const gap = 12;

            // Card 1 — Total Score (hot pink)
            const c1x = 32, c1y = y;
            fill(c1x, c1y, cardW, cardH, c.hotPink);
            txt('TOTAL SCORE', c1x + 16, c1y + 22, 9, c.white, true);
            txt(String(review.score), c1x + 16, c1y + 70, 40, c.white, true);
            txt('PTS', c1x + cardW - 16, c1y + 70, 12, [255, 200, 200] as C3, false, 'right');

            // Card 2 — Score % (electric yellow on black)
            const c2x = 32 + cardW + gap, c2y = y;
            fill(c2x, c2y, cardW, cardH, c.electricYellow);
            txt('SCORE %', c2x + 16, c2y + 22, 9, c.black, true);
            txt(`${scorePct}%`, c2x + 16, c2y + 70, 40, c.black, true);

            y += cardH + gap;

            // Card 3 — Tasks Scored (nyx green)
            const c3x = 32, c3y = y;
            fill(c3x, c3y, cardW, cardH, c.nyxGreen);
            txt('TASKS SCORED', c3x + 16, c3y + 22, 9, c.black, true);
            txt(`${review.completedTaskIds.length}/${tasksTotal}`, c3x + 16, c3y + 70, 36, c.black, true);

            // Card 4 — Reviewed date (deep orange)
            const c4x = 32 + cardW + gap, c4y = y;
            fill(c4x, c4y, cardW, cardH, c.deepOrange);
            txt('REVIEWED', c4x + 16, c4y + 22, 9, c.white, true);
            txt(reviewedAt, c4x + 16, c4y + 70, 24, c.white, true);

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

                    // Check page overflow
                    if (y + 46 > pH - 40) { doc.addPage(); fill(0, 0, pW, pH, c.black); y = 40; }

                    // Score circle
                    rRect(32, y, 34, 28, 6, clr);
                    txt(String(score), 49, y + 20, 14, score >= 4 && score < 7 ? c.black : c.white, true, 'center');

                    // Task name — wrap long titles
                    const titleMaxW = pW - 78 - 200;
                    const titleLines: string[] = doc.splitTextToSize(taskTitle, titleMaxW);
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...c.offWhite);
                    titleLines.slice(0, 2).forEach((line: string, li: number) => {
                        doc.text(line, 78, y + 12 + li * 12);
                    });

                    // Score dots (1-10)
                    for (let d = 1; d <= 10; d++) {
                        const dx = pW - 32 - (10 - d) * 18;
                        doc.setFillColor(...(d <= score ? clr : c.darkGray));
                        doc.circle(dx, y + 14, 5, 'F');
                    }

                    // Feedback below if exists
                    const fb = review.taskFeedback?.[taskId]?.trim();
                    const titleExtra = Math.max(titleLines.slice(0, 2).length - 1, 0) * 12;
                    if (fb) {
                        const fbLines: string[] = doc.splitTextToSize(fb, pW - 78 - 48);
                        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...c.midGray);
                        fbLines.slice(0, 2).forEach((line: string, li: number) => {
                            doc.text(line, 78, y + 26 + titleExtra + li * 10);
                        });
                        y += 36 + titleExtra + Math.max(fbLines.slice(0, 2).length - 1, 0) * 10;
                    } else {
                        y += 32 + titleExtra;
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
            // PAGE 2: DETAILED REPORT — Clean white page
            // ═══════════════════════════════════════════════════════
            doc.addPage();
            fill(0, 0, pW, pH, c.white);

            // Header stripe with logo
            fill(0, 0, pW, 60, c.black);
            try { doc.addImage(NYX_LOGO_RAW, 'PNG', 24, 14, 60, 24); } catch { txt('NYX', 32, 36, 16, c.white, true); }
            txt(monthLabel.toUpperCase(), 100, 36, 14, c.nyxGreen, true);
            txt(`${employee.name}  ·  ${employee.department}`, pW - 32, 36, 10, c.midGray, false, 'right');
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

            // ═══════════════════════════════════════════════════════════
            // SIGNATURE SECTION
            // ═══════════════════════════════════════════════════════════
            if (y + 160 > pH - 30) { doc.addPage(); fill(0, 0, pW, pH, c.white); y = 40; }

            y += 20;
            fill(32, y, pW - 64, 2, c.black); y += 24;
            txt('SIGNATURES', 32, y, 12, c.black, true); y += 30;

            // Employee signature
            txt('Employee:', 32, y, 10, c.darkGray, true);
            txt(employee.name, 32, y + 14, 10, c.midGray);
            y += 40;
            doc.setDrawColor(...c.midGray); doc.setLineWidth(0.8);
            doc.line(32, y, pW / 2 - 20, y);
            txt('Signature', 32, y + 14, 8, c.midGray);
            txt('Date: ____/____/________', pW / 2 - 160, y + 14, 8, c.midGray);

            y += 50;

            // Manager signature
            const managerName = currentUser?.name || 'Manager';
            txt('Reviewed by:', 32, y, 10, c.darkGray, true);
            txt(managerName, 32, y + 14, 10, c.midGray);
            y += 40;
            doc.setDrawColor(...c.midGray); doc.setLineWidth(0.8);
            doc.line(32, y, pW / 2 - 20, y);
            txt('Signature', 32, y + 14, 8, c.midGray);
            txt('Date: ____/____/________', pW / 2 - 160, y + 14, 8, c.midGray);

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
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 dark:text-gray-400 mb-2">No monthly tasks assigned for this period.</p>
                                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Assign tasks via Manage Goals first before conducting a review.</p>
                                    </div>
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
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleFinalizeClick}
                        disabled={monthlyTasks.length === 0}
                        title={monthlyTasks.length === 0 ? 'Assign tasks via Manage Goals first' : undefined}
                        className={monthlyTasks.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                        Finalize & Generate Report
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConductReviewPage;
