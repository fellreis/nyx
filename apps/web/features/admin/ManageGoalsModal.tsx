import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, ListChecks } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useApp } from '../../context/AppContext';
import { GoalStatus, GoalType } from '../../types';
import type { User, Goal, Subtask } from '../../types';

interface ManageGoalsModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: User;
}

interface GoalFormData {
    title: string;
    description: string;
    points: number;
    subtasks: Subtask[];
    dependencies: Array<number | string>;
    type: GoalType;
    category?: string;
    reviewPeriod?: string;
    isPromotionBlocker?: boolean;
}

const GoalForm: React.FC<{ goal: Partial<Goal> | null, onSubmit: (data: GoalFormData) => void, onCancel: () => void, allGoals: Goal[] }> = ({ goal, onSubmit, onCancel, allGoals }) => {
    const [formData, setFormData] = useState({
        title: goal?.title || '',
        description: goal?.description || '',
        points: goal?.points || 50,
    });
    const [subtasks, setSubtasks] = useState<Subtask[]>(goal?.subtasks || []);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [dependencies, setDependencies] = useState<Array<number | string>>(goal?.dependencies || []);
    const [type, setType] = useState<GoalType>(goal?.type || GoalType.ROLE);
    const [category, setCategory] = useState(goal?.category || '');
    const [reviewPeriod, setReviewPeriod] = useState(goal?.reviewPeriod || new Date().toISOString().slice(0, 7));
    const [isPromotionBlocker, setIsPromotionBlocker] = useState(goal?.isPromotionBlocker || false);

    useEffect(() => {
        // When switching to Monthly Task type for a NEW goal, pre-populate category
        // from the most recent monthly task to streamline creation.
        if (type === GoalType.MONTHLY_TASK && !goal?.id) {
            const mostRecentMonthlyTask = allGoals
                .filter(g => g.type === GoalType.MONTHLY_TASK && g.reviewPeriod)
                .sort((a, b) => b.reviewPeriod!.localeCompare(a.reviewPeriod!))[0];

            if (mostRecentMonthlyTask && mostRecentMonthlyTask.category) {
                setCategory(mostRecentMonthlyTask.category);
            }
        }
    }, [type, goal?.id, allGoals]);


    const handleAddSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        setSubtasks([...subtasks, { id: Date.now(), title: newSubtaskTitle, completed: false }]);
        setNewSubtaskTitle('');
    };
    
    const handleUpdateSubtask = (id: number, newTitle: string) => {
        setSubtasks(subtasks.map(st => st.id === id ? {...st, title: newTitle} : st));
    };

    const handleDeleteSubtask = (id: number) => {
        setSubtasks(subtasks.filter(st => st.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            subtasks,
            dependencies,
            type,
            category: type === GoalType.MONTHLY_TASK ? category : undefined,
            reviewPeriod: type === GoalType.MONTHLY_TASK ? reviewPeriod : undefined,
            isPromotionBlocker: type === GoalType.ROLE ? isPromotionBlocker : undefined,
        });
    };

    const handleDependencyChange = (goalId: number | string) => {
        setDependencies(prev => 
            prev.some(id => String(id) === String(goalId)) 
                ? prev.filter(id => String(id) !== String(goalId))
                : [...prev, goalId]
        );
    };

    const availableDependencies = allGoals.filter(g => g.id !== goal?.id);

    return (
        <Card className="p-4 my-4 bg-gray-50 dark:bg-gray-700/50 border-dashed dark:border-gray-600">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h4 className="font-semibold dark:text-gray-200">{goal?.id ? 'Edit Goal' : 'Add New Goal'}</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points</label>
                    <input type="number" value={formData.points} onChange={e => setFormData({...formData, points: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Type</label>
                    <div className="flex gap-2 rounded-lg bg-gray-200 dark:bg-gray-900 p-1">
                        <button type="button" onClick={() => setType(GoalType.ROLE)} className={`w-full py-1 rounded-md text-sm font-medium transition-all ${type === GoalType.ROLE ? 'bg-white shadow dark:bg-gray-700 text-gray-800 dark:text-gray-100' : 'hover:bg-gray-300/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-300'}`}>Role Goal</button>
                        <button type="button" onClick={() => setType(GoalType.MONTHLY_TASK)} className={`w-full py-1 rounded-md text-sm font-medium transition-all ${type === GoalType.MONTHLY_TASK ? 'bg-white shadow dark:bg-gray-700 text-gray-800 dark:text-gray-100' : 'hover:bg-gray-300/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-300'}`}>Monthly Task</button>
                    </div>
                </div>
                
                {type === GoalType.MONTHLY_TASK && (
                    <div className="grid grid-cols-2 gap-4 slide-in">
                        <div>
                           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Creative Strategy" className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Period</label>
                            <input type="month" value={reviewPeriod} onChange={e => setReviewPeriod(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" required />
                        </div>
                    </div>
                )}

                {type === GoalType.ROLE && (
                     <div className="slide-in flex items-center p-2 bg-gray-100 dark:bg-gray-700/60 rounded-lg">
                        <input
                            type="checkbox"
                            id="isPromotionBlocker"
                            checked={isPromotionBlocker}
                            onChange={(e) => setIsPromotionBlocker(e.target.checked)}
                            className="w-4 h-4 text-nyx-600 bg-gray-200 border-gray-300 rounded focus:ring-nyx-500 dark:bg-gray-800 dark:border-gray-600"
                        />
                        <label htmlFor="isPromotionBlocker" className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">This is a promotion blocker</label>
                    </div>
                )}

                {availableDependencies.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dependencies (for Role Goals)</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select goals that must be completed before this one can be started.</p>
                        <div className="max-h-32 overflow-y-auto space-y-2 p-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600">
                            {availableDependencies.map(depGoal => (
                                <div key={depGoal.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`dep-${depGoal.id}`}
                                        checked={dependencies.some(id => String(id) === String(depGoal.id))}
                                        onChange={() => handleDependencyChange(depGoal.id)}
                                        className="w-4 h-4 text-nyx-600 bg-gray-100 border-gray-300 rounded focus:ring-nyx-500 dark:bg-gray-800 dark:border-gray-500"
                                    />
                                    <label htmlFor={`dep-${depGoal.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">{depGoal.title}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtasks</label>
                    <div className="space-y-2">
                        {subtasks.map(subtask => (
                            <div key={subtask.id} className="flex items-center gap-2">
                                <input type="text" value={subtask.title} onChange={e => handleUpdateSubtask(subtask.id, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white text-sm" />
                                <Button type="button" variant="danger" size="sm" className="!p-2" onClick={() => handleDeleteSubtask(subtask.id)}><Trash2 size={14}/></Button>
                            </div>
                        ))}
                    </div>
                     <div className="flex items-center gap-2 mt-2">
                        <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="New subtask title" className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white text-sm" />
                        <Button type="button" variant="outline" size="sm" onClick={handleAddSubtask}>Add</Button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">{goal?.id ? 'Save Changes' : 'Add Goal'}</Button>
                </div>
            </form>
        </Card>
    );
};


const ManageGoalsModal: React.FC<ManageGoalsModalProps> = ({ isOpen, onClose, employee }) => {
    const { createGoal, updateGoal, deleteGoal, refreshEmployees } = useApp();
    const [editingGoal, setEditingGoal] = useState<Partial<Goal> | null>(null);
    const [activeTool, setActiveTool] = useState<'none' | 'bulk'>('none');
    const [localGoals, setLocalGoals] = useState<Goal[]>(employee.goals);

    // Bulk Add State
    const [bulkTasks, setBulkTasks] = useState('');
    const [bulkPoints, setBulkPoints] = useState(10);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkReviewPeriod, setBulkReviewPeriod] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        setLocalGoals(employee.goals);
    }, [employee.id, employee.goals]);

    const { roleGoals, categorizedMonthlyTasks } = useMemo(() => {
        const roleGoals = localGoals.filter(g => g.type === GoalType.ROLE);
        const monthlyTasks = localGoals.filter(g => g.type === GoalType.MONTHLY_TASK);

        const categorized = monthlyTasks.reduce((acc, goal) => {
            const category = goal.category || 'General';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(goal);
            return acc;
        }, {} as Record<string, Goal[]>);

        return { roleGoals, categorizedMonthlyTasks: categorized };
    }, [localGoals]);

    const handleGoalSubmit = async (data: GoalFormData) => {
        const completedCount = data.subtasks.filter(st => st.completed).length;
        const progress = data.subtasks.length > 0 ? Math.round((completedCount / data.subtasks.length) * 100) : 0;
        
        if (editingGoal?.id) {
            const updated = await updateGoal(editingGoal.id, { ...data, progress, status: editingGoal.status || GoalStatus.NOT_STARTED });
            setLocalGoals((prev) => prev.map((g) => (String(g.id) === String(updated.id) ? updated : g)));
        } else {
            const created = await createGoal({
                ...data,
                assignedToId: String(employee.id),
                status: GoalStatus.NOT_STARTED,
                progress
            });
            setLocalGoals((prev) => [...prev, created]);
        }
        void refreshEmployees();
        setEditingGoal(null);
    };

    const handleDeleteGoal = async (goalId: number | string) => {
        if (window.confirm('Are you sure you want to delete this goal? This may affect other goals that depend on it.')) {
            await deleteGoal(goalId);
            setLocalGoals((prev) => prev.filter((g) => String(g.id) !== String(goalId)));
            void refreshEmployees();
        }
    };
    
    const handleBulkAddTasks = async () => {
        if (!bulkTasks.trim()) return;

        const lines = bulkTasks.trim().split('\n');
        const newGoals: Goal[] = lines
            .map(line => line.replace(/^[\s\t]*[\*\-\•\d\.]+\s*/, '').trim()) // Regex to remove bullets/numbers
            .filter(title => title.length > 0)
            .map((title, index) => ({
                id: Date.now() + index,
                title,
                description: `Monthly task: ${title}`,
                points: bulkPoints,
                status: GoalStatus.NOT_STARTED,
                progress: 0,
                deadline: '',
                subtasks: [],
                dependencies: [],
                type: GoalType.MONTHLY_TASK,
                category: bulkCategory,
                reviewPeriod: bulkReviewPeriod,
            }));
        
        if (newGoals.length > 0) {
            const createdGoals: Goal[] = [];
            for (const goal of newGoals) {
                const created = await createGoal({
                    ...goal,
                    assignedToId: String(employee.id)
                });
                createdGoals.push(created);
            }
            setLocalGoals((prev) => [...prev, ...createdGoals]);
            void refreshEmployees();
            setBulkTasks('');
            alert(`${newGoals.length} monthly tasks have been added.`);
        }
    };


    const toggleTool = (tool: 'bulk') => {
        setEditingGoal(null);
        setActiveTool(prev => prev === tool ? 'none' : tool);
    };

    const GoalListItem: React.FC<{goal: Goal}> = ({ goal }) => (
         <Card key={goal.id} className="p-4 flex justify-between items-center">
            <div>
                <h4 className="font-semibold dark:text-gray-200">{goal.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{goal.points} points - <span className="font-medium">{goal.status}</span></p>
            </div>
            <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setEditingGoal(goal); setActiveTool('none'); }}><Edit size={14}/></Button>
                <Button size="sm" variant="danger" onClick={() => handleDeleteGoal(goal.id)}><Trash2 size={14}/></Button>
            </div>
        </Card>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Goals for ${employee.name}`}>
            <div className="space-y-4">
                <Card className="p-4 bg-gray-50/50 dark:bg-gray-700/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                            onClick={() => {
                                setEditingGoal({});
                                setActiveTool('none');
                            }}
                            variant="primary"
                            className="w-full"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Manually
                        </Button>
                        <Button
                            onClick={() => toggleTool('bulk')}
                            variant="secondary"
                            className={`w-full ${activeTool === 'bulk' ? '!bg-gray-300 dark:!bg-gray-600' : ''}`}
                        >
                            <ListChecks className="w-4 h-4 mr-2" /> Bulk Add Monthly Tasks
                        </Button>
                    </div>
                </Card>

                {activeTool === 'bulk' && (
                     <Card className="p-4 space-y-4 slide-in">
                        <h4 className="font-semibold text-lg dark:text-gray-200">Bulk-Add Monthly Tasks from List</h4>
                        <textarea 
                            value={bulkTasks} 
                            onChange={e => setBulkTasks(e.target.value)} 
                            placeholder="Paste a list of tasks. Each line will become a new task. e.g.,&#10;- Finalize Q1 report&#10;* Prepare for client presentation" 
                            className="w-full h-32 p-2 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" 
                        />
                        <div className="grid grid-cols-3 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                <input type="text" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" placeholder="e.g., Project Management"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Points per task</label>
                                <input type="number" value={bulkPoints} onChange={e => setBulkPoints(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Period</label>
                                <input type="month" value={bulkReviewPeriod} onChange={e => setBulkReviewPeriod(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white" />
                            </div>
                        </div>
                        <Button onClick={handleBulkAddTasks}>Create Tasks</Button>
                    </Card>
                )}

                {editingGoal && <GoalForm goal={editingGoal} onSubmit={handleGoalSubmit} onCancel={() => setEditingGoal(null)} allGoals={localGoals} />}

                <div>
                    <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Current Goals</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                       {localGoals.length > 0 ? (
                           <>
                                {roleGoals.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Role Goals</h4>
                                        <div className="space-y-3">
                                            {roleGoals.map(goal => <GoalListItem key={goal.id} goal={goal} />)}
                                        </div>
                                    </div>
                                )}
                                {Object.keys(categorizedMonthlyTasks).length > 0 && (
                                     <div>
                                        <h4 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mt-4 mb-2">Monthly Tasks</h4>
                                        <div className="space-y-4">
                                            {Object.entries(categorizedMonthlyTasks).map(([category, tasks]) => (
                                                <div key={category}>
                                                    <h5 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">{category}</h5>
                                                    <div className="space-y-3">
                                                        {tasks.map(goal => <GoalListItem key={goal.id} goal={goal} />)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                           </>
                       ) : (
                           <p className="text-gray-500 dark:text-gray-400 text-center py-8">No goals assigned yet.</p>
                       )}
                    </div>
                </div>
                
                 <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                    <Button variant="primary" onClick={onClose}><Check className="w-4 h-4 mr-2"/>Done</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ManageGoalsModal;
