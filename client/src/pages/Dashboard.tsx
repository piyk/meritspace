import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faBookOpen, faClock, faHeartPulse, faChevronRight, faBolt, faShieldHalved, faWifi, faCopy, faFolderPlus, faFolder, faTrash, faEllipsisVertical, faXmark, faCheck, faCirclePlus, faDownload, faRotateRight, faPen, faQrcode, faMagnifyingGlass, faFileExport, faFileImport, faListCheck } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import showToast from '../utils/swal';
import { API_BASE_URL } from '../config';
import { QRCodeSVG } from 'qrcode.react';

interface Exam {
    id: string;
    title: string;
    course: string;
    term: string;
    start_time: string;
    status: 'active' | 'closed' | 'draft';
    submission_status?: 'submitted' | null;
    group_id?: number | null;
    group_name?: string | null;
    start_method?: 'auto' | 'manual';
    allow_late_submission?: number;
    show_score?: number;
    raw_score?: number;
    total_questions?: number;
    is_public?: number;
}

interface Group {
    id: number;
    name: string;
}

const Dashboard = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [exams, setExams] = useState<Exam[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<number | 'all'>('all');
    const [showNewGroupInput, setShowNewGroupInput] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
    const [showExamSelectorForGroupId, setShowExamSelectorForGroupId] = useState<number | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [showMobileGroupManager, setShowMobileGroupManager] = useState(false);
    const [qrExam, setQrExam] = useState<Exam | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setPage(1);
    }, [activeGroupId]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            refreshData();
        }, 300);
        return () => clearTimeout(timeout);
    }, [page, activeGroupId, searchQuery]);

    useEffect(() => {
        const closeMenus = () => setActiveActionMenuId(null);
        window.addEventListener('click', closeMenus);
        const interval = setInterval(() => {
            setExams(prev => [...prev]);
        }, 10000);
        return () => {
            window.removeEventListener('click', closeMenus);
            clearInterval(interval);
        };
    }, []);

    const refreshData = async () => {
        if (!user) return;
        setIsRefreshing(true);
        try {
            const [eRes, gRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/exams`, {
                    params: {
                        page,
                        search: searchQuery,
                        group_id: activeGroupId,
                        limit: user.role === 'STUDENT' ? 12 : 10
                    }
                }),
                user.role !== 'STUDENT' ? axios.get(`${API_BASE_URL}/api/groups`, { params: { limit: 100 } }) : Promise.resolve({ data: { data: [] } })
            ]);

            const examData = eRes.data.data !== undefined ? eRes.data.data : eRes.data;
            const tPages = eRes.data.totalPages !== undefined ? eRes.data.totalPages : 1;

            setExams(examData);
            setTotalPages(tPages);

            if (user.role !== 'STUDENT') {
                const groupData = gRes.data.data !== undefined ? gRes.data.data : gRes.data;
                setGroups(groupData);
            }
        } catch (err) {
            console.error("Failed to fetch data:", err);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    const Pagination = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-center gap-2 mt-8 md:mt-12 pb-8">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <FontAwesomeIcon icon={faChevronRight} className="rotate-180" />
                </button>
                <div className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-surface border border-border">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                        // Simple logic for showing a few pages if many
                        if (totalPages > 7) {
                            if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) {
                                if (p === 2 || p === totalPages - 1) return <span key={p} className="text-muted-foreground/30">.</span>;
                                return null;
                            }
                        }
                        return (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all ${page === p ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>
        );
    };

    if (!user) return null;

    const isLecturer = user.role === 'LECTURER' || user.role === 'ADMIN';

    const duplicateExam = async (id: string) => {
        const result = await showToast.question(
            t('duplicate_confirm'),
            t('duplicate_text'),
            t('yes'),
            t('cancel')
        );

        if (!result.isConfirmed) return;

        try {
            await axios.post(`${API_BASE_URL}/api/exams/${id}/duplicate`);
            refreshData();
            showToast.success(t('success'), t('exam_duplicated'));
        } catch (err) {
            showToast.error(t('error'), 'Failed to duplicate exam');
        }
    };

    const exportExam = async (examId: string, title: string) => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASE_URL}/api/exams/${examId}/export`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            showToast.success(t('success'), 'Exam exported successfully');
        } catch (err) {
            console.error('Export error:', err);
            showToast.error('Error', 'Failed to export exam');
        }
    };

    const importExam = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('token');
            try {
                await axios.post(`${API_BASE_URL}/api/exams/import-exam`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                showToast.success(t('success'), 'Exam imported successfully');
                refreshData();
            } catch (err: any) {
                console.error('Import error:', err);
                showToast.error('Error', err.response?.data?.error || 'Failed to import exam');
            }
        };
        input.click();
    };

    const deleteGroup = async (id: number) => {
        const result = await showToast.question(
            t('delete_group_confirm'),
            t('delete_group_text'),
            t('yes'),
            t('cancel')
        );

        if (!result.isConfirmed) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/groups/${id}`);
            if (activeGroupId === id) setActiveGroupId('all');
            refreshData();
            showToast.success(t('success'), t('group_deleted'));
        } catch (err) {
            showToast.error(t('error'), 'Failed to delete group');
        }
    };

    const createGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            await axios.post(`${API_BASE_URL}/api/groups`, { name: newGroupName });
            setNewGroupName('');
            setShowNewGroupInput(false);
            refreshData();
        } catch (err) {
            showToast.error('Error', 'Failed to create group');
        }
    };

    const moveExamToGroup = async (examId: string, groupId: number | null) => {
        try {
            await axios.patch(`${API_BASE_URL}/api/exams/${examId}/group`, { group_id: groupId });
            refreshData();
        } catch (err) {
            showToast.error('Error', 'Failed to move exam');
        }
    };

    const startEditingGroup = (group: Group, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingGroupId(group.id);
        setEditingGroupName(group.name);
    };

    const saveGroupName = async () => {
        if (!editingGroupId || !editingGroupName.trim()) return;
        try {
            await axios.patch(`${API_BASE_URL}/api/groups/${editingGroupId}`, { name: editingGroupName });
            setEditingGroupId(null);
            setEditingGroupName('');
            refreshData();
            showToast.success(t('success'), 'Semester renamed successfully');
        } catch (err) {
            showToast.error(t('error'), 'Failed to rename semester');
        }
    };

    const cancelEditing = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingGroupId(null);
        setEditingGroupName('');
    };

    const resetExam = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/exams/${id}/submissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast.success(t('success'), 'All submissions for this exam have been cleared.');
            refreshData();
        } catch (err) {
            console.error('Reset failed', err);
            showToast.error('Error', 'Failed to reset exam.');
        }
    };

    const startExam = async (id: string, isFuture: boolean = false) => {
        if (isFuture) {
            const result = await showToast.question(
                'Start Early?',
                'This exam is scheduled for a future time. Starting it now will make it immediately available to students.',
                'Yes, Start Now',
                t('cancel')
            );
            if (!result.isConfirmed) return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/exams/${id}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast.success('Exam Started', `Exam started at ${new Date(res.data.start_time).toLocaleTimeString()}`);
            refreshData();
        } catch (err) {
            console.error('Failed to start exam', err);
            showToast.error('Error', 'Failed to start exam');
        }
    };

    const stopExam = async (id: string) => {
        const exam = exams.find(e => e.id === id);
        if (!exam) return;

        const result = await showToast.question(
            exam.allow_late_submission ? t('force_stop_confirm') : t('submit_exam_confirm'),
            exam.allow_late_submission ? t('force_stop_text') : t('submit_exam_text'),
            t('yes'),
            t('cancel')
        );

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.patch(`${API_BASE_URL}/api/exams/${id}/status`,
                { status: 'closed', force: exam.allow_late_submission === 1 },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast.success('Success', 'Exam has been stopped.');
            refreshData();
        } catch (err) {
            console.error('Failed to stop exam', err);
            showToast.error('Error', 'Failed to stop exam');
        }
    };

    const filteredExams = exams;

    return (
        <div className="page-container max-w-[1260px] mx-auto px-4 py-8">
            {/* ========== HEADER ========== */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 mb-1">
                        <div className="w-4 h-[1px] bg-primary/40"></div>
                        {t('academic_overview')}
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-foreground">
                            {user.name || 'Proctor Center'}
                        </h1>
                        <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                            {user.role}
                        </div>
                    </div>
                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide mt-1 opacity-70 italic">{user.email}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <FontAwesomeIcon icon={isRefreshing ? faRotateRight : faMagnifyingGlass} className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-[10px] ${isRefreshing ? 'animate-spin' : ''}`} />
                        <input
                            type="text"
                            placeholder={t('search')}
                            className="h-9 pl-9 pr-4 bg-surface/40 backdrop-blur-sm border border-border/50 focus:border-primary/50 rounded-full text-[11px] font-medium w-40 md:w-64 transition-all outline-none"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>

                    <div className="flex items-center bg-surface/40 backdrop-blur-sm border border-border/50 rounded-full p-0 shadow-sm">
                        <button
                            onClick={refreshData}
                            disabled={isRefreshing}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all active:scale-95"
                            title="Reload"
                        >
                            <FontAwesomeIcon icon={faRotateRight} className={`text-xs ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>

                        {isLecturer && (
                            <div className="flex items-center border-l border-border/50 ml-1 pl-1 gap-1">
                                <button onClick={importExam} title="Import" className="w-8 h-8 flex items-center justify-center rounded-full text-primary/60 hover:bg-primary/5 transition-all">
                                    <FontAwesomeIcon icon={faFileImport} className="text-xs" />
                                </button>
                                <Link to="/create-form" className="h-7 px-4 ml-1 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-sm flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPlus} />
                                    <span>{t('create')}</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== MOBILE: Horizontal scrolling group chips ========== */}
            {isLecturer && (
                <div className="lg:hidden mb-4 md:mb-6 overflow-hidden">
                    <div className="horizontal-scroll" style={{ paddingRight: '16px' }}>
                        <button
                            onClick={() => setActiveGroupId('all')}
                            className={`horizontal-scroll-item border ${activeGroupId === 'all'
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface text-muted-foreground border-border'
                                }`}
                        >
                            {t('all_examinations')}
                        </button>
                        <button
                            onClick={() => setActiveGroupId(0)}
                            className={`horizontal-scroll-item border ${activeGroupId === 0
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface text-muted-foreground border-border'
                                }`}
                        >
                            {t('ungrouped')}
                        </button>
                        {groups.map(g => (
                            <button
                                key={g.id}
                                onClick={() => setActiveGroupId(g.id)}
                                className={`horizontal-scroll-item border ${activeGroupId === g.id
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-surface text-muted-foreground border-border'
                                    }`}
                            >
                                {g.name}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowMobileGroupManager(true)}
                            className="horizontal-scroll-item border border-dashed border-primary text-primary"
                        >
                            <FontAwesomeIcon icon={faFolderPlus} className="mr-1" /> Manage
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
                {/* ========== DESKTOP SIDEBAR ========== */}
                {isLecturer && (
                    <aside className="hidden lg:block lg:col-span-1 space-y-6">
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faFolder} className="text-[10px]" />
                                    {t('collections')}
                                </h2>
                                <button
                                    onClick={() => setShowNewGroupInput(true)}
                                    className="p-1 hover:bg-surface rounded-md text-primary transition-colors"
                                >
                                    <FontAwesomeIcon icon={faFolderPlus} className="text-base" />
                                </button>
                            </div>

                            <div className="space-y-1">
                                <button
                                    onClick={() => setActiveGroupId('all')}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${activeGroupId === 'all' ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-surface/50'}`}
                                >
                                    {t('all_examinations')}
                                </button>
                                <button
                                    onClick={() => setActiveGroupId(0)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${activeGroupId === 0 ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-surface/50'}`}
                                >
                                    {t('ungrouped')}
                                </button>

                                {groups.map(g => (
                                    <div key={g.id} className="relative group">
                                        {editingGroupId === g.id ? (
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/50 border border-primary/20 rounded-xl mb-1">
                                                <input
                                                    autoFocus
                                                    className="w-full h-6 bg-transparent border-none focus:ring-0 text-[13px] font-medium text-primary"
                                                    value={editingGroupName}
                                                    onChange={(e) => setEditingGroupName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveGroupName();
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex items-center gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); saveGroupName(); }} className="p-1 text-emerald-500 hover:scale-110 transition-transform">
                                                        <FontAwesomeIcon icon={faCheck} className="text-[10px]" />
                                                    </button>
                                                    <button onClick={cancelEditing} className="p-1 text-red-400 hover:scale-110 transition-transform">
                                                        <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setActiveGroupId(g.id)}
                                                    className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-all pr-12 ${activeGroupId === g.id ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-surface/50'}`}
                                                >
                                                    {g.name}
                                                </button>
                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={(e) => startEditingGroup(g, e)}
                                                        className={`w-6 h-6 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-all ${activeGroupId === g.id ? 'text-primary' : 'text-muted-foreground/40 hover:text-primary'}`}
                                                        title="Rename"
                                                    >
                                                        <FontAwesomeIcon icon={faPen} className="text-[9px]" />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowExamSelectorForGroupId(g.id)}
                                                        className={`w-6 h-6 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-all ${activeGroupId === g.id ? 'text-primary' : 'text-muted-foreground/40 hover:text-primary'}`}
                                                        title={t('add_exams_to_collection')}
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="text-[9px]" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteGroup(g.id)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 transition-all text-muted-foreground/40 hover:text-red-500"
                                                        title={t('delete')}
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} className="text-[9px]" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                <AnimatePresence>
                                    {showNewGroupInput && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-4 p-3 bg-surface/30 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm"
                                        >
                                            <input
                                                autoFocus
                                                className="w-full h-8 bg-transparent border-b border-border focus:border-primary transition-colors text-[13px] font-medium outline-none mb-3 px-1"
                                                placeholder={t('group_name_placeholder')}
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && createGroup()}
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={createGroup} className="h-7 px-4 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-sm flex-1">{t('create')}</button>
                                                <button onClick={() => setShowNewGroupInput(false)} className="h-7 px-4 rounded-full bg-surface-hover text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:brightness-105 transition-all flex-1">{t('cancel')}</button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </section>
                    </aside>
                )}

                {/* ========== EXAM CARDS ========== */}
                <div className={`${isLecturer ? 'lg:col-span-3' : 'lg:col-span-4'} space-y-4 md:space-y-6`}>
                    <section>
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 mb-8 flex items-center gap-3">
                            <div className="w-6 h-[1px] bg-border"></div>
                            {activeGroupId === 'all' ? t('all_sessions') : groups.find(g => g.id === activeGroupId)?.name || t('ungrouped_sessions')}
                        </h2>
                        <div className="space-y-3 md:space-y-6">
                            {filteredExams.map((exam, idx) => (
                                <motion.div
                                    key={exam.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/50 bg-surface/30 hover:bg-surface/60 transition-all duration-300 shadow-sm overflow-hidden"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border border-primary transition-all ${exam.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' :
                                            exam.status === 'draft' ? 'border-orange-500/30 bg-orange-500/5 text-orange-500' :
                                                'border-slate-300    text-slate-400'
                                            }`}>
                                            <FontAwesomeIcon icon={faBookOpen} className="text-lg" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold text-foreground truncate tracking-tight uppercase">{exam.title}</h3>
                                                {exam.is_public === 1 && <FontAwesomeIcon icon={faWifi} className="text-[10px] text-primary/40" title="Public" />}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground/60 font-medium truncate italic">{exam.course}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 ml-auto sm:ml-0">
                                        {/* Status & Date */}
                                        <div className="flex flex-col items-end gap-1 sm:text-right hidden xs:flex">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${exam.submission_status === 'submitted' ? 'bg-indigo-500' :
                                                    exam.status === 'active' ? (exam.start_time && new Date(exam.start_time) > new Date() ? 'bg-orange-400' : 'bg-emerald-500 animate-pulse') :
                                                        'bg-red-400'
                                                    }`} />
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${exam.submission_status === 'submitted' ? 'text-indigo-500' :
                                                    exam.status === 'active' ? (exam.start_time && new Date(exam.start_time) > new Date() ? 'text-orange-400' : 'text-emerald-500') :
                                                        'text-red-400'
                                                    }`}>
                                                    {exam.submission_status === 'submitted' ? t('submitted') :
                                                        exam.status === 'active' ? (exam.start_time && new Date(exam.start_time) > new Date() ? t('scheduled') : t('live_session')) :
                                                            exam.status}
                                                </span>
                                            </div>
                                            <p className="text-[9px] font-bold text-muted-foreground/30 tabular-nums uppercase tracking-tighter">
                                                {exam.start_time && new Date(exam.start_time).getFullYear() > 2000
                                                    ? new Date(exam.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
                                                    : 'Manual Entry'
                                                }
                                            </p>
                                        </div>

                                        {/* Comprehensive Actions */}
                                        <div className="flex items-center bg-surface/40 backdrop-blur-sm border border-border/50 rounded-full p-1 group-hover:bg-white dark:group-hover:bg-surface/80 transition-all duration-300">
                                            {isLecturer ? (
                                                <div className="flex items-center gap-0.5 sm:gap-1">
                                                    {/* Primary Contextual Action */}
                                                    {(exam.status !== 'active' || (exam.start_time && new Date(exam.start_time) > new Date())) ? (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); startExam(exam.id, !!(exam.start_time && new Date(exam.start_time) > new Date())); }}
                                                            className="h-7 px-3 rounded-full bg-primary text-white text-[9px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-sm"
                                                        >
                                                            Start
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); stopExam(exam.id); }}
                                                            className="h-7 px-3 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 active:scale-95 transition-all"
                                                        >
                                                            Stop
                                                        </button>
                                                    )}

                                                    <div className="w-[1px] h-4 bg-border/50 mx-1" />

                                                    <Link to={`/monitor/${exam.id}`} className="w-8 h-8 flex items-center justify-center rounded-full text-primary/60 hover:bg-primary/5 transition-all" title="Monitor">
                                                        <FontAwesomeIcon icon={faHeartPulse} className="text-xs" />
                                                    </Link>

                                                    <Link to={`/edit-form/${exam.id}`} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all" title="Edit">
                                                        <FontAwesomeIcon icon={faPen} className="text-[10px]" />
                                                    </Link>

                                                    <button onClick={(e) => { e.preventDefault(); setQrExam(exam); }} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all" title="QR">
                                                        <FontAwesomeIcon icon={faQrcode} className="text-xs" />
                                                    </button>

                                                    <button onClick={(e) => {
                                                        e.preventDefault();
                                                        const token = localStorage.getItem('token');
                                                        window.open(`${API_BASE_URL}/api/exams/${exam.id}/results/export?token=${token}`, '_blank');
                                                    }} className="w-8 h-8 flex items-center justify-center rounded-full text-emerald-500/60 hover:bg-emerald-500/5 transition-all" title="Results">
                                                        <FontAwesomeIcon icon={faDownload} className="text-xs" />
                                                    </button>

                                                    <Link to={`/grade/${exam.id}`} className="w-8 h-8 flex items-center justify-center rounded-full text-violet-500/60 hover:bg-violet-500/5 transition-all" title={t('grade_submissions')}>
                                                        <FontAwesomeIcon icon={faListCheck} className="text-xs" />
                                                    </Link>

                                                    <button
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveActionMenuId(exam.id); }}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all"
                                                    >
                                                        <FontAwesomeIcon icon={faEllipsisVertical} className="text-xs" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <Link
                                                    to={exam.submission_status !== 'submitted' ? `/take-form/${exam.id}` : '#'}
                                                    className={`h-7 px-4 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${exam.submission_status === 'submitted'
                                                        ? 'bg-indigo-500/10 text-indigo-500 cursor-default'
                                                        : 'bg-primary text-white hover:brightness-110 shadow-sm'
                                                        }`}
                                                    onClick={(e) => exam.submission_status === 'submitted' && e.preventDefault()}
                                                >
                                                    {exam.submission_status === 'submitted' ? 'Done' : 'Enter'}
                                                    <FontAwesomeIcon icon={faChevronRight} />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredExams.length === 0 && (
                                <div className="py-16 md:py-20 text-center rounded-2xl border-2 border-dashed border-border bg-surface/30">
                                    <FontAwesomeIcon icon={faBookOpen} className="text-5xl md:text-6xl mx-auto mb-4 text-muted-foreground opacity-30" />
                                    <p className="text-muted-foreground text-sm font-semibold">
                                        {t('no_exams_found')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    <Pagination />
                </div>
            </div>

            {/* ========== EXAM ACTIONS OVERLAY ========== */}
            <AnimatePresence>
                {activeActionMenuId !== null && (() => {
                    const selectedExam = exams.find(e => e.id === activeActionMenuId);
                    if (!selectedExam) return null;
                    return (
                        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                                onClick={() => setActiveActionMenuId(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 100 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 100 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                className="w-full sm:max-w-sm bg-card border border-border rounded-t-3xl sm:rounded-3xl relative overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[70vh] shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Swipe indicator (mobile) */}
                                <div className="sm:hidden swipe-indicator mt-3"></div>

                                {/* Header */}
                                <div className="p-5 sm:p-6 border-b border-border bg-surface/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faBookOpen} className="text-primary text-base" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black tracking-tight truncate">{selectedExam.title}</h3>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{selectedExam.course}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setActiveActionMenuId(null)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-muted-foreground flex-shrink-0 ml-2"
                                        >
                                            <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                        </button>
                                    </div>
                                </div>

                                {/* Action Items */}
                                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
                                    {/* Edit & Duplicate */}
                                    <div className="space-y-0.5">
                                        <Link
                                            to={`/edit-form/${selectedExam.id}`}
                                            onClick={() => setActiveActionMenuId(null)}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faCirclePlus} className="text-sm text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('edit_content')}</p>
                                                <p className="text-[10px] text-muted-foreground">Modify questions & sections</p>
                                            </div>
                                        </Link>
                                        <button
                                            onClick={() => { duplicateExam(selectedExam.id); setActiveActionMenuId(null); }}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faCopy} className="text-sm text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('duplicate_exam')}</p>
                                                <p className="text-[10px] text-muted-foreground">Create a copy of this exam</p>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="h-px bg-border mx-2 my-1.5"></div>

                                    {/* Export & Monitor & QR */}
                                    <div className="space-y-0.5">

                                        <button
                                            onClick={() => {
                                                setQrExam(selectedExam);
                                                setActiveActionMenuId(null);
                                            }}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faQrcode} className="text-sm text-violet-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('scan_to_access_exam')}</p>
                                                <p className="text-[10px] text-muted-foreground">Students scan to access exam</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                exportExam(selectedExam.id, selectedExam.title);
                                                setActiveActionMenuId(null);
                                            }}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faFileExport} className="text-sm text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('export_exam_data')}</p>
                                                <p className="text-[10px] text-muted-foreground">Download as JSON</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const token = localStorage.getItem('token');
                                                window.open(`${API_BASE_URL}/api/exams/${selectedExam.id}/results/export?token=${token}`, '_blank');
                                                setActiveActionMenuId(null);
                                            }}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faDownload} className="text-sm text-green-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('export_results')}</p>
                                                <p className="text-[10px] text-muted-foreground">Download as spreadsheet</p>
                                            </div>
                                        </button>
                                        <Link
                                            to={`/monitor/${selectedExam.id}`}
                                            onClick={() => setActiveActionMenuId(null)}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faHeartPulse} className="text-sm text-indigo-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('real_time_monitor')}</p>
                                                <p className="text-[10px] text-muted-foreground">Track live submissions</p>
                                            </div>
                                        </Link>
                                        <Link
                                            to={`/grade/${selectedExam.id}`}
                                            onClick={() => setActiveActionMenuId(null)}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-surface rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faListCheck} className="text-sm text-violet-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{t('grade_submissions')}</p>
                                                <p className="text-[10px] text-muted-foreground">Review & score answers</p>
                                            </div>
                                        </Link>
                                    </div>

                                    <div className="h-px bg-border mx-2 my-1.5"></div>

                                    {/* Danger Zone */}
                                    <div className="space-y-0.5">
                                        <button
                                            onClick={async () => {
                                                const result = await showToast.question(
                                                    t('reset_confirm'),
                                                    t('reset_text'),
                                                    t('yes'),
                                                    t('cancel')
                                                );
                                                if (result.isConfirmed) {
                                                    resetExam(selectedExam.id);
                                                    setActiveActionMenuId(null);
                                                }
                                            }}
                                            className="flex items-center gap-3.5 w-full text-left px-4 py-3.5 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all active:scale-[0.98]"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faBolt} className="text-sm text-red-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-red-600">{t('reset_results')}</p>
                                                <p className="text-[10px] text-muted-foreground">Clear all submissions</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* ========== MOBILE GROUP MANAGER BOTTOM SHEET ========== */}
            <AnimatePresence>
                {showMobileGroupManager && (
                    <div className="fixed inset-0 z-[200] lg:hidden">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => setShowMobileGroupManager(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="absolute bottom-0 inset-x-0 bg-card border-t border-border rounded-t-3xl max-h-[80vh] flex flex-col"
                        >
                            <div className="swipe-indicator mt-3"></div>
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h3 className="text-lg font-black">{t('collections')}</h3>
                                <button
                                    onClick={() => setShowMobileGroupManager(false)}
                                    className="p-2 text-muted-foreground"
                                >
                                    <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {groups.map(g => (
                                    <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
                                        {editingGroupId === g.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    autoFocus
                                                    className="flex-1 h-9 bg-background border border-primary/30 rounded-lg px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    value={editingGroupName}
                                                    onChange={(e) => setEditingGroupName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') saveGroupName();
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                />
                                                <button onClick={() => saveGroupName()} className="p-2 text-green-600"><FontAwesomeIcon icon={faCheck} /></button>
                                                <button onClick={() => cancelEditing()} className="p-2 text-red-500"><FontAwesomeIcon icon={faXmark} /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-sm font-bold">{g.name}</span>
                                                <div className="flex gap-1">
                                                    <button onClick={(e) => startEditingGroup(g, e)} className="p-2 text-primary"><FontAwesomeIcon icon={faPen} className="text-sm" /></button>
                                                    <button onClick={() => setShowExamSelectorForGroupId(g.id)} className="p-2 text-primary"><FontAwesomeIcon icon={faPlus} className="text-sm" /></button>
                                                    <button onClick={() => deleteGroup(g.id)} className="p-2 text-red-500"><FontAwesomeIcon icon={faTrash} className="text-sm" /></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Create New Group */}
                                <div className="p-3 rounded-xl border-2 border-dashed border-border">
                                    <input
                                        className="w-full h-10 bg-surface border border-border rounded-xl px-3 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder={t('group_name_placeholder')}
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && createGroup()}
                                    />
                                    <button
                                        onClick={createGroup}
                                        className="btn-primary-minimal w-full !min-h-[40px]"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="mr-2" /> {t('create')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ========== EXAM SELECTOR MODAL ========== */}
            <AnimatePresence>
                {showExamSelectorForGroupId && (
                    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-background/90"
                            onClick={() => setShowExamSelectorForGroupId(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="w-full sm:max-w-2xl bg-card border border-border rounded-t-3xl sm:rounded-3xl relative overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[80vh]"
                        >
                            <div className="sm:hidden swipe-indicator mt-3"></div>
                            <div className="p-4 sm:p-8 border-b border-border bg-surface">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg sm:text-2xl font-bold tracking-tight">
                                        Add to <span className="text-primary font-black">{groups.find(g => g.id === showExamSelectorForGroupId)?.name}</span>
                                    </h3>
                                    <button
                                        onClick={() => setShowExamSelectorForGroupId(null)}
                                        className="p-2 hover:bg-surface rounded-xl transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faXmark} className="text-xl" />
                                    </button>
                                </div>
                                <p className="text-muted-foreground font-medium text-sm">Select examinations to include in this collection</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 sm:space-y-3">
                                {exams.map(exam => {
                                    const isInThisGroup = exam.group_id === showExamSelectorForGroupId;
                                    const isInOtherGroup = exam.group_id && exam.group_id !== showExamSelectorForGroupId;

                                    return (
                                        <div
                                            key={exam.id}
                                            onClick={() => moveExamToGroup(exam.id, isInThisGroup ? null : showExamSelectorForGroupId)}
                                            className={`flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.98] group/item ${isInThisGroup
                                                ? 'bg-primary/5 border-primary'
                                                : 'bg-surface border-transparent hover:border-primary/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${isInThisGroup ? 'bg-primary border-primary' : 'border-border group-hover/item:border-primary/50'
                                                    }`}>
                                                    {isInThisGroup && <FontAwesomeIcon icon={faCheck} className="text-white text-sm" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{exam.title}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest truncate">
                                                        {exam.course} • {isInOtherGroup ? `Currently in: ${groups.find(g => g.id === exam.group_id)?.name}` : (exam.group_id ? 'In this collection' : 'Ungrouped')}
                                                    </p>
                                                </div>
                                            </div>
                                            {isInOtherGroup && (
                                                <div className="px-2 py-1 bg-amber-500/10 text-amber-600 text-[8px] font-black uppercase rounded-md tracking-tighter flex-shrink-0 ml-2">
                                                    Reassign
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 sm:p-6 border-t border-border bg-surface/50 flex justify-end">
                                <button
                                    onClick={() => setShowExamSelectorForGroupId(null)}
                                    className="btn-primary-minimal px-6 sm:px-8"
                                >
                                    Finish Management
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ========== QR CODE MODAL ========== */}
            <AnimatePresence>
                {qrExam && (() => {
                    const examUrl = `${window.location.origin}/app/take-form/${qrExam.id}`;
                    return (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/90 backdrop-blur-md"
                                onClick={() => setQrExam(null)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.85 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                className="w-full max-w-sm bg-card border border-border rounded-3xl relative overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-5 sm:p-6 border-b border-border bg-surface/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faQrcode} className="text-violet-500 text-base" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black tracking-tight truncate">{qrExam.title}</h3>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Share QR Code</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setQrExam(null)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-muted-foreground flex-shrink-0 ml-2"
                                        >
                                            <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                        </button>
                                    </div>
                                </div>

                                {/* QR Code */}
                                <div className="p-6 sm:p-8 flex flex-col items-center gap-5">
                                    <div className="bg-white p-5 rounded-2xl shadow-inner border border-gray-100">
                                        <QRCodeSVG
                                            value={examUrl}
                                            size={220}
                                            level="H"
                                            includeMargin={false}
                                            bgColor="#ffffff"
                                            fgColor="#18181b"
                                        />
                                    </div>

                                    <p className="text-xs text-muted-foreground text-center font-medium leading-relaxed">
                                        Students can scan this QR code to access the form directly.
                                    </p>

                                    {/* Link Display & Copy */}
                                    <div className="w-full">
                                        <div className="flex items-center gap-2 p-3 bg-surface border border-border rounded-xl">
                                            <input
                                                readOnly
                                                value={examUrl}
                                                className="flex-1 bg-transparent border-none text-xs font-mono text-muted-foreground focus:outline-none truncate"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(examUrl);
                                                    showToast.success('Copied!', 'Link copied to clipboard');
                                                }}
                                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-95"
                                            >
                                                <FontAwesomeIcon icon={faCopy} className="text-sm" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-4 sm:p-5 border-t border-border bg-surface/30 flex justify-end">
                                    <button
                                        onClick={() => setQrExam(null)}
                                        className="btn-primary-minimal px-6"
                                    >
                                        Done
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
