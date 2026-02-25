import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faFloppyDisk, faCircleCheck, faUser, faSpinner, faListCheck, faFilter } from '@fortawesome/free-solid-svg-icons';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import showToast from '../utils/swal';
import { API_BASE_URL } from '../config';
import CustomSelect from '../components/CustomSelect';

interface ReviewQuestion {
    id: number;
    type: 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes';
    question_text: string;
    options: string[];
    correct_answers: string[];
    image_url: string | null;
    section_id: number | null;
    section_title: string | null;
    order_index: number | null;
    score: number;
}

interface ReviewSubmission {
    id: number;
    student_id: string;
    std_id: string;
    student_name: string;
    student_email: string;
    student_picture: string | null;
    answers: Record<string, any>;
    raw_score: number;
    total_questions: number;
    submitted_at: string;
}

interface ReviewSection {
    id: number;
    title: string;
    description: string;
    order_index: number;
}

interface ExamInfo {
    id: string;
    title: string;
    course: string;
}

const ManualGrade = () => {
    const { t } = useLanguage();
    const { examId } = useParams();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exam, setExam] = useState<ExamInfo | null>(null);
    const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
    const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
    const [sections, setSections] = useState<ReviewSection[]>([]);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
    const [manualScores, setManualScores] = useState<Record<string, number>>({});
    const [hasChanges, setHasChanges] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes'>('all');

    const questionTypeCounts = useMemo(() => {
        const counts: Record<string, number> = { all: questions.length };
        for (const q of questions) {
            counts[q.type] = (counts[q.type] || 0) + 1;
        }
        return counts;
    }, [questions]);

    const availableTypes = useMemo(() => {
        const types = new Set(questions.map(q => q.type));
        return Array.from(types);
    }, [questions]);

    useEffect(() => {
        const fetchReviewData = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE_URL}/api/exams/${examId}/review`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setExam(res.data.exam);
                setQuestions(res.data.questions);
                setSubmissions(res.data.submissions);
                setSections(res.data.sections);

                if (res.data.submissions.length > 0) {
                    const firstSub = res.data.submissions[0];
                    setSelectedSubmissionId(firstSub.id);
                    // Load existing manual scores if present
                    if (firstSub.answers._manual_scores) {
                        setManualScores(firstSub.answers._manual_scores);
                    } else {
                        initializeScores(res.data.questions, firstSub);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch review data', err);
                showToast.error(t('error'), t('error_loading_data'));
            } finally {
                setLoading(false);
            }
        };
        fetchReviewData();
    }, [examId]);

    const initializeScores = (qs: ReviewQuestion[], sub: ReviewSubmission) => {
        const scores: Record<string, number> = {};
        for (const q of qs) {
            const qIdStr = String(q.id);
            const studentAnswers = sub.answers[q.id] || [];
            const maxScore = q.score || 1;

            if (q.type === 'short_answer' || q.type === 'paragraph') {
                const studentAns = (studentAnswers[0] || '').trim().toLowerCase();
                const isCorrect = studentAns && q.correct_answers.some(c => c.trim().toLowerCase() === studentAns);
                scores[qIdStr] = isCorrect ? maxScore : 0;
            } else {
                const isCorrect = q.correct_answers.length === studentAnswers.length &&
                    q.correct_answers.every(v => studentAnswers.includes(v));
                scores[qIdStr] = isCorrect ? maxScore : 0;
            }
        }
        setManualScores(scores);
    };

    const selectedSubmission = useMemo(() => {
        return submissions.find(s => s.id === selectedSubmissionId) || null;
    }, [submissions, selectedSubmissionId]);

    const handleStudentChange = (subId: any) => {
        const numId = Number(subId);
        setSelectedSubmissionId(numId);
        setHasChanges(false);
        const sub = submissions.find(s => s.id === numId);
        if (sub) {
            if (sub.answers._manual_scores) {
                setManualScores(sub.answers._manual_scores);
            } else {
                initializeScores(questions, sub);
            }
        }
    };

    const setScore = (questionId: number, value: number, maxScore: number) => {
        const qIdStr = String(questionId);
        const clamped = Math.min(Math.max(0, value), maxScore);
        setManualScores(prev => ({
            ...prev,
            [qIdStr]: clamped,
        }));
        setHasChanges(true);
    };

    const totalManualScore = useMemo(() => {
        return Object.values(manualScores).reduce((acc, v) => acc + v, 0);
    }, [manualScores]);

    const totalMaxScore = useMemo(() => {
        return questions.reduce((acc, q) => acc + (q.score || 1), 0);
    }, [questions]);

    const handleSave = async () => {
        if (!selectedSubmissionId) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.patch(
                `${API_BASE_URL}/api/submissions/${selectedSubmissionId}/manual-score`,
                { manual_scores: manualScores },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Update the local submission data
            setSubmissions(prev => prev.map(s =>
                s.id === selectedSubmissionId
                    ? { ...s, raw_score: res.data.raw_score, answers: { ...s.answers, _manual_scores: manualScores } }
                    : s
            ));
            setHasChanges(false);
            showToast.success(t('success'), t('score_saved_success'));
        } catch (err) {
            console.error('Failed to save score', err);
            showToast.error(t('error'), t('score_save_error'));
        } finally {
            setSaving(false);
        }
    };

    const getStudentAnswer = (questionId: number): string[] => {
        if (!selectedSubmission) return [];
        return selectedSubmission.answers[questionId] || [];
    };

    const isAutoCorrect = (q: ReviewQuestion): boolean => {
        const studentAnswers = getStudentAnswer(q.id);
        if (q.type === 'short_answer' || q.type === 'paragraph') {
            const studentAns = (studentAnswers[0] || '').trim().toLowerCase();
            return Boolean(studentAns && q.correct_answers.some(c => c.trim().toLowerCase() === studentAns));
        } else {
            return q.correct_answers.length === studentAnswers.length &&
                q.correct_answers.every(v => studentAnswers.includes(v));
        }
    };

    const getAutoScore = (q: ReviewQuestion): number => {
        return isAutoCorrect(q) ? (q.score || 1) : 0;
    };

    // Filter questions by type
    const filteredQuestions = useMemo(() => {
        if (filterType === 'all') return questions;
        return questions.filter(q => q.type === filterType);
    }, [questions, filterType]);

    // Group questions by section
    const groupedQuestions = useMemo(() => {
        const grouped: { section: ReviewSection | null; questions: ReviewQuestion[] }[] = [];

        const sectionMap = new Map<number, ReviewQuestion[]>();
        const ungrouped: ReviewQuestion[] = [];

        for (const q of filteredQuestions) {
            if (q.section_id) {
                if (!sectionMap.has(q.section_id)) {
                    sectionMap.set(q.section_id, []);
                }
                sectionMap.get(q.section_id)!.push(q);
            } else {
                ungrouped.push(q);
            }
        }

        for (const section of sections) {
            const sectionQs = sectionMap.get(section.id) || [];
            if (sectionQs.length > 0) {
                grouped.push({ section, questions: sectionQs });
            }
        }

        if (ungrouped.length > 0) {
            grouped.push({ section: null, questions: ungrouped });
        }

        return grouped;
    }, [filteredQuestions, sections]);

    let globalQIndex = 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-surface/30 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <FontAwesomeIcon icon={faSpinner} className="text-4xl text-primary animate-spin" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Review Data...</p>
                </div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen bg-surface/30 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-sm font-bold text-muted-foreground">{t('error_loading_data')}</p>
                    <Link to="/" className="text-primary font-bold text-sm">{t('back_to_dashboard')}</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface/30">
            {/* Fixed Top Header - same as CreateExam */}
            <header className="fixed top-0 inset-x-0 h-14 md:h-16 navbar-blur border-b border-border z-50">
                <div className="max-w-5xl mx-auto h-full px-3 md:px-6 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-6 min-w-0">
                        <Link to="/" className="text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-1.5 md:gap-2 transition-all flex-shrink-0">
                            <FontAwesomeIcon icon={faChevronLeft} className="text-sm md:text-base" />
                            <span className="hidden sm:inline">{t('back_to_overview')}</span>
                            <span className="sm:hidden">Back</span>
                        </Link>
                        <div className="h-4 w-[1px] bg-border flex-shrink-0"></div>
                        <h2 className="text-xs md:text-sm font-bold truncate uppercase tracking-tight">
                            {t('manual_grading')}
                        </h2>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="btn-primary-minimal text-[10px] md:text-xs h-8 md:h-9 px-3 md:px-6 bg-primary flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} className={`mr-1 md:mr-2 ${saving ? 'animate-spin' : ''}`} />
                        {t('save_scores')}
                    </button>
                </div>
            </header>

            <div className="max-w-5xl mx-auto pt-20 md:pt-24 pb-16 px-3 md:px-6">
                {/* Exam Header Card - similar to CreateExam */}
                <div className="card-minimal border-t-4 border-t-primary !p-4 md:!p-6 mb-6">
                    <h1 className="text-xl md:text-2xl font-black mb-1">{exam.title}</h1>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{exam.course}</p>
                </div>

                {/* Config Panel */}
                <div className="card-minimal !p-3 mb-6 space-y-3">
                    {submissions.length > 0 ? (
                        <div className="flex flex-col md:flex-row items-stretch gap-2">
                            {/* Student Selector */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-surface/50 rounded-xl border border-border/50 p-1.5">
                                <button
                                    onClick={() => {
                                        const idx = submissions.findIndex(s => s.id === selectedSubmissionId);
                                        if (idx > 0) handleStudentChange(submissions[idx - 1].id);
                                    }}
                                    disabled={submissions.findIndex(s => s.id === selectedSubmissionId) <= 0}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    <FontAwesomeIcon icon={faChevronLeft} className="text-[10px]" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <CustomSelect
                                        options={submissions.map(s => ({
                                            id: s.id,
                                            label: `${s.student_name} (${s.std_id || s.student_email.split('@')[0]}) — ${s.raw_score}/${totalMaxScore}`
                                        }))}
                                        value={selectedSubmissionId}
                                        onChange={handleStudentChange}
                                        icon={faUser}
                                        placeholder={t('select_student')}
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const idx = submissions.findIndex(s => s.id === selectedSubmissionId);
                                        if (idx < submissions.length - 1) handleStudentChange(submissions[idx + 1].id);
                                    }}
                                    disabled={submissions.findIndex(s => s.id === selectedSubmissionId) >= submissions.length - 1}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                                </button>
                                <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums flex-shrink-0 px-1">
                                    {submissions.findIndex(s => s.id === selectedSubmissionId) + 1}/{submissions.length}
                                </span>
                            </div>

                            {selectedSubmission && (
                                <>
                                    {/* Student Info */}
                                    <div className="flex items-center gap-2.5 bg-surface/50 rounded-xl border border-border/50 p-1.5 px-3 flex-shrink-0">
                                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/20 flex-shrink-0">
                                            {selectedSubmission.student_picture ? (
                                                <img src={selectedSubmission.student_picture} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-[10px] font-black text-primary">{selectedSubmission.student_name?.charAt(0)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold truncate leading-tight">{selectedSubmission.student_name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate leading-tight">{selectedSubmission.std_id || selectedSubmission.student_email.split('@')[0]}</p>
                                        </div>
                                    </div>

                                    {/* Score Summary */}
                                    <div className="flex items-center gap-2 bg-primary/5 rounded-xl border border-primary/20 p-1.5 px-3 flex-shrink-0">
                                        <div className="text-center">
                                            <div className="text-xl font-black text-primary tabular-nums leading-tight">
                                                {totalManualScore}<span className="text-xs text-muted-foreground font-bold">/{totalMaxScore}</span>
                                            </div>
                                            <p className="text-[8px] font-bold uppercase tracking-widest text-primary/50">{t('manual_score')}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 bg-surface/50 rounded-xl border border-border/50 text-center">
                            <p className="text-sm text-muted-foreground font-semibold">{t('no_submissions')}</p>
                        </div>
                    )}

                    {/* Question Type Filter */}
                    {questions.length > 0 && (
                        <div className="pt-2 border-t border-border/30">
                            <div className="flex items-center gap-2 mb-1.5">
                                <FontAwesomeIcon icon={faFilter} className="text-[10px] text-muted-foreground/40" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{t('filter_by_type')}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {[{ key: 'all' as const, label: t('all') }, ...availableTypes.map(type => ({ key: type as typeof filterType, label: t(type as any) || type.replace('_', ' ') }))].map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilterType(key)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 ${filterType === key
                                            ? 'bg-primary/10 text-primary border-primary/30'
                                            : 'bg-surface/50 text-muted-foreground border-border/50 hover:border-primary/20 hover:text-primary/80'
                                            }`}
                                    >
                                        {label}
                                        <span className={`ml-1.5 tabular-nums ${filterType === key ? 'text-primary/60' : 'text-muted-foreground/30'}`}>
                                            {questionTypeCounts[key] || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Questions Review Area */}
                {selectedSubmission && (
                    <div className="space-y-8">
                        {groupedQuestions.map((group, gIdx) => {
                            return (
                                <div key={gIdx} className="space-y-4">
                                    {/* Section Header */}
                                    {group.section && (
                                        <div className="flex items-center gap-3 pt-4">
                                            <div className="h-8 w-1 bg-primary rounded-full"></div>
                                            <div>
                                                <h3 className="text-sm font-bold uppercase tracking-wider">{group.section.title}</h3>
                                                {group.section.description && (
                                                    <p className="text-xs text-muted-foreground">{group.section.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <AnimatePresence mode="popLayout">
                                        {group.questions.map((q) => {
                                            globalQIndex++;
                                            const currentIdx = globalQIndex;
                                            const studentAnswers = getStudentAnswer(q.id);
                                            const scoreVal = manualScores[String(q.id)] ?? 0;
                                            const maxScore = q.score || 1;
                                            const isFullScore = scoreVal === maxScore;
                                            const isZero = scoreVal === 0;
                                            const autoScore = getAutoScore(q);

                                            return (
                                                <motion.div
                                                    key={q.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="relative"
                                                >
                                                    <div className={`card-minimal space-y-4 transition-all duration-300 !p-4 md:!p-6 border-l-4 ${isFullScore
                                                        ? 'border-l-emerald-500/50'
                                                        : isZero
                                                            ? 'border-l-red-500/50'
                                                            : 'border-l-amber-500/50'
                                                        }`}>
                                                        {/* Question Header */}
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <span className="text-[10px] font-bold text-muted-foreground/50 bg-surface px-2 py-0.5 rounded-md border border-border tabular-nums">
                                                                        Q{currentIdx}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${q.type === 'multiple_choice' || q.type === 'checkboxes'
                                                                        ? 'bg-indigo-500/5 text-indigo-500 border-indigo-500/20'
                                                                        : 'bg-amber-500/5 text-amber-500 border-amber-500/20'
                                                                        }`}>
                                                                        {t(q.type as any) || q.type.replace('_', ' ')}
                                                                    </span>
                                                                    {scoreVal !== autoScore && (
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-violet-500/5 text-violet-500 border border-violet-500/20">
                                                                            {t('manually_adjusted')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-base md:text-lg font-semibold leading-relaxed">{q.question_text}</p>
                                                            </div>

                                                            {/* Score Control */}
                                                            <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                                                <div className={`rounded-2xl border-2 transition-all duration-300 px-2 py-1.5 flex items-center gap-2 ${isFullScore
                                                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                                                    : isZero
                                                                        ? 'bg-red-500/10 border-red-500/30'
                                                                        : 'bg-amber-500/10 border-amber-500/30'
                                                                    }`}>
                                                                    <button
                                                                        onClick={() => setScore(q.id, scoreVal - 1, maxScore)}
                                                                        disabled={scoreVal <= 0}
                                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold bg-surface/80 border border-border hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    >
                                                                        −
                                                                    </button>
                                                                    <span className={`text-lg font-black tabular-nums min-w-[2ch] text-center ${isFullScore ? 'text-emerald-600' : isZero ? 'text-red-500' : 'text-amber-600'}`}>
                                                                        {scoreVal}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => setScore(q.id, scoreVal + 1, maxScore)}
                                                                        disabled={scoreVal >= maxScore}
                                                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold bg-surface/80 border border-border hover:bg-surface-hover transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                                <span className="text-[9px] font-bold text-muted-foreground/50 tabular-nums">/ {maxScore}</span>
                                                            </div>
                                                        </div>

                                                        {/* Question Image */}
                                                        {q.image_url && (
                                                            <div className="relative">
                                                                <img
                                                                    src={`${import.meta.env.BASE_URL}${q.image_url.startsWith('/') ? q.image_url.slice(1) : q.image_url}`}
                                                                    alt="Question"
                                                                    className="max-w-full h-auto rounded-xl border border-border max-h-64 object-contain"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Multiple Choice / Checkboxes Options */}
                                                        {q.type !== 'short_answer' && q.type !== 'paragraph' && q.options.length > 0 && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                {q.options.map((opt, oIdx) => {
                                                                    const isStudentSelected = studentAnswers.includes(opt);
                                                                    const isCorrectOption = q.correct_answers.includes(opt);

                                                                    return (
                                                                        <div
                                                                            key={oIdx}
                                                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isStudentSelected && isCorrectOption
                                                                                ? 'bg-emerald-500/5 border-emerald-500/30'
                                                                                : isStudentSelected && !isCorrectOption
                                                                                    ? 'bg-red-500/5 border-red-500/30'
                                                                                    : isCorrectOption
                                                                                        ? 'bg-emerald-500/5 border-emerald-500/20 border-dashed'
                                                                                        : 'bg-surface/50 border-border/50'
                                                                                }`}
                                                                        >
                                                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${q.type === 'checkboxes' ? 'rounded-md' : ''} ${isCorrectOption
                                                                                ? 'bg-emerald-500 text-white'
                                                                                : isStudentSelected
                                                                                    ? 'bg-red-500 text-white'
                                                                                    : 'bg-surface border border-border'
                                                                                }`}>
                                                                                {(isCorrectOption || isStudentSelected) && (
                                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={isCorrectOption ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                                                                                    </svg>
                                                                                )}
                                                                            </div>
                                                                            <span className={`text-sm ${isStudentSelected ? 'font-bold' : 'font-medium text-muted-foreground'}`}>
                                                                                {opt}
                                                                            </span>
                                                                            <div className="flex items-center gap-1 ml-auto">
                                                                                {isStudentSelected && (
                                                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface border border-border">
                                                                                        {t('student')}
                                                                                    </span>
                                                                                )}
                                                                                {isCorrectOption && (
                                                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                                                        {t('correct_answer')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Short Answer / Paragraph Display */}
                                                        {(q.type === 'short_answer' || q.type === 'paragraph') && (
                                                            <div className="space-y-3">
                                                                {/* Correct Answer */}
                                                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-500 text-xs" />
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">{t('correct_answer')}</span>
                                                                    </div>
                                                                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                                                        {q.correct_answers.join(', ') || <span className="italic text-muted-foreground">{t('no_correct_answer_set')}</span>}
                                                                    </p>
                                                                </div>

                                                                {/* Student Answer */}
                                                                <div className={`p-3 rounded-xl border ${isFullScore
                                                                    ? 'bg-primary/5 border-primary/20'
                                                                    : scoreVal > 0
                                                                        ? 'bg-amber-500/5 border-amber-500/20'
                                                                        : 'bg-red-500/5 border-red-500/20'
                                                                    }`}>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <FontAwesomeIcon icon={faUser} className="text-xs text-muted-foreground" />
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('student_answer')}</span>
                                                                    </div>
                                                                    <p className={`text-sm font-semibold ${isFullScore ? 'text-primary' : scoreVal > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                                                        {studentAnswers[0] || <span className="italic text-muted-foreground/50">{t('no_answer')}</span>}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            );
                        })}

                        {/* Bottom Save Button */}
                        <div className="sticky bottom-3 md:bottom-6 flex gap-4 pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className="flex-1 btn-primary-minimal h-12 md:h-14 text-sm md:text-base relative overflow-hidden group/submit disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover/submit:translate-y-0 transition-transform duration-300"></div>
                                <div className="relative flex items-center justify-center">
                                    <FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} className={`mr-2 text-lg md:text-xl ${saving ? 'animate-spin' : ''}`} />
                                    {t('save_scores')} — {totalManualScore}/{totalMaxScore}
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {submissions.length === 0 && !loading && (
                    <div className="card-minimal !p-12 text-center">
                        <FontAwesomeIcon icon={faListCheck} className="text-5xl text-muted-foreground/20 mb-4" />
                        <h3 className="text-lg font-bold text-muted-foreground mb-2">{t('no_submissions')}</h3>
                        <p className="text-sm text-muted-foreground/60">{t('no_submissions_help')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualGrade;
