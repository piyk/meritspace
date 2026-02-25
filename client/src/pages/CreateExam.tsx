import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faFloppyDisk, faChevronLeft, faTableCellsLarge, faListCheck, faUsers, faEnvelope, faImage, faXmark, faCopy, faGripVertical, faChevronUp, faChevronDown, faCirclePlus, faFileCsv, faDownload, faAsterisk, faPalette, faCircleCheck, faFilePdf, faSpinner, faWandMagicSparkles, faVideo, faAlignLeft, faAlignJustify, faCircleDot, faSquareCheck } from '@fortawesome/free-solid-svg-icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import showToast from '../utils/swal';
import { API_BASE_URL } from '../config';
import * as pdfjsLib from 'pdfjs-dist';
import CustomSelect from '../components/CustomSelect';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PdfFileObj {
    file: File;
    thumbnailUrl: string | null;
}

interface Question {
    id?: number;
    type: 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes';
    question_text: string;
    options: string[];
    correct_answers: string[];
    image_url: string | null;
    is_required: boolean;
    score: number;
}

interface Section {
    id: string | number;
    title: string;
    description: string;
    questions: Question[];
}

interface ExamData {
    title: string;
    course: string;
    duration_minutes: number;
    start_time: string;
    is_public: boolean;
    permitted_emails: string[];
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_score: boolean;
    group_id: number | null;
    allow_late_submission: boolean;
    show_in_dashboard: boolean;
    start_method: 'auto' | 'manual';
    enable_video_proctoring: boolean;
    sections: Section[];
    theme_config?: {
        primary_color: string;
        background_color: string;
        text_color: string;
    };
}

interface Group {
    id: number;
    name: string;
}

const CreateExam = () => {
    const { t } = useLanguage();
    const { examId } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(examId);

    const [examData, setExamData] = useState<ExamData>({
        title: '',
        course: '',
        duration_minutes: 60,
        start_time: '',
        is_public: true,
        permitted_emails: [],
        shuffle_questions: false,
        shuffle_options: false,
        show_score: true,
        group_id: null,
        allow_late_submission: false,
        show_in_dashboard: false,
        enable_video_proctoring: false,
        start_method: 'manual',
        theme_config: {
            primary_color: '#0D47A1', // Ocean Blue
            background_color: '#f8faff',
            text_color: '#0D47A1'
        },
        sections: [
            {
                id: 'initial',
                title: t('general_questions'),
                description: '',
                questions: [
                    { type: 'multiple_choice', question_text: '', options: [''], correct_answers: [], image_url: null, is_required: false, score: 1 }
                ]
            }
        ]
    });

    const [groups, setGroups] = useState<Group[]>([]);
    const [bulkEmails, setBulkEmails] = useState('');
    const [uploadingImage, setUploadingImage] = useState<{ sIdx: number, qIdx: number } | null>(null);
    const [showAppearance, setShowAppearance] = useState(false);
    const [pdfPrompt, setPdfPrompt] = useState('');
    const [aiLanguage, setAiLanguage] = useState<'th' | 'en'>('th');
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfFiles, setPdfFiles] = useState<PdfFileObj[]>([]);
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);

    const questionTypes = [
        { id: 'short_answer', label: t('short_answer'), icon: faAlignLeft },
        { id: 'paragraph', label: t('paragraph'), icon: faAlignJustify },
        { id: 'multiple_choice', label: t('multiple_choice'), icon: faCircleDot },
        { id: 'checkboxes', label: t('checkboxes'), icon: faSquareCheck },
    ];
    const [bloomLevels, setBloomLevels] = useState<string[]>([]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_BASE_URL}/api/groups`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { limit: 100 } // Fetch more for the dropdown
                });
                const groupData = res.data.data !== undefined ? res.data.data : res.data;
                setGroups(groupData);
            } catch (err) {
                console.error('Failed to fetch groups', err);
            }
        };
        fetchGroups();

        if (isEdit) {
            const fetchExam = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await axios.get(`${API_BASE_URL}/api/exams/${examId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = res.data;
                    let sections = data.sections || [];
                    if (data.ungrouped_questions && data.ungrouped_questions.length > 0) {
                        sections.unshift({
                            id: 'legacy',
                            title: t('ungrouped_questions'),
                            description: '',
                            questions: data.ungrouped_questions
                        });
                    }
                    if (sections.length === 0) {
                        sections = [{ id: 'new', title: t('questions'), description: '', questions: [] }];
                    }
                    setExamData({
                        ...data,
                        is_public: data.is_public === 1,
                        show_in_dashboard: data.show_in_dashboard === 1,
                        permitted_emails: data.permitted_emails || [],
                        shuffle_questions: data.shuffle_questions === 1,
                        shuffle_options: data.shuffle_options === 1,
                        show_score: data.show_score === 1,
                        enable_video_proctoring: data.enable_video_proctoring === 1,
                        group_id: data.group_id || null,
                        start_time: data.start_time ? formatDateForInput(data.start_time) : '',
                        sections: sections,
                        theme_config: data.theme_config || {
                            primary_color: '#3b82f6',
                            background_color: '#f8fafc',
                            text_color: '#0f172a'
                        }
                    });
                    if (data.permitted_emails) {
                        setBulkEmails(data.permitted_emails.join('\n'));
                    }
                } catch (err) {
                    console.error('Failed to fetch exam', err);
                    showToast.error(t('error'), t('error_loading_data'));
                }
            };
            fetchExam();
        }
    }, [examId, isEdit]);


    // Helper to format ISO/Date string to local datetime-local input format (YYYY-MM-DDTHH:mm)
    const formatDateForInput = (dateString: string) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';

        // datetime-local expects local time, but Date.toISOString() returns UTC.
        // We need manually construct the string or offset the time.
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        return localISOTime;
    };

    const generateThumbnail = async (file: File): Promise<string | null> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            if (pdf.numPages === 0) return null;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return null;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport, canvas }).promise;
            return canvas.toDataURL('image/jpeg', 0.8);
        } catch (e) {
            console.error("Error generating thumbnail", e);
            return null;
        }
    };

    const handlePdfSelection = async (files: File[]) => {
        setIsProcessingPdf(true);
        const newFileObjs: PdfFileObj[] = [];
        for (const f of files) {
            const thumb = await generateThumbnail(f);
            newFileObjs.push({ file: f, thumbnailUrl: thumb });
        }
        setPdfFiles(prev => [...prev, ...newFileObjs]);
        setIsProcessingPdf(false);
    };

    const removePdfFile = (index: number) => {
        setPdfFiles(prev => {
            const next = [...prev];
            next.splice(index, 1);
            return next;
        });
    };

    const handlePdfImport = async () => {
        if (pdfFiles.length === 0 && !pdfPrompt.trim()) return;
        setIsGenerating(true);
        const formData = new FormData();
        pdfFiles.forEach(f => {
            formData.append('files', f.file);
        });
        formData.append('prompt', pdfPrompt);
        formData.append('language', aiLanguage);
        formData.append('bloomLevels', JSON.stringify(bloomLevels));

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/exams/generate-questions`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            const generatedQuestions = res.data;
            setExamData(prev => {
                const newSections = [...prev.sections];
                const sIdx = 0;
                if (newSections.length === 0) {
                    newSections.push({
                        id: Date.now(),
                        title: t('imported_questions'),
                        description: '',
                        questions: generatedQuestions
                    } as Section);
                } else {
                    const targetSection = { ...newSections[sIdx] };
                    if (targetSection.questions.length === 1 && !targetSection.questions[0].question_text) {
                        targetSection.questions = generatedQuestions;
                    } else {
                        targetSection.questions = [...targetSection.questions, ...generatedQuestions];
                    }
                    newSections[sIdx] = targetSection;
                }
                return { ...prev, sections: newSections };
            });
            showToast.success('AI Generation Success', `${generatedQuestions.length} questions generated.`);
        } catch (err: any) {
            console.error('AI Generation Failure', err);
            const errMsg = err.response?.data?.error || 'Failed to generate questions';
            showToast.error('AI Generation Failure', errMsg);
        } finally {
            setIsGenerating(false);
            setPdfFiles([]);
            const fileInput = document.getElementById('global-pdf-import') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        }
    };

    const handleCsvImport = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/exams/import-questions`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            const importedQuestions = res.data;
            setExamData(prev => {
                const newSections = [...prev.sections];
                // Default to first section (index 0)
                const sIdx = 0;
                if (newSections.length === 0) {
                    newSections.push({
                        id: Date.now(),
                        title: t('imported_questions'),
                        description: '',
                        questions: importedQuestions
                    } as Section);
                } else {
                    const targetSection = { ...newSections[sIdx] };
                    if (targetSection.questions.length === 1 && !targetSection.questions[0].question_text) {
                        targetSection.questions = importedQuestions;
                    } else {
                        targetSection.questions = [...targetSection.questions, ...importedQuestions];
                    }
                    newSections[sIdx] = targetSection;
                }
                return { ...prev, sections: newSections };
            });
            showToast.success('Import Successful', `${importedQuestions.length} questions synchronized.`);
        } catch (err) {
            showToast.error('Import Failure', 'Failed to synchronize with blueprint. Check file schema (Question, Option1... Answer).');
        }
    };

    const handleBulkEmails = (val: string) => {
        setBulkEmails(val);
        // Allow full emails OR patterns like 48214*
        const emailList = val.split(/[,\n\s]+/).map(e => e.trim()).filter(e => e.includes('@') || e.endsWith('*'));
        setExamData(prev => ({ ...prev, permitted_emails: emailList }));
    };

    const convertToWildcards = () => {
        // Process line by line to preserve structure, then split by common delimiters
        const lines = bulkEmails.split('\n');
        const processedLines = lines.map(line => {
            // Split by comma or space but capture them to keep formatting
            const parts = line.split(/([,\s]+)/);
            return parts.map(part => {
                const trimmed = part.trim();
                // Skip if empty or matches delimiter
                if (!trimmed || /^[,\s]+$/.test(trimmed)) return part;

                // If not an email and doesn't already have wildcard, add it
                if (!trimmed.includes('@') && !trimmed.endsWith('*')) {
                    return trimmed + '*';
                }
                return part;
            }).join('');
        });
        const newVal = processedLines.join('\n');
        handleBulkEmails(newVal);
    };

    const addSection = () => {
        setExamData(prev => ({
            ...prev,
            sections: [
                ...prev.sections,
                { id: Date.now(), title: t('new_section'), description: '', questions: [] }
            ]
        }));
    };

    const deleteSection = (sIdx: number) => {
        setExamData(prev => {
            const newSections = [...prev.sections];
            newSections.splice(sIdx, 1);
            return { ...prev, sections: newSections };
        });
    };

    const updateSection = (sIdx: number, field: keyof Section, val: any) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) =>
                idx === sIdx ? { ...section, [field]: val } : section
            );
            return { ...prev, sections: newSections };
        });
    };

    const addQuestion = (sIdx: number) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                return {
                    ...section,
                    questions: [
                        ...section.questions,
                        {
                            type: 'multiple_choice' as const,
                            question_text: '',
                            options: [''],
                            correct_answers: [],
                            image_url: null,
                            is_required: false,
                            score: 1
                        }
                    ]
                };
            });
            return { ...prev, sections: newSections };
        });
    };

    const duplicateQuestion = (sIdx: number, qIdx: number) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = [...section.questions];
                const duplicated = { ...newQuestions[qIdx], image_url: null };
                newQuestions.splice(qIdx + 1, 0, duplicated);
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const deleteQuestion = (sIdx: number, qIdx: number) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = [...section.questions];
                newQuestions.splice(qIdx, 1);
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const updateQuestion = (sIdx: number, qIdx: number, field: keyof Question, val: any) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = section.questions.map((q, jdx) => {
                    if (jdx !== qIdx) return q;
                    const updatedQ = { ...q, [field]: val } as Question;
                    if (field === 'type') {
                        const typeVal = val as Question['type'];
                        if (typeVal === 'short_answer' || typeVal === 'paragraph') {
                            updatedQ.options = [];
                            updatedQ.correct_answers = [];
                        } else if (q.options.length === 0) {
                            updatedQ.options = [t('option') + ' 1'];
                            updatedQ.correct_answers = [];
                        }
                    }
                    return updatedQ;
                });
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const moveQuestion = (fromSIdx: number, qIdx: number, toSIdx: number) => {
        setExamData(prev => {
            const newSections = [...prev.sections];
            const [movedQ] = newSections[fromSIdx].questions.splice(qIdx, 1);
            // Re-clone the fromSection to be immutable
            newSections[fromSIdx] = { ...newSections[fromSIdx], questions: [...newSections[fromSIdx].questions] };
            // Copy the toSection and push the question
            newSections[toSIdx] = {
                ...newSections[toSIdx],
                questions: [...newSections[toSIdx].questions, movedQ]
            };
            return { ...prev, sections: newSections };
        });
    };

    const reorderQuestion = (sIdx: number, qIdx: number, direction: 'up' | 'down') => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const qs = [...section.questions];
                if (direction === 'up' && qIdx > 0) {
                    [qs[qIdx], qs[qIdx - 1]] = [qs[qIdx - 1], qs[qIdx]];
                } else if (direction === 'down' && qIdx < qs.length - 1) {
                    [qs[qIdx], qs[qIdx + 1]] = [qs[qIdx + 1], qs[qIdx]];
                }
                return { ...section, questions: qs };
            });
            return { ...prev, sections: newSections };
        });
    };

    const reorderSection = (sIdx: number, direction: 'up' | 'down') => {
        setExamData(prev => {
            const newSections = [...prev.sections];
            if (direction === 'up' && sIdx > 0) {
                [newSections[sIdx], newSections[sIdx - 1]] = [newSections[sIdx - 1], newSections[sIdx]];
            } else if (direction === 'down' && sIdx < newSections.length - 1) {
                [newSections[sIdx], newSections[sIdx + 1]] = [newSections[sIdx + 1], newSections[sIdx]];
            }
            return { ...prev, sections: newSections };
        });
    };

    const addOption = (sIdx: number, qIdx: number) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = section.questions.map((q, jdx) => {
                    if (jdx !== qIdx) return q;
                    return {
                        ...q,
                        options: [...q.options, '']
                    };
                });
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const updateOption = (sIdx: number, qIdx: number, oIdx: number, val: string) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = section.questions.map((q, jdx) => {
                    if (jdx !== qIdx) return q;
                    const newOptions = [...q.options];
                    newOptions[oIdx] = val;
                    return { ...q, options: newOptions };
                });
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const deleteOption = (sIdx: number, qIdx: number, oIdx: number) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = section.questions.map((q, jdx) => {
                    if (jdx !== qIdx) return q;
                    const deletedOption = q.options[oIdx];
                    const newOptions = q.options.filter((_, kdx) => kdx !== oIdx);
                    const newCorrect = q.correct_answers.filter(a => a !== deletedOption);
                    return { ...q, options: newOptions, correct_answers: newCorrect };
                });
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const toggleCorrect = (sIdx: number, qIdx: number, option: string) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = section.questions.map((q, jdx) => {
                    if (jdx !== qIdx) return q;
                    let newCorrect: string[] = [];
                    if (q.type === 'multiple_choice') {
                        if (q.correct_answers.includes(option)) {
                            newCorrect = [];
                        } else {
                            newCorrect = [option];
                        }
                    } else if (q.type === 'checkboxes') {
                        if (q.correct_answers.includes(option)) {
                            newCorrect = q.correct_answers.filter(a => a !== option);
                        } else {
                            newCorrect = [...q.correct_answers, option];
                        }
                    }
                    return { ...q, correct_answers: newCorrect };
                });
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const handleImageUpload = async (sIdx: number, qIdx: number, file: File) => {
        if (!file) return;

        setUploadingImage({ sIdx, qIdx });
        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/upload/image`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setExamData(prev => {
                const newSections = prev.sections.map((section, idx) => {
                    if (idx !== sIdx) return section;
                    const newQuestions = section.questions.map((q, jdx) => {
                        if (jdx !== qIdx) return q;
                        return { ...q, image_url: res.data.imageUrl };
                    });
                    return { ...section, questions: newQuestions };
                });
                return { ...prev, sections: newSections };
            });
        } catch (err) {
            console.error('Image upload failed', err);
            showToast.error(t('error'), t('failed_upload_image'));
        } finally {
            setUploadingImage(null);
        }
    };

    const removeImage = (sIdx: number, qIdx: number) => {
        setExamData(prev => {
            const newSections = prev.sections.map((section, idx) => {
                if (idx !== sIdx) return section;
                const newQuestions = section.questions.map((q, jdx) => {
                    if (jdx !== qIdx) return q;
                    return { ...q, image_url: null };
                });
                return { ...section, questions: newQuestions };
            });
            return { ...prev, sections: newSections };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            if (isEdit) {
                await axios.put(`${API_BASE_URL}/api/exams/${examId}`, examData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_BASE_URL}/api/exams`, examData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            showToast.success(t('success'), isEdit ? t('exam_updated_success') : t('exam_created_success'));
            navigate('/');
        } catch (err) {
            console.error('Error:', err);
            showToast.error(t('error'), isEdit ? t('error_updating_exam') : t('error_creating_exam'));
        }
    };

    return (
        <div className="min-h-screen bg-surface/30">
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
                            {isEdit ? t('edit_exam') : t('new_exam')}
                        </h2>
                    </div>
                    <button
                        type="submit"
                        form="exam-form"
                        className="btn-primary-minimal text-[10px] md:text-xs h-8 md:h-9 px-3 md:px-6 bg-primary flex-shrink-0"
                    >
                        <FontAwesomeIcon icon={faFloppyDisk} className="mr-1 md:mr-2" />
                        {isEdit ? t('update_exam_blueprint') : t('deploy_exam_blueprint')}
                    </button>
                </div>
            </header>

            <div className="max-w-5xl mx-auto pt-20 md:pt-24 pb-16 px-3 md:px-6">
                <form id="exam-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Exam Header Card */}
                    <div className="card-minimal border-t-4 border-t-primary !p-4 md:!p-6">
                        <input
                            type="text"
                            value={examData.title}
                            onChange={(e) => setExamData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full text-xl md:text-2xl font-black bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground mb-1 tabular-nums"
                            placeholder={t('untitled_exam')}
                            style={{ fontSize: '16px' }}
                            required
                        />
                        <input
                            type="text"
                            value={examData.course}
                            onChange={(e) => setExamData(prev => ({ ...prev, course: e.target.value }))}
                            className="w-full text-sm font-bold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground uppercase tracking-wider"
                            placeholder={t('course_description')}
                            style={{ fontSize: '16px' }}

                        />
                    </div>

                    {/* Settings Card */}
                    <div className="card-minimal space-y-4 !p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                                    {t('duration_minutes')}
                                </label>
                                <input
                                    type="number"
                                    value={examData.duration_minutes}
                                    onChange={(e) => setExamData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                                    className="input-minimal !py-2"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {t('start_configuration')}
                                </label>
                                <div className="flex bg-surface p-1 rounded-xl border border-border">
                                    <button
                                        type="button"
                                        onClick={() => setExamData(prev => ({ ...prev, start_method: 'auto' }))}
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${examData.start_method === 'auto' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                                    >
                                        {t('scheduled')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExamData(prev => ({ ...prev, start_method: 'manual', start_time: '' }))}
                                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${examData.start_method === 'manual' ? 'bg-primary text-white' : 'text-muted-foreground'}`}
                                    >
                                        {t('manual')}
                                    </button>
                                </div>

                                <input
                                    type="datetime-local"
                                    className="input-minimal !py-2"
                                    value={examData.start_method === 'auto' ? examData.start_time : ''}
                                    disabled={examData.start_method === 'manual'}
                                    onChange={(e) => setExamData(prev => ({ ...prev, start_time: e.target.value }))}
                                    required={examData.start_method === 'auto'}
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                                {t('collection_group')}
                            </label>
                            <CustomSelect
                                options={[
                                    { id: '', label: t('no_collection') },
                                    ...groups.map(g => ({ id: g.id, label: g.name }))
                                ]}
                                value={examData.group_id || ''}
                                onChange={(val) => setExamData(prev => ({ ...prev, group_id: val ? parseInt(val) : null }))}
                                icon={faTableCellsLarge}
                                placeholder={t('no_collection')}
                            />
                            <p className="text-[9px] text-muted-foreground mt-1 font-medium uppercase tracking-wider">{t('collection_help')}</p>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
                            <div>
                                <p className="text-xs font-semibold">{t('public_exam')}</p>
                                <p className="text-[10px] text-muted-foreground">{t('public_exam_help')}</p>
                            </div>
                            <input
                                type="checkbox"
                                className="w-4 h-4 accent-primary cursor-pointer"
                                checked={examData.is_public}
                                onChange={(e) => setExamData(prev => ({ ...prev, is_public: e.target.checked, show_in_dashboard: e.target.checked ? prev.show_in_dashboard : false }))}
                            />
                        </div>

                        {examData.is_public && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="pl-4 border-l-2 border-primary/20"
                            >
                                <div className="flex items-center justify-between p-3 bg-surface rounded-xl">
                                    <div>
                                        <p className="text-xs font-semibold">{t('show_in_dashboard')}</p>
                                        <p className="text-[10px] text-muted-foreground">{t('show_in_dashboard_help')}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 accent-primary cursor-pointer"
                                        checked={examData.show_in_dashboard}
                                        onChange={(e) => setExamData(prev => ({ ...prev, show_in_dashboard: e.target.checked }))}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {!examData.is_public && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3 pt-2 pb-2 pl-4 border-l-2 border-primary/20"
                            >
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold  tracking-widest text-muted-foreground">
                                        <FontAwesomeIcon icon={faEnvelope} className="inline mr-2 text-sm" />
                                        {t('permitted_emails')}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={convertToWildcards}
                                        className="text-[10px] font-black  tracking-widest bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-md hover:bg-orange-500/20 transition-all border border-orange-500/20"
                                    >
                                        <FontAwesomeIcon icon={faAsterisk} className="mr-1.5" />
                                        {t('apply_wildcards')}
                                    </button>
                                </div>
                                <textarea
                                    className="input-minimal h-32 resize-none overflow-hidden"
                                    placeholder={t('paste_emails')}
                                    value={bulkEmails}
                                    onChange={(e) => handleBulkEmails(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {examData.permitted_emails.length} {t('valid_emails_detected')}
                                </p>
                            </motion.div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
                                <div>
                                    <p className="text-xs font-semibold">{t('shuffle_questions')}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t('shuffle_questions_help')}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-primary cursor-pointer"
                                    checked={examData.shuffle_questions}
                                    onChange={(e) => setExamData(prev => ({ ...prev, shuffle_questions: e.target.checked }))}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
                                <div>
                                    <p className="text-xs font-semibold">{t('shuffle_options')}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t('shuffle_options_help')}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-primary cursor-pointer"
                                    checked={examData.shuffle_options}
                                    onChange={(e) => setExamData(prev => ({ ...prev, shuffle_options: e.target.checked }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-primary/20 bg-primary/5">
                                <div>
                                    <p className="text-xs font-semibold">{t('instant_feedback')}</p>
                                    <p className="text-[10px] text-muted-foreground">{t('instant_feedback_help')}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-primary cursor-pointer"
                                    checked={examData.show_score}
                                    onChange={(e) => setExamData(prev => ({ ...prev, show_score: e.target.checked }))}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
                                <div>
                                    <p className="text-xs font-semibold">{t('late_submissions')}</p>
                                    <p className="text-[10px] text-muted-foreground">{t('late_submissions_help')}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-primary cursor-pointer"
                                    checked={examData.allow_late_submission}
                                    onChange={(e) => setExamData(prev => ({ ...prev, allow_late_submission: e.target.checked }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                    <FontAwesomeIcon icon={faVideo} className="text-sm" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold">{t('live_monitoring')}</p>
                                    <p className="text-[10px] text-muted-foreground">{t('live_monitoring_help')}</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                className="w-5 h-5 accent-red-600 cursor-pointer"
                                checked={examData.enable_video_proctoring}
                                onChange={(e) => setExamData(prev => ({ ...prev, enable_video_proctoring: e.target.checked }))}
                            />
                        </div>

                        <div className="pt-6 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowAppearance(!showAppearance)}
                                className="w-full flex items-center justify-between group"
                            >
                                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors cursor-pointer mb-0">
                                    <FontAwesomeIcon icon={faPalette} className="mr-2" />
                                    {t('theme_configuration')}
                                </label>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${showAppearance ? 'bg-primary text-white rotate-180' : 'bg-surface text-muted-foreground'}`}>
                                    <FontAwesomeIcon icon={faChevronDown} />
                                </div>
                            </button>

                            <AnimatePresence>
                                {showAppearance && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pt-6 space-y-6">
                                            {/* Presets Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{t('presets')}</span>
                                                    <div className="h-px flex-1 ml-4 bg-border"></div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                    {[
                                                        { id: 'ocean', name: 'Ocean Blue', emoji: '🌊', primary: '#0D47A1', bg: '#f8faff', text: '#0D47A1' },
                                                        { id: 'violet', name: 'Royal Violet', emoji: '💜', primary: '#311B92', bg: '#f9f8ff', text: '#311B92' },
                                                        { id: 'emerald', name: 'Forest Green', emoji: '🌿', primary: '#1B5E20', bg: '#f8fdf9', text: '#1B5E20' },
                                                        { id: 'rose', name: 'Rose Gold', emoji: '🌸', primary: '#B71C1C', bg: '#fef8f8', text: '#B71C1C' },
                                                        { id: 'amber', name: 'Amber Orange', emoji: '🔥', primary: '#E65100', bg: '#fffaf8', text: '#E65100' },
                                                        { id: 'yellow', name: 'Sunlight Yellow', emoji: '☀️', primary: '#F57F17', bg: '#fffdf8', text: '#451a03' },
                                                        { id: 'teal', name: 'Teal Breeze', emoji: '🩵', primary: '#1D9391', bg: '#f8fdfd', text: '#004d4d' },
                                                        { id: 'slate', name: 'Slate Minimal', emoji: '🪨', primary: '#263238', bg: '#f8fafc', text: '#263238' },
                                                        { id: 'carbon', name: 'Dark Gray / Carbon', emoji: '🖤', primary: '#212121', bg: '#f5f5f5', text: '#212121' },
                                                        { id: 'midnight', name: 'theme_midnight', emoji: '🌑', primary: '#818cf8', bg: '#0f172a', text: '#f8fafc' },
                                                    ].map((preset) => (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => setExamData({
                                                                ...examData,
                                                                theme_config: { primary_color: preset.primary, background_color: preset.bg, text_color: preset.text }
                                                            })}
                                                            className={`flex flex-col gap-3 p-3 rounded-2xl border text-left transition-all duration-300 group relative overflow-hidden ${examData.theme_config?.background_color === preset.bg && examData.theme_config?.primary_color === preset.primary ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-white dark:bg-card hover:border-primary/40'}`}
                                                        >
                                                            <div className="flex flex-col gap-1.5 h-12 rounded-xl overflow-hidden border border-border/50 relative">
                                                                <div className="absolute inset-0" style={{ backgroundColor: preset.bg }}></div>
                                                                <div className="absolute top-2 left-2 right-2 h-1.5 rounded-full opacity-20" style={{ backgroundColor: preset.text }}></div>
                                                                <div className="absolute top-5 left-2 w-1/2 h-1.5 rounded-full opacity-10" style={{ backgroundColor: preset.text }}></div>
                                                                <div className="absolute bottom-0 inset-x-0 h-1" style={{ backgroundColor: preset.primary }}></div>
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[10px] font-bold tracking-tight truncate leading-tight">
                                                                    {preset.emoji} {preset.name.includes('theme_') ? t(preset.name as any) : preset.name}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.primary }}></div>
                                                                    <div className="w-2 h-2 rounded-full opacity-30" style={{ backgroundColor: preset.text }}></div>
                                                                </div>
                                                            </div>
                                                            {examData.theme_config?.background_color === preset.bg && examData.theme_config?.primary_color === preset.primary && (
                                                                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center scale-90">
                                                                    <FontAwesomeIcon icon={faCircleCheck} className="text-[8px]" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Custom Colors Section */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface/50 p-6 rounded-2xl border border-border/50 items-start">
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Custom Palette</span>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {[
                                                            { label: t('primary_color'), key: 'primary_color' },
                                                            { label: t('background_color'), key: 'background_color' },
                                                            { label: t('text_color'), key: 'text_color' },
                                                        ].map((item) => (
                                                            <div key={item.key} className="flex items-center justify-between p-3 bg-white dark:bg-card border border-border rounded-xl shadow-sm hover:border-primary/30 transition-all">
                                                                <label className="text-xs font-bold text-muted-foreground">{item.label}</label>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="relative">
                                                                        <input
                                                                            type="color"
                                                                            value={(examData.theme_config as any)?.[item.key]}
                                                                            onChange={(e) => setExamData({
                                                                                ...examData,
                                                                                theme_config: { ...examData.theme_config!, [item.key]: e.target.value }
                                                                            })}
                                                                            className="w-12 h-10 p-0 rounded-lg cursor-pointer border-none bg-transparent appearance-none"
                                                                        />
                                                                        <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: (examData.theme_config as any)?.[item.key] }}></div>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={(examData.theme_config as any)?.[item.key]}
                                                                        onChange={(e) => setExamData({
                                                                            ...examData,
                                                                            theme_config: { ...examData.theme_config!, [item.key]: e.target.value }
                                                                        })}
                                                                        className="w-20 bg-transparent border-none text-[10px] font-mono text-center focus:ring-0 uppercase opacity-60 hover:opacity-100 transition-opacity outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Page Preview Widget */}
                                                <div className="space-y-3">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-6">Live Simulation</span>
                                                    <div
                                                        className="relative h-72 rounded-[2rem] p-7 border border-black/5 overflow-hidden transition-all duration-700 ease-in-out"
                                                        style={{ backgroundColor: examData.theme_config?.background_color }}
                                                    >
                                                        {/* Minimal Header */}
                                                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-black/5">
                                                            <div className="flex gap-2.5">
                                                                <div className="w-10 h-2.5 rounded-full opacity-30" style={{ backgroundColor: examData.theme_config?.text_color }}></div>
                                                                <div className="w-16 h-2.5 rounded-full opacity-10" style={{ backgroundColor: examData.theme_config?.text_color }}></div>
                                                            </div>
                                                            <div className="w-12 h-5 rounded-full" style={{ backgroundColor: examData.theme_config?.primary_color }}></div>
                                                        </div>

                                                        {/* Progress Bar Mock */}
                                                        <div className="absolute top-[84px] left-0 w-full h-[2px] bg-black/[0.03]">
                                                            <div className="h-full w-2/3 transition-all duration-1000 ease-out" style={{ backgroundColor: examData.theme_config?.primary_color }}></div>
                                                        </div>

                                                        <div className="space-y-5 pt-6">
                                                            <div className="h-3.5 w-3/4 rounded-full opacity-30 mb-8" style={{ backgroundColor: examData.theme_config?.text_color }}></div>

                                                            {/* Option Mocks */}
                                                            <div className="grid grid-cols-1 gap-3">
                                                                <div className="h-12 rounded-2xl border-2 flex items-center px-4 gap-4 transition-all duration-500" style={{ borderColor: `${examData.theme_config?.text_color}10`, backgroundColor: `${examData.theme_config?.text_color}05` }}>
                                                                    <div className="w-5 h-5 rounded-full opacity-10" style={{ backgroundColor: examData.theme_config?.text_color }}></div>
                                                                    <div className="w-1/2 h-2 rounded-full opacity-15" style={{ backgroundColor: examData.theme_config?.text_color }}></div>
                                                                </div>
                                                                <div className="h-12 rounded-2xl flex items-center px-4 gap-4 border-2 border-transparent transition-all duration-500" style={{ backgroundColor: examData.theme_config?.primary_color }}>
                                                                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: examData.theme_config?.primary_color }}></div>
                                                                    </div>
                                                                    <div className="w-1/2 h-2 rounded-full bg-white/30"></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Mock Watermark */}
                                                        <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/5 rounded-[2rem]"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Import Section - Redesigned */}
                        <div className="pt-8 border-t border-border">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                                {t('bulk_import_questions')}
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                {/* AI Generator Column */}
                                <div className="p-5 bg-primary/5 hover:bg-primary/10 border-2 border-primary/20 hover:border-primary/40 rounded-2xl space-y-4 transition-all duration-300">
                                    <div className="flex items-center gap-3 text-primary">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xl" />
                                        </div>
                                        <h3 className="font-black uppercase tracking-wider text-sm">AI Generate</h3>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground mr-2">Type a prompt or upload PDF materials to generate questions automatically with AI.</p>
                                        <div className="flex bg-surface p-0.5 rounded-lg border border-border flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setAiLanguage('th')}
                                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aiLanguage === 'th' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                                            >
                                                TH
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAiLanguage('en')}
                                                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${aiLanguage === 'en' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                                            >
                                                EN
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bloom's Taxonomy Selection */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t('bloom_taxonomy_levels') || "Bloom's Taxonomy Levels"}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'remember', label: 'Remember' },
                                                { id: 'understand', label: 'Understand' },
                                                { id: 'apply', label: 'Apply' },
                                                { id: 'analyze', label: 'Analyze' },
                                                { id: 'evaluate', label: 'Evaluate' },
                                                { id: 'create', label: 'Create' },
                                            ].map((level) => (
                                                <button
                                                    key={level.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (bloomLevels.includes(level.id)) {
                                                            setBloomLevels(bloomLevels.filter(l => l !== level.id));
                                                        } else {
                                                            setBloomLevels([...bloomLevels, level.id]);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 border ${bloomLevels.includes(level.id)
                                                        ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                                                        : 'bg-surface border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02]'
                                                        } active:scale-95`}
                                                >
                                                    {level.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea
                                        placeholder={aiLanguage === 'en' ? "Enter instructions (e.g. Generate 5 multiple-choice questions about Chapter 3...)" : "ระบุคำสั่ง เช่น สร้างคำถาม 5 ข้อจากเนื้อหาต่อไปนี้/เอกสารที่แนบมาในบทที่ 3"}
                                        className="w-full text-sm font-medium bg-surface border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 p-3 rounded-xl transition-all placeholder:text-muted-foreground/50 resize-none min-h-[80px] overflow-hidden"
                                        value={pdfPrompt}
                                        onChange={(e) => setPdfPrompt(e.target.value)}
                                        disabled={isGenerating}
                                    />

                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            multiple
                                            className="hidden"
                                            id="global-pdf-import"
                                            disabled={isGenerating || isProcessingPdf}
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    handlePdfSelection(Array.from(e.target.files));
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="global-pdf-import"
                                            className={`flex items-center justify-center gap-2 w-full py-2.5 bg-surface border-2 border-dashed border-border rounded-xl text-primary font-bold text-xs transition-all duration-300 ${isGenerating || isProcessingPdf ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5 cursor-pointer'}`}
                                        >
                                            <FontAwesomeIcon icon={isProcessingPdf ? faSpinner : faFilePdf} className={isProcessingPdf ? 'animate-spin' : ''} />
                                            {isProcessingPdf ? 'Processing PDFs...' : 'Attach PDF Files'}
                                        </label>
                                    </div>

                                    {/* Thumbnails area */}
                                    {pdfFiles.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                                            {pdfFiles.map((fileObj, i) => (
                                                <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-surface aspect-[3/4] flex items-center justify-center">
                                                    {fileObj.thumbnailUrl ? (
                                                        <img src={fileObj.thumbnailUrl} alt={fileObj.file.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FontAwesomeIcon icon={faFilePdf} className="text-3xl text-muted-foreground/30" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button type="button" onClick={() => removePdfFile(i)} className="w-8 h-8 bg-red-500 rounded-full text-white flex items-center justify-center hover:scale-110 transition-transform">
                                                            <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                        </button>
                                                    </div>
                                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-md p-1">
                                                        <p className="text-[9px] text-white font-bold truncate text-center">{fileObj.file.name}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handlePdfImport}
                                        disabled={isGenerating || isProcessingPdf || (!pdfPrompt && pdfFiles.length === 0)}
                                        className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-white transition-all duration-300 flex items-center justify-center gap-2 text-xs 
                                        ${isGenerating || isProcessingPdf || (!pdfPrompt && pdfFiles.length === 0) ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20'}`}
                                    >
                                        <FontAwesomeIcon icon={isGenerating ? faSpinner : faWandMagicSparkles} className={`${isGenerating ? 'animate-spin' : ''}`} />
                                        {isGenerating ? 'Generating...' : 'Generate Questions'}
                                    </button>
                                </div>

                                {/* Standard Import Column */}
                                <div className="p-5 bg-primary/5 hover:bg-primary/10 border-2 border-primary/20 hover:border-primary/40 rounded-2xl space-y-4 flex flex-col transition-all duration-300">
                                    <div className="flex items-center gap-3 text-primary">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faTableCellsLarge} className="text-xl" />
                                        </div>
                                        <h3 className="font-black uppercase tracking-wider text-sm">Standard Import</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex-1">Upload an Excel or CSV file matching our template structure to import questions instantly.</p>

                                    <div className="space-y-3">
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".csv, .xlsx, .xls"
                                                className="hidden"
                                                id="global-csv-import"
                                                onChange={(e) => e.target.files && handleCsvImport(e.target.files[0])}
                                            />
                                            <label
                                                htmlFor="global-csv-import"
                                                className="flex flex-col items-center justify-center gap-2 w-full py-8 bg-surface border-2 border-dashed border-border rounded-xl text-primary font-bold transition-all duration-300 hover:border-primary hover:bg-primary/5 cursor-pointer"
                                            >
                                                <FontAwesomeIcon icon={faFileCsv} className="text-3xl" />
                                                <span className="text-sm">Upload CSV / Excel</span>
                                            </label>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const bom = '\uFEFF';
                                                const csvContent = bom +
                                                    'Question,Option1,Option2,Option3,Option4,Option5,Answer1,Answer2\r\n' +
                                                    '"สิ่งมีชีวิตใช้กระบวนการใดในการเปลี่ยนคาร์บอนไดออกไซด์และน้ำเป็นอาหาร?","การหายใจ","การสังเคราะห์ด้วยแสง","การหมัก","การย่อยอาหาร",,"การสังเคราะห์ด้วยแสง",\r\n' +
                                                    '"2 + 2 เท่ากับเท่าไหร่?",,,,,,4,\r\n' +
                                                    '"ข้อใดเป็นสัตว์เลี้ยงลูกด้วยนม?","แมว","งู","ปลาวาฬ","นกแก้ว",,"แมว","ปลาวาฬ"\r\n';
                                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'sample_exam_import.csv';
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-surface border border-border rounded-xl text-primary font-bold text-xs hover:border-primary hover:bg-primary/5 transition-all duration-300 uppercase tracking-wider"
                                        >
                                            <FontAwesomeIcon icon={faDownload} />
                                            Download Template
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>

                    {/* Sections and Questions */}
                    <div className="space-y-12">
                        {examData.sections.map((section, sIdx) => (
                            <div key={section.id} className="space-y-4 md:space-y-6">
                                {/* Section Header */}
                                <div className="card-minimal border-l-4 border-l-primary/50 relative group !p-3 md:!p-6">
                                    {/* Section reorder — inline on mobile, absolute on desktop */}
                                    <div className="flex md:hidden items-center gap-1 mb-3">
                                        <button
                                            type="button"
                                            onClick={() => reorderSection(sIdx, 'up')}
                                            disabled={sIdx === 0}
                                            className="p-2 text-muted-foreground hover:text-primary bg-surface rounded-lg border border-border disabled:opacity-30"
                                            title={t('move_section_up')}
                                        >
                                            <FontAwesomeIcon icon={faChevronUp} className="text-sm" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => reorderSection(sIdx, 'down')}
                                            disabled={sIdx === examData.sections.length - 1}
                                            className="p-2 text-muted-foreground hover:text-primary bg-surface rounded-lg border border-border disabled:opacity-30"
                                            title={t('move_section_down')}
                                        >
                                            <FontAwesomeIcon icon={faChevronDown} className="text-sm" />
                                        </button>
                                        <div className="flex-1"></div>
                                        <button
                                            type="button"
                                            onClick={() => deleteSection(sIdx)}
                                            className="p-2 text-muted-foreground hover:text-red-600 bg-surface rounded-lg border border-border disabled:opacity-30"
                                            title={t('delete_section')}
                                            disabled={examData.sections.length === 1}
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="text-sm" />
                                        </button>
                                    </div>
                                    {/* Desktop section reorder — absolute sidebar */}
                                    <div className="hidden md:flex absolute -left-12 top-1/2 -translate-y-1/2 flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => reorderSection(sIdx, 'up')}
                                            disabled={sIdx === 0}
                                            className="p-2 text-muted-foreground hover:text-primary bg-white dark:bg-card rounded-full border border-border disabled:opacity-30"
                                            title={t('move_section_up')}
                                        >
                                            <FontAwesomeIcon icon={faChevronUp} className="text-base" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => reorderSection(sIdx, 'down')}
                                            disabled={sIdx === examData.sections.length - 1}
                                            className="p-2 text-muted-foreground hover:text-primary bg-white dark:bg-card rounded-full border border-border disabled:opacity-30"
                                            title={t('move_section_down')}
                                        >
                                            <FontAwesomeIcon icon={faChevronDown} className="text-base" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteSection(sIdx)}
                                            className="p-2 text-muted-foreground hover:text-red-600 bg-white dark:bg-card rounded-full border border-border"
                                            title={t('delete_section')}
                                            disabled={examData.sections.length === 1}
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="text-base" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
                                        className="w-full text-lg md:text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground mb-2"
                                        placeholder={t('section_title')}
                                        style={{ fontSize: '16px' }}
                                    />
                                    <textarea
                                        value={section.description}
                                        onChange={(e) => updateSection(sIdx, 'description', e.target.value)}
                                        className="w-full text-sm text-muted-foreground bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground resize-none overflow-hidden"
                                        placeholder={t('section_description_optional')}
                                        rows={1}
                                    />
                                </div>

                                <AnimatePresence mode="popLayout">
                                    {section.questions.map((q, qIdx) => (
                                        <motion.div
                                            key={`${section.id}-${qIdx}`}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="relative group/q space-y-4 md:space-y-6"
                                        >
                                            {/* Question Controls — inline on mobile, absolute on desktop like sections */}
                                            <div className="flex md:hidden items-center gap-1 mb-2 px-1">
                                                <div className="text-[10px] font-bold text-muted-foreground/60 tabular-nums bg-surface px-2 py-1 rounded-md border border-border">
                                                    {examData.sections.slice(0, sIdx).reduce((acc, s) => acc + s.questions.length, 0) + qIdx + 1} / {examData.sections.reduce((acc, s) => acc + s.questions.length, 0)}
                                                </div>
                                                <div className="flex-1"></div>
                                                <button
                                                    type="button"
                                                    onClick={() => reorderQuestion(sIdx, qIdx, 'up')}
                                                    disabled={qIdx === 0}
                                                    className="p-1.5 text-muted-foreground hover:text-primary bg-surface rounded-lg border border-border disabled:opacity-30"
                                                >
                                                    <FontAwesomeIcon icon={faChevronUp} className="text-sm" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => reorderQuestion(sIdx, qIdx, 'down')}
                                                    disabled={qIdx === section.questions.length - 1}
                                                    className="p-1.5 text-muted-foreground hover:text-primary bg-surface rounded-lg border border-border disabled:opacity-30"
                                                >
                                                    <FontAwesomeIcon icon={faChevronDown} className="text-sm" />
                                                </button>
                                            </div>

                                            {/* Desktop absolute sidebar */}
                                            <div className="hidden md:flex absolute -left-12 top-0 flex-col gap-2 opacity-0 group-hover/q:opacity-100 transition-opacity">
                                                <div className="h-8 flex items-center justify-center">
                                                    <div className="text-[10px] font-bold text-muted-foreground/40 tabular-nums rotate-0 md:-rotate-90 whitespace-nowrap">
                                                        {examData.sections.slice(0, sIdx).reduce((acc, s) => acc + s.questions.length, 0) + qIdx + 1} / {examData.sections.reduce((acc, s) => acc + s.questions.length, 0)}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => reorderQuestion(sIdx, qIdx, 'up')}
                                                    disabled={qIdx === 0}
                                                    className="p-2 text-muted-foreground hover:text-primary bg-white dark:bg-card rounded-full border border-border disabled:opacity-30"
                                                >
                                                    <FontAwesomeIcon icon={faChevronUp} className="text-xs" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => reorderQuestion(sIdx, qIdx, 'down')}
                                                    disabled={qIdx === section.questions.length - 1}
                                                    className="p-2 text-muted-foreground hover:text-primary bg-white dark:bg-card rounded-full border border-border disabled:opacity-30"
                                                >
                                                    <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                                                </button>
                                            </div>

                                            <div className="card-minimal space-y-4 md:space-y-6 transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary/30 !p-3 md:!p-6">
                                                {/* Question Content */}
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
                                                    <textarea
                                                        rows={2}
                                                        value={q.question_text}
                                                        onChange={(e) => updateQuestion(sIdx, qIdx, 'question_text', e.target.value)}
                                                        className="flex-1 text-base md:text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground min-w-0 resize-none"
                                                        placeholder={t('type_question')}
                                                        style={{ fontSize: '16px' }}
                                                        required
                                                    />
                                                    <CustomSelect
                                                        options={questionTypes}
                                                        value={q.type}
                                                        onChange={(val) => updateQuestion(sIdx, qIdx, 'type', val)}
                                                        className="md:w-56"
                                                    />
                                                </div>

                                                {/* Image Upload */}
                                                {q.image_url ? (
                                                    <div className="relative group/img">
                                                        <img
                                                            src={`${import.meta.env.BASE_URL}${q.image_url.startsWith('/') ? q.image_url.slice(1) : q.image_url}`}
                                                            alt="Question"
                                                            className="max-w-full h-auto rounded-xl border border-border"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeImage(sIdx, qIdx)}
                                                            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-600"
                                                        >
                                                            <FontAwesomeIcon icon={faXmark} className="text-base" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => e.target.files && handleImageUpload(sIdx, qIdx, e.target.files[0])}
                                                            className="hidden"
                                                            id={`image-upload-${sIdx}-${qIdx}`}
                                                            disabled={uploadingImage?.sIdx === sIdx && uploadingImage?.qIdx === qIdx}
                                                        />
                                                        <label
                                                            htmlFor={`image-upload-${sIdx}-${qIdx}`}
                                                            className="flex items-center gap-2 px-4 py-3 bg-surface border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-surface/80 transition-all duration-300"
                                                        >
                                                            <FontAwesomeIcon icon={faImage} className="text-xl text-muted-foreground" />
                                                            <span className="text-sm font-semibold text-muted-foreground">
                                                                {uploadingImage?.sIdx === sIdx && uploadingImage?.qIdx === qIdx ? t('uploading') : t('add_image')}
                                                            </span>
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Options for Multiple Choice / Checkboxes */}
                                                {q.type !== 'short_answer' && q.type !== 'paragraph' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                                        {q.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className="flex items-center gap-2 md:gap-3 group/opt">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleCorrect(sIdx, qIdx, opt)}
                                                                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-300 ${q.correct_answers.includes(opt)
                                                                        ? 'bg-primary border-primary'
                                                                        : 'border-border hover:border-primary'
                                                                        } ${q.type === 'checkboxes' ? 'rounded-md' : ''}`}
                                                                >
                                                                    {q.correct_answers.includes(opt) && (
                                                                        <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                                <input
                                                                    type="text"
                                                                    value={opt}
                                                                    onChange={(e) => updateOption(sIdx, qIdx, oIdx, e.target.value)}
                                                                    className="flex-1 min-w-0 px-3 md:px-4 py-2 bg-surface border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300"
                                                                    placeholder={`${t('option')} ${oIdx + 1}`}
                                                                    style={{ fontSize: '16px' }}
                                                                    required
                                                                />
                                                                {q.options.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deleteOption(sIdx, qIdx, oIdx)}
                                                                        className="p-2 text-muted-foreground hover:text-red-600 md:opacity-0 md:group-hover/opt:opacity-100 transition-all duration-300 flex-shrink-0"
                                                                    >
                                                                        <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => addOption(sIdx, qIdx)}
                                                            className="col-span-1 md:col-span-2 flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <FontAwesomeIcon icon={faPlus} className="text-base" /> {t('add_option')}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Short Answer Correct Answer Input */}
                                                {(q.type === 'short_answer' || q.type === 'paragraph') && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                                                            <FontAwesomeIcon icon={faListCheck} />
                                                            {t('correct_answer')}
                                                        </div>
                                                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                                                            {q.type === 'short_answer' ? (
                                                                <input
                                                                    type="text"
                                                                    value={q.correct_answers[0] || ''}
                                                                    onChange={(e) => updateQuestion(sIdx, qIdx, 'correct_answers', [e.target.value])}
                                                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-primary font-semibold placeholder:text-primary/30"
                                                                    placeholder={t('correct_answer')}
                                                                />
                                                            ) : (
                                                                <textarea
                                                                    value={q.correct_answers[0] || ''}
                                                                    onChange={(e) => updateQuestion(sIdx, qIdx, 'correct_answers', [e.target.value])}
                                                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-primary font-semibold placeholder:text-primary/30 resize-none min-h-[100px] overflow-hidden"
                                                                    placeholder={t('correct_answer')}
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground italic uppercase tracking-wider px-1">
                                                            {t('short_answer_placeholder')}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Question Actions — wraps on mobile */}
                                                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                                                    <div className="flex flex-wrap items-center gap-3 md:gap-6">
                                                        {/* Required Toggle */}
                                                        <label className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                                                            <div className="relative">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={q.is_required}
                                                                    onChange={(e) => updateQuestion(sIdx, qIdx, 'is_required', e.target.checked)}
                                                                />
                                                                <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${q.is_required ? 'bg-primary' : 'bg-muted'}`}></div>
                                                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${q.is_required ? 'translate-x-5' : ''}`}></div>
                                                            </div>
                                                            <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${q.is_required ? 'text-primary' : 'text-muted-foreground'}`}>{t('required')}</span>
                                                        </label>

                                                        {/* Score Input */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('score')}</span>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={100}
                                                                value={q.score}
                                                                onChange={(e) => updateQuestion(sIdx, qIdx, 'score', Math.max(1, parseInt(e.target.value) || 1))}
                                                                className="w-16 h-8 text-center text-sm font-bold bg-surface border border-border rounded-lg focus:border-primary focus:outline-none transition-colors tabular-nums"
                                                            />
                                                        </div>

                                                        {/* Move to Section */}
                                                        {examData.sections.length > 1 && (
                                                            <CustomSelect
                                                                options={examData.sections.map((s, idx) => ({ id: idx, label: s.title || `Section ${idx + 1}` }))}
                                                                value={sIdx}
                                                                onChange={(val) => moveQuestion(sIdx, qIdx, val)}
                                                                className="min-w-[120px]"
                                                                placeholder={t('section')}
                                                                position="top"
                                                            />
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => duplicateQuestion(sIdx, qIdx)}
                                                            className="p-2.5 md:p-2 text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-all duration-300"
                                                            title={t('duplicate')}
                                                        >
                                                            <FontAwesomeIcon icon={faCopy} className="text-base md:text-lg" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => deleteQuestion(sIdx, qIdx)}
                                                            className="p-2.5 md:p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all duration-300"
                                                            title={t('delete')}
                                                            disabled={section.questions.length === 1 && examData.sections.length === 1}
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} className="text-base md:text-lg" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {/* Section Action */}
                                <div className="grid grid-cols-1 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => addQuestion(sIdx)}
                                        className="py-4 border-2 border-dashed border-border rounded-2xl text-muted-foreground hover:border-primary hover:text-primary hover:bg-surface/50 transition-all duration-300 flex items-center justify-center gap-2 font-semibold text-sm"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="text-lg" /> {t('add_question_to')} {section.title || `Section ${sIdx + 1}`}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4 pt-8">
                        {/* Add Section Button */}
                        <button
                            type="button"
                            onClick={addSection}
                            className="w-full py-4 bg-primary/5 border-2 border-primary border-dashed rounded-2xl text-primary hover:bg-primary/10 transition-all duration-300 flex items-center justify-center gap-2 font-bold"
                        >
                            <FontAwesomeIcon icon={faTableCellsLarge} className="text-xl" /> {t('add_new_section')}
                        </button>

                        {/* Submit Button */}
                        <div className="sticky bottom-3 md:bottom-6 flex gap-4">
                            <button
                                type="submit"
                                className="flex-1 btn-primary-minimal h-12 md:h-14 text-sm md:text-base relative overflow-hidden group/submit"
                            >
                                <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover/submit:translate-y-0 transition-transform duration-300"></div>
                                <div className="relative flex items-center justify-center">
                                    <FontAwesomeIcon icon={faFloppyDisk} className="mr-2 text-lg md:text-xl" />
                                    {isEdit ? t('update_exam_blueprint') : t('deploy_exam_blueprint')}
                                </div>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateExam;
