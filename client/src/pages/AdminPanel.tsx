import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faUser, faPenToSquare, faCheck, faXmark, faMagnifyingGlass, faTrash, faFileLines, faHeartPulse, faDatabase, faArrowLeft, faClock, faPlus, faBoxArchive, faDownload, faFileCsv, faSort, faSortUp, faSortDown, faPalette, faFileExport, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import showToast from '../utils/swal';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../config';
import AppearanceSettings from '../components/AppearanceSettings';
import CustomSelect from '../components/CustomSelect';

const AdminPanel = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'users' | 'exams' | 'collections' | 'backups' | 'appearance'>('users');
    const [users, setUsers] = useState<any[]>([]);
    const [exams, setExams] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [backups, setBackups] = useState<any[]>([]);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [userRoleFilter, setUserRoleFilter] = useState('ALL');
    const [userSortCol, setUserSortCol] = useState('registered_at');
    const [userSortDir, setUserSortDir] = useState('desc');

    const [examSortCol, setExamSortCol] = useState('created_at');
    const [examSortDir, setExamSortDir] = useState('desc');
    const [examStatusFilter, setExamStatusFilter] = useState('ALL');

    const [collectionSortCol, setCollectionSortCol] = useState('created_at');
    const [collectionSortDir, setCollectionSortDir] = useState('desc');

    const [selectedIds, setSelectedIds] = useState<any[]>([]);

    useEffect(() => {
        setPage(1);
        setSelectedIds([]);
    }, [activeTab]);

    useEffect(() => {
        setSelectedIds([]);
        const timeout = setTimeout(() => {
            refreshData();
        }, 300);
        return () => clearTimeout(timeout);
    }, [activeTab, page, searchQuery, userRoleFilter, userSortCol, userSortDir, examSortCol, examSortDir, examStatusFilter, collectionSortCol, collectionSortDir]);

    const refreshData = async () => {
        if (activeTab === 'appearance') return;
        const token = localStorage.getItem('token');
        let endpoint = '';
        if (activeTab === 'users') endpoint = '/api/admin/users';
        else if (activeTab === 'exams') endpoint = '/api/exams';
        else if (activeTab === 'collections') endpoint = '/api/groups';
        else if (activeTab === 'backups') endpoint = '/api/admin/backups';

        try {
            const params: any = { page, search: searchQuery, limit: 10 };
            if (activeTab === 'users') {
                params.role = userRoleFilter;
                params.sortBy = userSortCol;
                params.sortOrder = userSortDir;
            } else if (activeTab === 'exams') {
                params.sortBy = examSortCol;
                params.sortOrder = examSortDir;
                params.status = examStatusFilter;
            } else if (activeTab === 'collections') {
                params.sortBy = collectionSortCol;
                params.sortOrder = collectionSortDir;
            }

            const res = await axios.get(`${API_BASE_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });

            // Server now returns { data, total, page, limit, totalPages }
            const responseData = res.data.data !== undefined ? res.data.data : res.data;
            const total = res.data.total !== undefined ? res.data.total : (Array.isArray(responseData) ? responseData.length : 0);
            const tPages = res.data.totalPages !== undefined ? res.data.totalPages : 1;

            if (activeTab === 'users') setUsers(responseData);
            else if (activeTab === 'exams') setExams(responseData);
            else if (activeTab === 'collections') setGroups(responseData);
            else if (activeTab === 'backups') setBackups(responseData);

            setTotalPages(tPages);
            setTotalItems(total);
        } catch (err) {
            console.error("Fetch error:", err);
            // Fallback for legacy or failed responses
            if (activeTab === 'users') setUsers([]);
            else if (activeTab === 'exams') setExams([]);
            else if (activeTab === 'collections') setGroups([]);
            else if (activeTab === 'backups') setBackups([]);
            setTotalPages(1);
            setTotalItems(0);
        }
    };

    const updateUserRole = async (userId: string) => {
        const token = localStorage.getItem('token');
        await axios.patch(`${API_BASE_URL}/api/admin/users/${userId}/role`, { role: newRole }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setEditingUserId(null);
        refreshData();
    };

    const deleteUser = async (userId: string) => {
        const result = await showToast.question(
            'Are you sure?',
            "This will delete all associated exams and submissions.",
            'Yes, delete user!',
            'Cancel'
        );

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/admin/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast.success('Deleted!', 'User has been deleted.');
        refreshData();
    };

    const deleteExam = async (examId: string) => {
        const result = await showToast.question(
            t('force_stop_confirm'),
            t('force_stop_text'),
            t('delete'),
            t('cancel')
        );

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/exams/${examId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast.success(t('success'), 'Exam has been deleted.');
        refreshData();
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        const result = await showToast.question(
            'Delete Selected Items?',
            `Are you sure you want to delete ${selectedIds.length} items? This action cannot be undone.`,
            'Yes, delete',
            'Cancel'
        );

        if (!result.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/admin/bulk-delete`, {
                type: activeTab,
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast.success('Success', `Deleted ${selectedIds.length} items.`);
            setSelectedIds([]);
            refreshData();
        } catch (err) {
            console.error(err);
            showToast.error('Error', 'Bulk delete failed. Some items may not have been deleted.');
        }
    };

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            if (activeTab === 'users') setSelectedIds(filteredUsers.map(u => u.id));
            else if (activeTab === 'exams') setSelectedIds(filteredExams.map(e => e.id));
            else if (activeTab === 'collections') setSelectedIds(filteredGroups.map(g => g.id));
            else if (activeTab === 'backups') setSelectedIds(filteredBackups.map(b => b.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelect = (id: any) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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

    const backupExam = async (examId: string) => {
        const result = await showToast.question(
            t('create_backup_confirm'),
            t('create_backup_text'),
            t('create_backup'),
            t('cancel')
        );
        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE_URL}/api/exams/${examId}/backup`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast.success(t('success'), t('backup_created'));
        refreshData();
    };

    const downloadBackup = async (backupId: number) => {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/admin/backups/${backupId}/download`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers['content-disposition'];
        const match = disposition && disposition.match(/filename="?(.+?)"?$/);
        a.download = match ? match[1] : `backup_${backupId}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const exportBackupExcel = async (backupId: number) => {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_BASE_URL}/api/admin/backups/${backupId}/export-excel`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers['content-disposition'];
        const match = disposition && disposition.match(/filename="?(.+?)"?$/);
        a.download = match ? match[1] : `results_backup_${backupId}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const deleteBackup = async (backupId: number) => {
        const result = await showToast.question(
            t('delete_backup_confirm'),
            t('delete_backup_text'),
            t('delete'),
            t('cancel')
        );
        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/admin/backups/${backupId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast.success(t('success'), t('backup_deleted'));
        refreshData();
    };

    const updateGroupName = async (groupId: number) => {
        const token = localStorage.getItem('token');
        await axios.patch(`${API_BASE_URL}/api/groups/${groupId}`, { name: editName }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        setEditingGroupId(null);
        refreshData();
        showToast.success(t('success'), 'Collection renamed.');
    };

    const deleteGroup = async (groupId: number) => {
        const result = await showToast.question(
            t('delete_group_confirm'),
            t('delete_group_text'),
            t('delete'),
            t('cancel')
        );

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/groups/${groupId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast.success(t('success'), t('group_deleted'));
        refreshData();
    };

    const moveExamToGroup = async (examId: string, groupId: string) => {
        const token = localStorage.getItem('token');
        await axios.post(`${API_BASE_URL}/api/exams/${examId}/move`, { group_id: groupId || null }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        showToast.success(t('success'), t('exam_moved'));
        refreshData();
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'ADMIN': return <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-bold">ADMIN</span>;
            case 'LECTURER': return <span className="bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold">LECTURER</span>;
            default: return <span className=" text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">STUDENT</span>;
        }
    };

    const filteredUsers = users;
    const filteredExams = exams;
    const filteredGroups = groups;
    const filteredBackups = backups;

    const Pagination = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-between px-4 md:px-8 py-4 bg-muted/20 border-t border-border">
                <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Page {page} of {totalPages} ({totalItems} records)
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-border bg-surface text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-colors"
                    >
                        Prev
                    </button>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-border bg-surface text-[10px] font-black uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="page-container pb-safe">
            {/* Header */}
            <header className="mb-8 md:mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-4 md:space-y-6 min-w-0">
                    <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-primary transition-all bg-surface/40 px-4 py-2 rounded-full border border-border/50 backdrop-blur-sm">
                        <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
                        <span>{t('back_to_dashboard')}</span>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-2xl md:text-3xl font-light tracking-[0.2em] mb-2 text-foreground uppercase">
                            ADMIN<span className="font-bold opacity-60">ISTRATION</span>
                        </h1>
                        <p className="text-muted-foreground/60 text-[11px] md:text-sm font-medium tracking-wide italic">
                            Manage global system entities and assessment roles
                        </p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-surface/40 backdrop-blur-md p-1 rounded-full border border-border/50 overflow-x-auto flex-shrink-0 scrollbar-hide">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${activeTab === 'users' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        <FontAwesomeIcon icon={faUser} className="text-[10px]" /> {t('admin')}
                    </button>
                    <button
                        onClick={() => setActiveTab('exams')}
                        className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${activeTab === 'exams' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        <FontAwesomeIcon icon={faFileLines} className="text-[10px]" /> {t('all_examinations')}
                    </button>
                    <button
                        onClick={() => setActiveTab('collections')}
                        className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${activeTab === 'collections' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        <FontAwesomeIcon icon={faDatabase} className="text-[10px]" /> {t('collections')}
                    </button>
                    <button
                        onClick={() => setActiveTab('backups')}
                        className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${activeTab === 'backups' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        <FontAwesomeIcon icon={faBoxArchive} className="text-[10px]" /> {t('backups')}
                    </button>
                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${activeTab === 'appearance' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        <FontAwesomeIcon icon={faPalette} className="text-[10px]" />
                        <span className="hidden sm:inline">Appearance</span>
                    </button>
                </div>
            </header>

            {/* ========== APPEARANCE TAB ========== */}
            {activeTab === 'appearance' && (
                <div className="card-minimal">
                    <AppearanceSettings />
                </div>
            )}

            {activeTab !== 'appearance' && <div className="bg-surface/30 backdrop-blur-md border border-border/50 rounded-[32px] overflow-hidden relative shadow-sm">

                {/* Search Bar */}
                <div className="px-6 md:px-8 py-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/20">
                    <div>
                        <h2 className="text-sm md:text-base font-bold text-foreground">
                            {activeTab === 'users' ? 'Registered Identities' : activeTab === 'exams' ? 'Form Blueprints' : activeTab === 'backups' ? t('backup_management') : 'Collection Management'}
                        </h2>
                        <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-[0.1em] mt-0.5">
                            {totalItems} records detected
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {activeTab === 'users' && (
                            <CustomSelect
                                options={[
                                    { id: 'ALL', label: 'All Roles' },
                                    { id: 'STUDENT', label: 'Student' },
                                    { id: 'LECTURER', label: 'Lecturer' },
                                    { id: 'ADMIN', label: 'Admin' }
                                ]}
                                value={userRoleFilter}
                                onChange={setUserRoleFilter}
                                className="w-full sm:w-40"
                            />
                        )}
                        {activeTab === 'exams' && (
                            <CustomSelect
                                options={[
                                    { id: 'ALL', label: 'All Status' },
                                    { id: 'active', label: 'Active' },
                                    { id: 'closed', label: 'Closed' },
                                    { id: 'draft', label: 'Draft' }
                                ]}
                                value={examStatusFilter}
                                onChange={setExamStatusFilter}
                                className="w-full sm:w-40"
                            />
                        )}
                        {activeTab === 'exams' && (
                            <button
                                onClick={importExam}
                                className="h-9 px-4 text-[11px] bg-primary/10 text-primary border border-primary/20 rounded-full hover:bg-primary/20 transition-all font-bold flex items-center justify-center whitespace-nowrap"
                                title="Import Form"
                            >
                                <FontAwesomeIcon icon={faFileImport} className="mr-2" />
                                <span>Import</span>
                            </button>
                        )}
                        <div className="relative">
                            <input
                                className="h-9 pl-10 pr-4 text-[11px] font-bold w-full sm:w-64 bg-surface/50 border border-border/50 rounded-full focus:border-primary outline-none transition-all"
                                placeholder={`Search ${activeTab}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 text-xs" />
                        </div>
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                <AnimatePresence>
                    {selectedIds.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-primary/5 backdrop-blur-md border-b border-primary/10 px-6 md:px-8 py-4 flex items-center justify-between overflow-hidden"
                        >
                            <span className="text-[11px] font-bold text-primary uppercase tracking-[0.1em]">{selectedIds.length} items targeted</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedIds([])} className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">{t('cancel')}</button>
                                <button onClick={handleBulkDelete} className="px-4 py-1.5 text-[10px] font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full transition-all uppercase tracking-widest flex items-center gap-2">
                                    <FontAwesomeIcon icon={faTrash} /> Delete
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Collection Create Section */}
                {activeTab === 'collections' && (
                    <div className="px-6 md:px-8 py-6 bg-surface/10 border-b border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-foreground">Create New Collection</h3>
                            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em] mt-0.5 font-bold">Define a new category for forms and assessments</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input
                                className="h-9 px-4 text-[11px] font-bold w-full sm:w-64 bg-surface/50 border border-border/50 rounded-full focus:border-primary outline-none transition-all"
                                placeholder="Collection Name (e.g. Semester 2/2024)"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                            <button
                                onClick={async () => {
                                    if (!editName.trim()) return;
                                    const token = localStorage.getItem('token');
                                    await axios.post(`${API_BASE_URL}/api/groups`, { name: editName }, { headers: { Authorization: `Bearer ${token}` } });
                                    setEditName('');
                                    refreshData();
                                    showToast.success(t('success'), 'Collection created.');
                                }}
                                className="h-9 px-6 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-primary/20 transition-all flex-shrink-0"
                            >
                                <FontAwesomeIcon icon={faPlus} className="mr-2" /> {t('create')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ========== MOBILE: Card-based view ========== */}
                <div className="md:hidden">
                    <AnimatePresence mode='wait'>
                        {activeTab === 'users' ? (
                            <div className="p-4 space-y-3">
                                {filteredUsers.map((u) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        key={u.id}
                                        className={`p-4 bg-surface/30 backdrop-blur-sm border border-border/40 rounded-2xl flex items-center gap-4 ${selectedIds.includes(u.id) ? 'bg-primary/5 border-primary/20' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded-md border-border bg-surface text-primary focus:ring-primary cursor-pointer flex-shrink-0"
                                            checked={selectedIds.includes(u.id)}
                                            onChange={() => toggleSelect(u.id)}
                                        />
                                        <div className="relative flex-shrink-0">
                                            <img src={u.picture} alt="" className="w-10 h-10 rounded-full border border-border/50" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-bold truncate text-foreground">{u.name}</p>
                                            <p className="text-[10px] text-muted-foreground/60 truncate italic">{u.email}</p>
                                            <div className="mt-2 flex items-center justify-between">
                                                {editingUserId === u.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <CustomSelect
                                                            options={[
                                                                { id: 'STUDENT', label: 'STUDENT' },
                                                                { id: 'LECTURER', label: 'LECTURER' },
                                                                { id: 'ADMIN', label: 'ADMIN' }
                                                            ]}
                                                            value={newRole}
                                                            onChange={setNewRole}
                                                            className="min-w-[120px]"
                                                        />
                                                        <button onClick={() => updateUserRole(u.id)} className="p-2 bg-green-500/10 text-green-600 rounded-xl h-10 w-10 flex items-center justify-center border border-green-500/20"><FontAwesomeIcon icon={faCheck} /></button>
                                                        <button onClick={() => setEditingUserId(null)} className="p-2 bg-surface text-muted-foreground rounded-xl h-10 w-10 flex items-center justify-center border border-border"><FontAwesomeIcon icon={faXmark} /></button>
                                                    </div>
                                                ) : (
                                                    getRoleBadge(u.role)
                                                )}
                                                <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                                                    {u.registered_at ? new Date(u.registered_at).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                        </div>
                                        {editingUserId !== u.id && (
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => { setEditingUserId(u.id); setNewRole(u.role); }}
                                                    className="p-2.5 bg-surface border border-border/50 text-muted-foreground hover:text-primary rounded-xl"
                                                >
                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                </button>
                                                <button onClick={() => deleteUser(u.id)} className="p-2.5 bg-red-500/5 text-red-500 rounded-xl">
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        ) : activeTab === 'exams' ? (
                            <div className="p-4 space-y-3">
                                {filteredExams.map((e) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        key={e.id}
                                        className={`p-4 bg-surface/30 backdrop-blur-sm border border-border/40 rounded-2xl ${selectedIds.includes(e.id) ? 'bg-primary/5 border-primary/20' : ''}`}
                                    >
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="flex flex-col items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-md border-border bg-surface text-primary focus:ring-primary cursor-pointer mt-1"
                                                    checked={selectedIds.includes(e.id)}
                                                    onChange={() => toggleSelect(e.id)}
                                                />
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 flex-shrink-0">
                                                <FontAwesomeIcon icon={faFileLines} className="text-lg" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold truncate text-foreground leading-tight">{e.title}</p>
                                                <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">{e.course}</p>
                                            </div>
                                            <div className={
                                                e.status === 'active'
                                                    ? (e.start_time && new Date(e.start_time) > new Date() ? 'badge-warning' : 'badge-success')
                                                    : 'badge-error'
                                            }>
                                                {e.status === 'active'
                                                    ? (e.start_time && new Date(e.start_time) > new Date() ? 'Scheduled' : 'Live')
                                                    : e.status
                                                }
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                                                Created: {e.created_at ? new Date(e.created_at).toLocaleDateString() : 'N/A'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg border border-border/50 text-[9px] font-bold uppercase tracking-tighter">
                                                <FontAwesomeIcon icon={faClock} className="text-[10px] opacity-40" /> {e.duration_minutes}m
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CustomSelect
                                                    options={[
                                                        { id: '', label: t('ungrouped') },
                                                        ...groups.map(g => ({ id: g.id, label: g.name }))
                                                    ]}
                                                    value={e.group_id || ''}
                                                    onChange={(val) => moveExamToGroup(e.id, val)}
                                                    className="w-full"
                                                    placeholder={t('ungrouped')}
                                                    position="top"
                                                />
                                            </div>
                                            <div className="flex gap-1">
                                                <Link to={`/monitor/${e.id}`} className="p-2.5 bg-indigo-500/5 text-indigo-500 rounded-xl">
                                                    <FontAwesomeIcon icon={faHeartPulse} />
                                                </Link>
                                                <button onClick={() => backupExam(e.id)} className="p-2.5 bg-amber-500/5 text-amber-500 rounded-xl">
                                                    <FontAwesomeIcon icon={faBoxArchive} />
                                                </button>
                                                <button onClick={() => exportExam(e.id, e.title)} className="p-2.5 bg-blue-500/5 text-blue-500 rounded-xl" title="Export Exam">
                                                    <FontAwesomeIcon icon={faFileExport} />
                                                </button>
                                                <button onClick={() => deleteExam(e.id)} className="p-2.5 bg-red-500/5 text-red-500 rounded-xl">
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : activeTab === 'backups' ? (
                            <div className="p-4 space-y-3">
                                {filteredBackups.map((b) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        key={b.id}
                                        className={`p-4 bg-surface/30 backdrop-blur-sm border border-border/40 rounded-2xl ${selectedIds.includes(b.id) ? 'bg-primary/5 border-primary/20' : ''}`}
                                    >
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="flex flex-col items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-md border-border bg-surface text-primary focus:ring-primary cursor-pointer mt-1"
                                                    checked={selectedIds.includes(b.id)}
                                                    onChange={() => toggleSelect(b.id)}
                                                />
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                                                <FontAwesomeIcon icon={faBoxArchive} className="text-lg" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold truncate text-foreground leading-tight">{b.exam_title}</p>
                                                <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">{b.course}</p>
                                            </div>
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${b.backup_type === 'auto' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'}`}>
                                                {b.backup_type === 'auto' ? t('backup_auto') : t('backup_manual')}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg border border-border/50 text-[9px] font-bold uppercase tracking-tighter">
                                                    {b.total_submissions} <span className="text-[8px] opacity-40">SUB</span>
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/40 font-bold ml-2">
                                                    {new Date(b.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => downloadBackup(b.id)} title="Download JSON" className="p-2.5 bg-primary/5 text-primary rounded-xl">
                                                    <FontAwesomeIcon icon={faDownload} />
                                                </button>
                                                <button onClick={() => exportBackupExcel(b.id)} title={t('export_results')} className="p-2.5 bg-green-500/5 text-green-600 rounded-xl">
                                                    <FontAwesomeIcon icon={faFileExport} />
                                                </button>
                                                <button onClick={() => deleteBackup(b.id)} title="Delete Backup" className="p-2.5 bg-red-500/5 text-red-500 rounded-xl">
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {filteredGroups.map((g) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        key={g.id}
                                        className={`p-4 bg-surface/30 backdrop-blur-sm border border-border/40 rounded-2xl flex items-center gap-4 ${selectedIds.includes(g.id) ? 'bg-primary/5 border-primary/20' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded-md border-border bg-surface text-primary focus:ring-primary cursor-pointer flex-shrink-0"
                                            checked={selectedIds.includes(g.id)}
                                            onChange={() => toggleSelect(g.id)}
                                        />
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                            <FontAwesomeIcon icon={faDatabase} className="text-lg" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {editingGroupId === g.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={editName}
                                                        onChange={(ev) => setEditName(ev.target.value)}
                                                        className="h-8 px-2 bg-surface border border-primary/30 rounded-lg text-xs font-bold outline-none flex-1"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => updateGroupName(g.id)} className="p-1.5 bg-green-500/10 text-green-600 rounded-lg"><FontAwesomeIcon icon={faCheck} /></button>
                                                    <button onClick={() => setEditingGroupId(null)} className="p-1.5 bg-muted text-muted-foreground rounded-lg"><FontAwesomeIcon icon={faXmark} /></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-[13px] font-bold truncate text-foreground leading-tight">{g.name}</p>
                                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">{g.creator_name || 'System'}</span>
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 text-primary rounded-full text-[9px] font-bold border border-primary/10">
                                                            {g.exam_count} Forms
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground/40 italic">
                                                            {g.created_at ? new Date(g.created_at).toLocaleDateString() : ''}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {editingGroupId !== g.id && (
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={() => { setEditingGroupId(g.id); setEditName(g.name); }}
                                                    className="p-2.5 bg-surface border border-border/50 text-muted-foreground hover:text-primary rounded-xl"
                                                >
                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                </button>
                                                <button onClick={() => deleteGroup(g.id)} className="p-2.5 bg-red-500/5 text-red-500 rounded-xl">
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ========== DESKTOP: Table view ========== */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] border-b border-border/50">
                                <th className="px-6 py-5 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded-md border-border/50 bg-surface/50 text-primary focus:ring-primary/20 cursor-pointer"
                                        onChange={toggleSelectAll}
                                        checked={
                                            (activeTab === 'users' && selectedIds.length === filteredUsers.length && filteredUsers.length > 0) ||
                                            (activeTab === 'exams' && selectedIds.length === filteredExams.length && filteredExams.length > 0) ||
                                            (activeTab === 'collections' && selectedIds.length === filteredGroups.length && filteredGroups.length > 0) ||
                                            (activeTab === 'backups' && selectedIds.length === filteredBackups.length && filteredBackups.length > 0) || false
                                        }
                                    />
                                </th>
                                {activeTab === 'users' ? (
                                    <>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setUserSortCol('name'); setUserSortDir(userSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Identity {userSortCol === 'name' ? <FontAwesomeIcon icon={userSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setUserSortCol('email'); setUserSortDir(userSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Email {userSortCol === 'email' ? <FontAwesomeIcon icon={userSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setUserSortCol('role'); setUserSortDir(userSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Role {userSortCol === 'role' ? <FontAwesomeIcon icon={userSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setUserSortCol('registered_at'); setUserSortDir(userSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Registered {userSortCol === 'registered_at' ? <FontAwesomeIcon icon={userSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                    </>
                                ) : activeTab === 'exams' ? (
                                    <>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setExamSortCol('title'); setExamSortDir(examSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Form Name {examSortCol === 'title' ? <FontAwesomeIcon icon={examSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5">{t('collections')}</th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setExamSortCol('duration_minutes'); setExamSortDir(examSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Metadata {examSortCol === 'duration_minutes' ? <FontAwesomeIcon icon={examSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setExamSortCol('created_at'); setExamSortDir(examSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Creation {examSortCol === 'created_at' ? <FontAwesomeIcon icon={examSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setExamSortCol('status'); setExamSortDir(examSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Status {examSortCol === 'status' ? <FontAwesomeIcon icon={examSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                    </>
                                ) : activeTab === 'backups' ? (
                                    <>
                                        <th className="px-8 py-5">Form Name</th>
                                        <th className="px-8 py-5">{t('backup_type')}</th>
                                        <th className="px-8 py-5">Data</th>
                                        <th className="px-8 py-5">{t('backup_date')}</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setCollectionSortCol('name'); setCollectionSortDir(collectionSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Name {collectionSortCol === 'name' ? <FontAwesomeIcon icon={collectionSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setCollectionSortCol('creator_name'); setCollectionSortDir(collectionSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Creator {collectionSortCol === 'creator_name' ? <FontAwesomeIcon icon={collectionSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                        <th className="px-8 py-5">Attached Forms</th>
                                        <th className="px-8 py-5 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => { setCollectionSortCol('created_at'); setCollectionSortDir(collectionSortDir === 'asc' ? 'desc' : 'asc'); }}>
                                            Created At {collectionSortCol === 'created_at' ? <FontAwesomeIcon icon={collectionSortDir === 'asc' ? faSortUp : faSortDown} className="ml-1" /> : <FontAwesomeIcon icon={faSort} className="ml-1 opacity-20" />}
                                        </th>
                                    </>
                                )}
                                <th className="px-8 py-5 text-right w-40">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            <AnimatePresence mode='wait'>
                                {activeTab === 'users' ? (
                                    filteredUsers.map((u) => (
                                        <motion.tr
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            key={u.id}
                                            className={`hover:bg-surface/50 transition-colors group ${selectedIds.includes(u.id) ? 'bg-primary/5' : ''}`}
                                        >
                                            <td className="px-5 py-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary cursor-pointer"
                                                    checked={selectedIds.includes(u.id)}
                                                    onChange={() => toggleSelect(u.id)}
                                                />
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <img src={u.picture} alt="" className="w-8 h-8 rounded-full border border-border/50" />
                                                    <span className="text-[13px] font-bold text-foreground">{u.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted-foreground font-medium">{u.email}</td>
                                            <td className="px-8 py-5">
                                                {editingUserId === u.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <CustomSelect
                                                            options={[
                                                                { id: 'STUDENT', label: 'STUDENT' },
                                                                { id: 'LECTURER', label: 'LECTURER' },
                                                                { id: 'ADMIN', label: 'ADMIN' }
                                                            ]}
                                                            value={newRole}
                                                            onChange={setNewRole}
                                                            className="min-w-[140px]"
                                                        />
                                                        <button onClick={() => updateUserRole(u.id)} className="p-2 bg-green-500/10 text-green-600 rounded-xl h-10 w-10 flex items-center justify-center border border-green-500/20"><FontAwesomeIcon icon={faCheck} /></button>
                                                        <button onClick={() => setEditingUserId(null)} className="p-2 bg-surface text-muted-foreground rounded-xl h-10 w-10 flex items-center justify-center border border-border"><FontAwesomeIcon icon={faXmark} /></button>
                                                    </div>
                                                ) : (
                                                    getRoleBadge(u.role)
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted-foreground font-medium">
                                                {u.registered_at ? new Date(u.registered_at).toLocaleString() : '-'}
                                            </td>
                                            <td className="px-8 py-5 text-right space-x-2">
                                                {editingUserId === u.id ? (
                                                    <>
                                                        <button onClick={() => updateUserRole(u.id)} className="p-2.5 bg-green-500/10 text-green-600 rounded-xl hover:bg-green-500/20 transition-colors">
                                                            <FontAwesomeIcon icon={faCheck} className="text-lg" />
                                                        </button>
                                                        <button onClick={() => setEditingUserId(null)} className="p-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-border transition-colors">
                                                            <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => { setEditingUserId(u.id); setNewRole(u.role); }}
                                                            className="p-2.5 bg-surface border border-border text-muted-foreground hover:text-primary hover:border-primary/30 rounded-xl transition-all"
                                                        >
                                                            <FontAwesomeIcon icon={faPenToSquare} className="text-lg" />
                                                        </button>
                                                        <button onClick={() => deleteUser(u.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors">
                                                            <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : activeTab === 'exams' ? (
                                    filteredExams.map((e) => (
                                        <motion.tr
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            key={e.id}
                                            className={`hover:bg-surface/50 transition-colors group ${selectedIds.includes(e.id) ? 'bg-primary/5' : ''}`}
                                        >
                                            <td className="px-5 py-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary cursor-pointer"
                                                    checked={selectedIds.includes(e.id)}
                                                    onChange={() => toggleSelect(e.id)}
                                                />
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-[10px]">
                                                        <FontAwesomeIcon icon={faFileLines} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-foreground leading-tight">{e.title}</p>
                                                        <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-[0.1em]">{e.course}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <CustomSelect
                                                    options={[
                                                        { id: '', label: t('ungrouped') },
                                                        ...groups.map(g => ({ id: g.id, label: g.name }))
                                                    ]}
                                                    value={e.group_id || ''}
                                                    onChange={(val) => moveExamToGroup(e.id, val)}
                                                    className="min-w-[150px]"
                                                    placeholder={t('ungrouped')}
                                                />
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted-foreground font-medium">
                                                <span className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-tighter">
                                                    <FontAwesomeIcon icon={faClock} className="text-xs" /> {e.duration_minutes} Minutes
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted-foreground font-medium">
                                                {e.created_at ? new Date(e.created_at).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className={
                                                    e.status === 'active'
                                                        ? (e.start_time && new Date(e.start_time) > new Date() ? 'badge-warning' : 'badge-success')
                                                        : 'badge-error'
                                                }>
                                                    {e.status === 'active'
                                                        ? (e.start_time && new Date(e.start_time) > new Date() ? 'Scheduled' : 'Live')
                                                        : e.status
                                                    }
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link to={`/monitor/${e.id}`} className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl hover:bg-indigo-500/20 transition-colors">
                                                        <FontAwesomeIcon icon={faHeartPulse} className="text-lg" />
                                                    </Link>
                                                    <button
                                                        onClick={() => backupExam(e.id)}
                                                        className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl hover:bg-amber-500/20 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faBoxArchive} className="text-lg" />
                                                    </button>
                                                    <button
                                                        onClick={() => exportExam(e.id, e.title)}
                                                        title="Export Form"
                                                        className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl hover:bg-blue-500/20 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faFileExport} className="text-lg" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteExam(e.id)}
                                                        className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : activeTab === 'backups' ? (
                                    filteredBackups.map((b) => (
                                        <motion.tr
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            key={b.id}
                                            className={`hover:bg-surface/50 transition-colors group ${selectedIds.includes(b.id) ? 'bg-primary/5' : ''}`}
                                        >
                                            <td className="px-5 py-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary cursor-pointer"
                                                    checked={selectedIds.includes(b.id)}
                                                    onChange={() => toggleSelect(b.id)}
                                                />
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                                        <FontAwesomeIcon icon={faBoxArchive} className="text-xl" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold">{b.exam_title}</p>
                                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{b.course}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${b.backup_type === 'auto' ? 'bg-blue-500/10 text-blue-600 border-blue-200' : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'}`}>
                                                    {b.backup_type === 'auto' ? t('backup_auto') : t('backup_manual')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-tighter">
                                                        {b.total_submissions} {t('backup_submissions')}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-tighter">
                                                        {b.total_questions} {t('backup_questions')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted-foreground font-medium">
                                                {new Date(b.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => downloadBackup(b.id)}
                                                        title="Download JSON"
                                                        className="p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faDownload} className="text-lg" />
                                                    </button>
                                                    <button
                                                        onClick={() => exportBackupExcel(b.id)}
                                                        title={t('export_results')}
                                                        className="p-2.5 bg-green-500/10 text-green-600 rounded-xl hover:bg-green-500/20 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faFileExport} className="text-lg" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteBackup(b.id)}
                                                        title="Delete Backup"
                                                        className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : (
                                    filteredGroups.map((g) => (
                                        <motion.tr
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            key={g.id}
                                            className={`hover:bg-surface/50 transition-colors group ${selectedIds.includes(g.id) ? 'bg-primary/5' : ''}`}
                                        >
                                            <td className="px-5 py-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border bg-surface text-primary focus:ring-primary cursor-pointer"
                                                    checked={selectedIds.includes(g.id)}
                                                    onChange={() => toggleSelect(g.id)}
                                                />
                                            </td>
                                            <td className="px-8 py-5">
                                                {editingGroupId === g.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={editName}
                                                            onChange={(ev) => setEditName(ev.target.value)}
                                                            className="h-9 px-3 bg-surface border border-primary rounded-lg text-sm font-bold outline-none w-64"
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px]">
                                                            <FontAwesomeIcon icon={faDatabase} />
                                                        </div>
                                                        <span className="text-[13px] font-bold text-foreground">{g.name}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{g.creator_name || 'System'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                                                    {g.exam_count} Forms
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-sm text-muted-foreground font-medium">
                                                {g.created_at ? new Date(g.created_at).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {editingGroupId === g.id ? (
                                                        <>
                                                            <button onClick={() => updateGroupName(g.id)} className="p-2.5 bg-green-500/10 text-green-600 rounded-xl hover:bg-green-500/20 transition-colors">
                                                                <FontAwesomeIcon icon={faCheck} className="text-lg" />
                                                            </button>
                                                            <button onClick={() => setEditingGroupId(null)} className="p-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-border transition-colors">
                                                                <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => { setEditingGroupId(g.id); setEditName(g.name); }}
                                                                className="p-2.5 bg-surface border border-border text-muted-foreground hover:text-primary hover:border-primary/30 rounded-xl transition-all"
                                                            >
                                                                <FontAwesomeIcon icon={faPenToSquare} className="text-lg" />
                                                            </button>
                                                            <button onClick={() => deleteGroup(g.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors">
                                                                <FontAwesomeIcon icon={faTrash} className="text-lg" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {((activeTab === 'users' && filteredUsers.length === 0) || (activeTab === 'exams' && filteredExams.length === 0) || (activeTab === 'collections' && filteredGroups.length === 0) || (activeTab === 'backups' && filteredBackups.length === 0)) && (
                    <div className="py-16 md:py-24 text-center">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-2xl md:text-3xl text-muted-foreground/30" />
                        </div>
                        <p className="text-muted-foreground font-bold tracking-tight">{t('no_records_found')}</p>
                    </div>
                )}

                <Pagination />
            </div>}

            {/* Footer Banner */}
            <div className="mt-12 p-8 bg-surface/30 backdrop-blur-md rounded-[32px] border border-border/50 relative overflow-hidden">
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
                            <FontAwesomeIcon icon={faShieldHalved} className="text-primary text-2xl" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-foreground">System Intelligence Monitoring</p>
                            <p className="text-muted-foreground/60 text-[11px] max-w-md italic tracking-wide">Governance protocols are active. All identity mutations are asynchronously journaled.</p>
                        </div>
                    </div>
                    <div className="flex gap-8 text-[10px] font-bold tracking-[0.2em] px-6 py-4 rounded-full bg-surface/40 border border-border/50 w-full md:w-auto justify-around">
                        <div className="flex flex-col gap-1 items-center">
                            <span className="opacity-40 uppercase">Load</span>
                            <span className="text-emerald-500">OPTIMAL</span>
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="opacity-40 uppercase">Sync</span>
                            <span className="text-primary">ACTIVE</span>
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                            <span className="opacity-40 uppercase">Uptime</span>
                            <span className="text-emerald-500">100.0%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default AdminPanel;
