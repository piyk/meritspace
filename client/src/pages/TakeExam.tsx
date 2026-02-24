import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import showToast from '../utils/swal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faTriangleExclamation, faCircleCheck, faRobot, faPalette, faCheck, faMoon, faSun, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useLanguage } from '../context/LanguageContext';
import { useAppearance } from '../context/AppearanceContext';
import { useTheme } from '../context/ThemeContext';

import { API_BASE_URL, SOCKET_PATH } from '../config';

const socket = io('', {
    path: SOCKET_PATH,
    transports: ['websocket'],
    upgrade: false,
    secure: true
});

interface Question {
    id: number;
    type: 'short_answer' | 'paragraph' | 'multiple_choice' | 'checkboxes';
    question_text: string;
    options: string[] | null;
    image_url?: string | null;
    is_required: boolean;
}

interface Section {
    id: number | string;
    title: string;
    description: string;
    questions: Question[];
}

interface Submission {
    id: number;
    score: number;
    raw_score?: number;
    total_questions?: number;
}

interface Exam {
    id: string;
    title: string;
    group_name?: string | null;
    duration_minutes: number;
    status: 'active' | 'closed' | 'draft';
    shuffle_questions: number;
    shuffle_options: number;
    show_score: number;
    sections: Section[];
    ungrouped_questions: Question[];
    my_submission?: Submission | null;
    allow_late_submission: number;
    start_time: string;
    start_method?: 'auto' | 'manual';
    enable_video_proctoring: number;
    theme_config?: {
        primary_color: string;
        background_color: string;
        text_color: string;
    };
}

// ─── Floating Appearance Panel ─────────────────────────────────────────────────
const FloatingAppearancePanel: React.FC = () => {
    const { presetId, setPreset, allPresets } = useAppearance();
    const { isDark, toggleTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const [savedPreset, setSavedPreset] = useState<string | null>(null);

    const handleSelectPreset = (id: string) => {
        setPreset(id);
        setSavedPreset(id);
        setTimeout(() => setSavedPreset(null), 1500);
    };

    const hslStr = (hsl: string) => `hsl(${hsl})`;

    return (
        <>
            {/* Toggle Button */}
            <motion.button
                id="appearance-toggle-btn"
                onClick={() => setOpen(o => !o)}
                className="fixed bottom-6 left-6 z-[70] w-11 h-11 rounded-full flex items-center justify-center shadow-lg border border-white/10 backdrop-blur-md transition-all"
                style={{ backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                title="Appearance Settings"
            >
                <FontAwesomeIcon icon={open ? faTimes : faPalette} className="text-sm" />
            </motion.button>

            {/* Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        id="appearance-panel"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                        className="fixed bottom-20 left-6 z-[70] w-72 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden"
                        style={{
                            backgroundColor: 'hsl(var(--card) / 0.95)',
                            borderColor: 'hsl(var(--border))',
                        }}
                    >
                        {/* Panel Header */}
                        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border))' }}>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'hsl(var(--muted-foreground))' }}>Appearance</p>
                                <p className="text-xs font-bold" style={{ color: 'hsl(var(--foreground))' }}>Customize your exam view</p>
                            </div>
                            {/* Dark / Light toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all"
                                style={{
                                    backgroundColor: 'hsl(var(--surface))',
                                    borderColor: 'hsl(var(--border))',
                                    color: 'hsl(var(--primary))'
                                }}
                                title={isDark ? 'Switch to Light' : 'Switch to Dark'}
                            >
                                <FontAwesomeIcon icon={isDark ? faMoon : faSun} className="text-xs" />
                            </button>
                        </div>

                        {/* Color Presets */}
                        <div className="p-3">
                            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Color Theme</p>
                            <div className="grid grid-cols-3 gap-2">
                                {allPresets.map(preset => {
                                    const isActive = presetId === preset.id;
                                    const col = isDark ? preset.dark.primary : preset.light.primary;
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleSelectPreset(preset.id)}
                                            className="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all"
                                            style={{
                                                backgroundColor: isActive ? `hsl(${col} / 0.15)` : 'hsl(var(--surface))',
                                                borderColor: isActive ? `hsl(${col})` : 'hsl(var(--border))',
                                            }}
                                            title={preset.name}
                                        >
                                            <div
                                                className="w-7 h-7 rounded-full flex items-center justify-center shadow-md border border-white/10"
                                                style={{ backgroundColor: hslStr(col) }}
                                            >
                                                {isActive && <FontAwesomeIcon icon={faCheck} className="text-white text-[8px]" />}
                                            </div>
                                            <span className="text-[8px] font-bold truncate w-full text-center" style={{ color: 'hsl(var(--foreground))' }}>
                                                {preset.emoji} {preset.name.split(' ')[0]}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer note */}
                        <div className="px-4 pb-3 pt-1">
                            <p className="text-[8px] text-center font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                Changes apply instantly to your exam view
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Saved toast */}
            <AnimatePresence>
                {savedPreset && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg text-xs font-bold"
                        style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                    >
                        <FontAwesomeIcon icon={faCheck} />
                        Theme applied
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

// ─── Main TakeExam Component ──────────────────────────────────────────────────
const TakeExam = () => {
    const { t } = useLanguage();
    const { examId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [answers, setAnswers] = useState<Record<number, string[]>>({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [isAway, setIsAway] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [waitingReason, setWaitingReason] = useState<'manual' | 'scheduled' | null>(null);
    const [scheduledTime, setScheduledTime] = useState<number | null>(null);
    const [timerInitialized, setTimerInitialized] = useState(false);
    const [waitTimer, setWaitTimer] = useState<number | null>(null);

    const [submissionResult, setSubmissionResult] = useState<any>(null);
    const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastStatus = useRef<string | null>(null);
    const hasSubmitted = useRef(false);
    const cleanupRef = useRef<(() => void) | null>(null);
    const isWaitingRef = useRef(false);
    const allowLateSubmissionRef = useRef(0);

    const getSeed = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    const shuffleArray = <T,>(array: T[], seed?: number): T[] => {
        const newArr = [...array];
        if (seed === undefined) {
            for (let i = newArr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
        } else {
            let currentSeed = seed;
            const seededRandom = () => {
                const x = Math.sin(currentSeed++) * 10000;
                return x - Math.floor(x);
            };
            for (let i = newArr.length - 1; i > 0; i--) {
                const j = Math.floor(seededRandom() * (i + 1));
                [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
        }
        return newArr;
    };

    const fetchExam = React.useCallback(async (): Promise<Exam | null> => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/api/exams/${examId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data: Exam = res.data;

            const baseSeed = user ? getSeed(user.id + examId) : 1;

            const processedSections = (data.sections || []).map(section => {
                const sectionSeed = baseSeed + getSeed(section.id.toString());
                let qs = [...section.questions];
                if (data.shuffle_questions) qs = shuffleArray(qs, sectionSeed);
                if (data.shuffle_options) {
                    qs = qs.map(q => ({
                        ...q,
                        options: q.options ? shuffleArray(q.options, sectionSeed + q.id) : null
                    }));
                }
                return { ...section, questions: qs };
            });

            const ungroupedSeed = baseSeed + 999;
            let processedUngrouped = [...(data.ungrouped_questions || [])];
            if (data.shuffle_questions) processedUngrouped = shuffleArray(processedUngrouped, ungroupedSeed);
            if (data.shuffle_options) {
                processedUngrouped = processedUngrouped.map(q => ({
                    ...q,
                    options: q.options ? shuffleArray(q.options, ungroupedSeed + q.id) : null
                }));
            }

            data.sections = processedSections;
            data.ungrouped_questions = processedUngrouped;

            setExam(data);
            allowLateSubmissionRef.current = data.allow_late_submission;

            if (data.my_submission) {
                hasSubmitted.current = true;
                return data;
            }

            const startTime = data.start_time && new Date(data.start_time).getFullYear() > 2000
                ? new Date(data.start_time).getTime()
                : null;
            const now = Date.now();

            const isManualWaiting = data.status === 'closed' && data.start_method === 'manual' && (!data.start_time || new Date(data.start_time).getFullYear() < 2000);
            const isAutoWaiting = data.status === 'active' && data.start_method === 'auto' && (startTime && startTime > now);

            if (data.status !== 'active' && !isManualWaiting) {
                navigate('/');
                return null;
            }

            if (data.start_method === 'manual' && (!data.start_time || new Date(data.start_time).getFullYear() < 2000)) {
                setIsWaiting(true);
                isWaitingRef.current = true;
                setWaitingReason('manual');
                return data;
            }

            if (data.start_method === 'auto') {
                if (!startTime) {
                    setIsWaiting(true);
                    setWaitingReason('scheduled');
                    return data;
                }
                if (startTime > now) {
                    setIsWaiting(true);
                    isWaitingRef.current = true;
                    setWaitingReason('scheduled');
                    setScheduledTime(startTime);
                    return data;
                }
            }

            setIsWaiting(false);
            isWaitingRef.current = false;
            setWaitingReason(null);

            if (startTime) {
                const endTime = startTime + (data.duration_minutes * 60000);
                const hasEnded = now > endTime;

                if (hasEnded && !data.allow_late_submission) {
                    await showToast.warning('Assessment Ended', 'This assessment has ended and late submissions are not allowed.');
                    navigate('/');
                    return null;
                }

                const secondsLeft = Math.floor((endTime - now) / 1000);
                setTimeLeft(secondsLeft);
                setTimerInitialized(true);
            }
            return data;
        } catch (err) { navigate('/'); return null; }
    }, [examId, navigate]);

    useEffect(() => {
        const saved = localStorage.getItem(`exam_progress_${examId}`);
        if (saved) {
            try { setAnswers(JSON.parse(saved)); } catch (e) { console.error('Failed to load progress', e); }
        }
    }, [examId]);

    useEffect(() => {
        if (Object.keys(answers).length > 0) {
            localStorage.setItem(`exam_progress_${examId}`, JSON.stringify(answers));
        }
    }, [answers, examId]);

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const examData = await fetchExam();
            if (cancelled || !user || !examData || examData.my_submission) return;

            const emitStatus = (eventType: 'FOCUS_LOST' | 'FOCUS_GAINED') => {
                if (hasSubmitted.current) return;
                if (lastStatus.current === eventType) return;
                lastStatus.current = eventType;
                socket.emit('student_activity', { examId, studentId: user.id, studentName: user.name, picture: user.picture, eventType });
            };

            const handleSecurityEvent = () => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                if (document.visibilityState === 'hidden') { setIsAway(true); emitStatus('FOCUS_LOST'); }
                else { setIsAway(false); emitStatus('FOCUS_GAINED'); }
            };

            const handleBlur = () => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                blurTimeout.current = setTimeout(() => {
                    const activeEl = document.activeElement;
                    const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
                    if (!isInput && document.visibilityState === 'visible') { setIsAway(true); emitStatus('FOCUS_LOST'); }
                }, 500);
            };

            const handleFocus = () => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                setIsAway(false);
                emitStatus('FOCUS_GAINED');
            };

            const handleExamStarted = () => { fetchExam(); };

            const handleExamClosed = () => {
                if (hasSubmitted.current) return;
                if (isWaitingRef.current) {
                    showToast.info('Assessment Closed', 'This session has been closed by the facilitator.').then(() => { navigate('/'); });
                } else if (!allowLateSubmissionRef.current) {
                    showToast.info('Time Expired', 'The assessment session has ended. Your progress is being synchronized.').then(() => { handleSubmit(true); });
                } else {
                    showToast.info('Assessment Closed', 'This session has been closed by the facilitator.').then(() => { navigate('/'); });
                }
            };

            const handleStatusSyncRequest = () => {
                if (hasSubmitted.current) return;
                socket.emit('student_activity', {
                    examId, studentId: user.id, studentName: user.name, picture: user.picture,
                    eventType: document.visibilityState === 'visible' && !isAway ? 'FOCUS_GAINED' : 'FOCUS_LOST'
                });
                if (localStream) socket.emit('webrtc_ready', { examId, studentId: user.id });
            };

            const handleExamDeleted = () => {
                showToast.error('Assessment Removed', 'This assessment session has been deleted by an administrator.').then(() => { navigate('/'); });
            };

            socket.on('exam_started', handleExamStarted);
            socket.on('exam_closed', handleExamClosed);
            socket.on('exam_deleted', handleExamDeleted);
            socket.on('status_sync_request', handleStatusSyncRequest);

            const peerConnections: Record<string, RTCPeerConnection> = {};
            let localStream: MediaStream | null = null;
            let isCameraStarting = false;

            const startCamera = async () => {
                if (isCameraStarting || localStream) return;
                isCameraStarting = true;
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 5 } }, audio: false });
                    localStream = stream;
                    socket.emit('webrtc_ready', { examId, studentId: user?.id });
                    Object.values(peerConnections).forEach(pc => {
                        const hasVideoTrack = pc.getSenders().some(s => s.track?.kind === 'video');
                        if (!hasVideoTrack) stream.getTracks().forEach(track => pc.addTrack(track, stream));
                    });
                } catch (err) { console.error('[WebRTC] Camera access denied:', err); }
                finally { isCameraStarting = false; }
            };

            const handleSignal = async ({ fromId, signal, targetId }: any) => {
                if (targetId !== user?.id) return;
                let pc = peerConnections[fromId];
                if (!pc) {
                    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                    peerConnections[fromId] = pc;
                    (pc as any).candidateQueue = [];
                    pc.onicecandidate = (event) => {
                        if (event.candidate) socket.emit('webrtc_signal', { examId, targetId: fromId, fromId: user?.id, signal: { type: 'candidate', candidate: event.candidate } });
                    };
                    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream!));
                }
                try {
                    if (signal.type === 'offer') {
                        if (pc.signalingState !== 'stable') return;
                        await pc.setRemoteDescription(new RTCSessionDescription(signal));
                        if (localStream) {
                            const hasVideoTrack = pc.getSenders().some(s => s.track?.kind === 'video');
                            if (!hasVideoTrack) localStream.getTracks().forEach(track => pc.addTrack(track, localStream!));
                        }
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit('webrtc_signal', { examId, targetId: fromId, fromId: user?.id, signal: answer });
                        const queue = (pc as any).candidateQueue || [];
                        while (queue.length > 0) await pc.addIceCandidate(new RTCIceCandidate(queue.shift()));
                    } else if (signal.type === 'candidate') {
                        if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        else (pc as any).candidateQueue.push(signal.candidate);
                    }
                } catch (e) { console.error('[WebRTC] RTC Error:', e); }
            };

            if (examData.enable_video_proctoring === 1) socket.on('webrtc_signal', handleSignal);

            const handleConnect = () => {
                if (user && !hasSubmitted.current) socket.emit('join_exam', { examId, studentId: user.id, studentName: user.name, picture: user.picture });
            };

            socket.on('connect', handleConnect);
            if (user && !examData.my_submission) {
                if (socket.connected) handleConnect();
                else socket.connect();
            }
            if (examData.enable_video_proctoring === 1) startCamera();

            document.addEventListener('visibilitychange', handleSecurityEvent);
            window.addEventListener('blur', handleBlur);
            window.addEventListener('focus', handleFocus);

            cleanupRef.current = () => {
                if (blurTimeout.current) clearTimeout(blurTimeout.current);
                if (!hasSubmitted.current) socket.emit('student_activity', { examId, studentId: user.id, studentName: user.name, picture: user.picture, eventType: 'LEFT_EXAM' });
                socket.off('connect', handleConnect);
                socket.off('exam_started', handleExamStarted);
                socket.off('exam_closed', handleExamClosed);
                socket.off('exam_deleted', handleExamDeleted);
                socket.off('status_sync_request', handleStatusSyncRequest);
                socket.off('webrtc_signal', handleSignal);
                if (localStream) localStream.getTracks().forEach(track => track.stop());
                Object.values(peerConnections).forEach(pc => pc.close());
                document.removeEventListener('visibilitychange', handleSecurityEvent);
                window.removeEventListener('blur', handleBlur);
                window.removeEventListener('focus', handleFocus);
            };
        };

        init();
        return () => {
            cancelled = true;
            if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
        };
    }, [examId, user, navigate]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isWaiting) {
            interval = setInterval(() => {
                const token = localStorage.getItem('token');
                axios.get(`${API_BASE_URL}/api/exams/${examId}`, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
                    const data: Exam = res.data;
                    const startTime = data.start_time && new Date(data.start_time).getFullYear() > 2000 ? new Date(data.start_time).getTime() : null;
                    const now = Date.now();
                    const isManualWaiting = data.status === 'closed' && data.start_method === 'manual' && (!data.start_time || new Date(data.start_time).getFullYear() < 2000);
                    if (data.status !== 'active' && !isManualWaiting) { navigate('/'); return; }
                    if (isWaiting && waitingReason === 'manual' && (data.status === 'active' || startTime)) { fetchExam(); return; }
                    if (data.start_method === 'auto' && startTime && startTime <= now) fetchExam();
                }).catch(() => { });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isWaiting, examId, waitingReason]);

    useEffect(() => {
        if (isWaiting && waitingReason === 'scheduled' && scheduledTime) {
            const updateTimer = () => {
                const diff = Math.floor((scheduledTime - Date.now()) / 1000);
                setWaitTimer(diff > 0 ? diff : 0);
                if (diff <= 0) fetchExam();
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        } else { setWaitTimer(null); }
    }, [isWaiting, waitingReason, scheduledTime, fetchExam]);

    useEffect(() => {
        if (exam && !exam.my_submission && timerInitialized) {
            if (timeLeft > 0) {
                const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
                return () => clearInterval(timer);
            } else if (timeLeft <= 0) {
                if (exam.allow_late_submission) {
                    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
                    return () => clearInterval(timer);
                } else {
                    handleSubmit(true);
                }
            }
        }
    }, [timeLeft, exam, timerInitialized]);

    const toggleSelect = (qId: number, type: 'multiple_choice' | 'checkboxes', option: string) => {
        if (exam?.my_submission) return;
        const current = answers[qId] || [];
        if (type === 'multiple_choice') {
            setAnswers({ ...answers, [qId]: current.includes(option) ? [] : [option] });
        } else {
            setAnswers({ ...answers, [qId]: current.includes(option) ? current.filter(o => o !== option) : [...current, option] });
        }
    };

    const handleTextAnswer = (qId: number, value: string) => {
        if (exam?.my_submission) return;
        setAnswers({ ...answers, [qId]: [value] });
    };

    const handleSubmit = async (isAutoSubmit: boolean = false) => {
        if (exam?.my_submission) return;

        if (!isAutoSubmit) {
            const allQuestions = [...(exam?.sections.flatMap(s => s.questions) || []), ...(exam?.ungrouped_questions || [])];
            const missingRequired = allQuestions.some(q => {
                if (q.is_required) { const ans = answers[q.id]; return !ans || ans.length === 0 || (ans.length === 1 && ans[0].trim() === ''); }
                return false;
            });
            if (missingRequired) { showToast.warning('Incomplete Assessment', 'Please answer all required questions before attempting to synchronize.'); return; }
            const result = await showToast.question(t('submit_exam_confirm'), t('submit_exam_text'), t('yes'), t('cancel'));
            if (!result.isConfirmed) return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE_URL}/api/submissions`, { exam_id: examId, answers }, { headers: { Authorization: `Bearer ${token}` } });
            setSubmissionResult(res.data);
            localStorage.removeItem(`exam_progress_${examId}`);
            hasSubmitted.current = true;
            socket.emit('leave_exam', { examId });
            if (isAutoSubmit) { navigate('/'); return; }
            await showToast.success('Submitted', 'Examination synchronized with central server.');
            if (!exam?.show_score) navigate('/');
        } catch (err) {
            if (!isAutoSubmit) showToast.error('Sync Failure', 'Synchronization failed. Please check your connection.');
            else navigate('/');
        }
    };

    const formatTime = (secs: number) => {
        const abs = Math.abs(secs);
        const m = Math.floor(abs / 60);
        const s = abs % 60;
        const str = `${m}:${s.toString().padStart(2, '0')}`;
        return secs < 0 ? `-${str}` : str;
    };

    // ── Loading ──
    if (!exam) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
                />
                <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase">Initializing...</p>
            </div>
        </div>
    );

    // ── Submitted / Score View ──
    if (exam.my_submission || submissionResult) {
        const sub = submissionResult || exam.my_submission;
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md"
                >
                    <div className="rounded-3xl border bg-card overflow-hidden shadow-2xl" style={{ borderColor: 'hsl(var(--border))' }}>
                        {/* Top accent bar */}
                        <div className="h-1 w-full bg-primary" />

                        <div className="p-8 text-center space-y-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
                                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto border-2 border-primary/20"
                            >
                                <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-primary" />
                            </motion.div>

                            <div>
                                <h1 className="text-2xl font-black text-foreground tracking-tight">Assessment Synchronized</h1>
                                <p className="text-muted-foreground text-sm mt-1 font-medium">Your submission has been securely recorded.</p>
                            </div>

                            {exam.show_score ? (
                                <div className="bg-surface rounded-2xl p-6 border border-border">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Total Achievement</p>
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-5xl font-black text-primary">{sub.raw_score}</span>
                                        <span className="text-2xl font-black text-muted-foreground/40">/</span>
                                        <span className="text-2xl font-bold text-muted-foreground">{sub.total_questions}</span>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Correct Answers</p>
                                </div>
                            ) : (
                                <div className="bg-surface rounded-2xl p-6 border border-border text-sm text-muted-foreground italic">
                                    Results are being processed by the facilitator.
                                </div>
                            )}

                            <Link to="/" className="btn-primary-minimal w-full">Return to Dashboard</Link>
                        </div>
                    </div>
                </motion.div>
                <FloatingAppearancePanel />
            </div>
        );
    }

    // ── Waiting Room ──
    if (isWaiting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-lg"
                >
                    <div className="rounded-3xl border bg-card overflow-hidden shadow-2xl" style={{ borderColor: 'hsl(var(--border))' }}>
                        <div className="h-1 w-full bg-primary" />
                        <div className="p-10 text-center space-y-8">
                            {/* Animated clock */}
                            <div className="relative inline-flex items-center justify-center">
                                <motion.div
                                    className="absolute w-24 h-24 rounded-full border-2 border-primary/20"
                                    animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 2.5, repeat: Infinity }}
                                />
                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <FontAwesomeIcon icon={faClock} className="text-3xl text-primary" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h1 className="text-3xl font-black text-foreground tracking-tight">
                                    {waitingReason === 'manual' ? t('waiting_for_host') : t('upcoming_assessment')}
                                </h1>
                                <p className="text-muted-foreground font-medium">
                                    {waitingReason === 'manual'
                                        ? t('session_begin_shortly')
                                        : scheduledTime ? `${t('starts_at')} ${new Date(scheduledTime).toLocaleTimeString()}` : 'Unknown'
                                    }
                                </p>
                            </div>

                            {waitTimer !== null && waitTimer > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-surface rounded-2xl p-6 border border-border"
                                >
                                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">{t('starts_in')}</div>
                                    <div className="text-6xl font-black tabular-nums text-primary">{formatTime(waitTimer)}</div>
                                </motion.div>
                            )}

                            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface border border-border text-xs font-bold text-muted-foreground">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                                {waitingReason === 'manual' ? t('connected_stay_on_page') : t('system_synchronized')}
                            </div>
                        </div>
                    </div>
                </motion.div>
                <FloatingAppearancePanel />
            </div>
        );
    }

    // ── Question Renderer ──
    const renderQuestion = (q: Question, qIdx: number) => {
        const isAnswered = answers[q.id] && answers[q.id].length > 0 && answers[q.id][0] !== '';
        return (
            <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qIdx * 0.02 }}
                className="rounded-2xl border-0 transition-all duration-300"
                style={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: isAnswered ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))',
                    boxShadow: isAnswered ? '0 0 0 1px hsl(var(--primary) / 0.1)' : 'none'
                }}
            >
                <div className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                        {/* Question number + required badge */}
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
                            <span className="text-2xl font-black tabular-nums leading-none" style={{ color: 'hsl(var(--primary) / 0.2)' }}>
                                {(qIdx + 1).toString().padStart(2, '0')}
                            </span>
                            {q.is_required && (
                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Req</span>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-5">
                            <h3 className="text-base font-semibold leading-relaxed text-foreground">{q.question_text}</h3>

                            {q.image_url && (
                                <img src={`${API_BASE_URL}${q.image_url}`} alt="Question" className="max-w-full h-auto rounded-xl border border-border" />
                            )}

                            {/* Short Answer */}
                            {q.type === 'short_answer' && (
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={(answers[q.id] || [''])[0]}
                                        onChange={e => handleTextAnswer(q.id, e.target.value)}
                                        className="w-full bg-transparent border-b-2 py-2 text-base font-medium outline-none transition-all placeholder:opacity-30 text-foreground"
                                        style={{ borderColor: isAnswered ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
                                        placeholder="Type your answer..."
                                    />
                                    <div className="absolute bottom-0 left-0 h-[2px] w-0 group-focus-within:w-full transition-all duration-500 bg-primary rounded-full" />
                                </div>
                            )}

                            {/* Paragraph */}
                            {q.type === 'paragraph' && (
                                <div className="relative group">
                                    <textarea
                                        value={(answers[q.id] || [''])[0]}
                                        onChange={e => handleTextAnswer(q.id, e.target.value)}
                                        className="w-full bg-transparent border-b-2 py-2 text-base font-medium outline-none transition-all placeholder:opacity-30 resize-none min-h-[100px] text-foreground"
                                        style={{ borderColor: isAnswered ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
                                        placeholder="Type your long answer here..."
                                    />
                                    <div className="absolute bottom-0 left-0 h-[2px] w-0 group-focus-within:w-full transition-all duration-500 bg-primary rounded-full" />
                                </div>
                            )}

                            {/* Multiple Choice / Checkboxes */}
                            {(q.type === 'multiple_choice' || q.type === 'checkboxes') && q.options && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {q.options.map((option, oIdx) => {
                                        const selected = (answers[q.id] || []).includes(option);
                                        return (
                                            <button
                                                key={oIdx}
                                                onClick={() => toggleSelect(q.id, q.type as 'multiple_choice' | 'checkboxes', option)}
                                                className="text-left w-full px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 flex items-center gap-3"
                                                style={{
                                                    backgroundColor: selected ? 'hsl(var(--primary))' : 'hsl(var(--surface))',
                                                    borderColor: selected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                                                    color: selected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                                                }}
                                            >
                                                <span
                                                    className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 transition-all duration-200 ${q.type === 'checkboxes' ? 'rounded-md' : 'rounded-full'}`}
                                                    style={{
                                                        backgroundColor: selected ? 'rgba(255,255,255,0.25)' : 'hsl(var(--muted))',
                                                        borderColor: selected ? 'rgba(255,255,255,0.4)' : 'hsl(var(--border))',
                                                        color: selected ? 'white' : 'hsl(var(--muted-foreground))',
                                                        transform: selected ? 'scale(1.1)' : 'scale(1)',
                                                    }}
                                                >
                                                    {selected ? '✓' : String.fromCharCode(65 + oIdx)}
                                                </span>
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    let globalQIdx = 0;
    const allQuestions = [...(exam.sections.flatMap(s => s.questions) || []), ...(exam.ungrouped_questions || [])];
    const answeredCount = allQuestions.filter(q => answers[q.id] && answers[q.id].length > 0 && answers[q.id][0] !== '').length;
    const progress = allQuestions.length > 0 ? (answeredCount / allQuestions.length) * 100 : 0;

    return (
        <div className="min-h-screen bg-background text-foreground">

            {/* ── Fixed Header ── */}
            <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 h-[2px] w-full bg-border">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                </div>

                <div className="max-w-5xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
                    {/* Title */}
                    <div className="flex flex-col min-w-0 overflow-hidden">
                        <h2 className="text-base sm:text-lg font-black leading-none mb-0.5 truncate text-foreground">{exam.title}</h2>
                        {exam.group_name && (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-primary truncate">{exam.group_name}</span>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {/* Progress pill */}
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface text-xs font-black">
                            <span className="text-primary">{answeredCount}</span>
                            <span className="text-muted-foreground/40">/</span>
                            <span className="text-muted-foreground">{allQuestions.length}</span>
                        </div>

                        {/* Timer */}
                        <div className={`px-3 py-1.5 rounded-full border flex items-center gap-2 text-xs font-black tracking-wider transition-colors ${timeLeft < 0
                            ? 'border-red-500 bg-red-500 text-white'
                            : isAway
                                ? 'border-red-400 text-red-400 animate-pulse bg-red-400/10'
                                : 'border-border bg-surface text-muted-foreground'
                            }`}>
                            <FontAwesomeIcon icon={faClock} className="text-[10px]" />
                            <span className="tabular-nums">{timeLeft < 0 ? `${t('overdue')} ${formatTime(timeLeft)}` : formatTime(timeLeft)}</span>
                        </div>

                        {/* Submit */}
                        <button
                            id="submit-btn"
                            onClick={() => handleSubmit()}
                            className="h-9 px-4 sm:px-6 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                        >
                            {t('finish')}
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Away Alert ── */}
            <AnimatePresence>
                {isAway && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="fixed top-20 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[100] sm:w-full sm:max-w-md cursor-pointer"
                        onClick={() => setIsAway(false)}
                    >
                        <div className="bg-red-600 text-white p-4 rounded-2xl flex items-center gap-4 border border-white/20">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <FontAwesomeIcon icon={faTriangleExclamation} className="text-lg animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/70 mb-1">{t('security_alert_title')}</div>
                                <p className="text-sm font-bold leading-snug">{t('security_alert_away')}</p>
                                <p className="text-[9px] font-medium text-white/50 uppercase tracking-widest mt-0.5">{t('security_alert_return')}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main Content ── */}
            <main className="max-w-4xl mx-auto pt-6 pb-6 px-4 sm:px-6">



                <div className="space-y-5">
                    {/* Sections */}
                    {exam.sections.map(section => (
                        <section key={section.id} className="space-y-4">
                            <div className="space-y-1 py-2 border-b border-border">
                                <h2 className="text-lg sm:text-xl font-black text-primary tracking-tight">{section.title}</h2>
                                {section.description && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{section.description}</p>}
                            </div>
                            <div className="space-y-4">
                                {section.questions.map(q => renderQuestion(q, globalQIdx++))}
                            </div>
                        </section>
                    ))}

                    {/* Ungrouped */}
                    {exam.ungrouped_questions.length > 0 && (
                        <section className="space-y-4">
                            <div className="space-y-1 py-2 border-b border-border">
                                <h2 className="text-lg sm:text-xl font-black text-muted-foreground/30 tracking-tight">{t('assessment')}</h2>
                            </div>
                            <div className="space-y-4">
                                {exam.ungrouped_questions.map(q => renderQuestion(q, globalQIdx++))}
                            </div>
                        </section>
                    )}

                    {/* Bottom submit area */}
                    <div className="pt-10 flex flex-col items-center gap-4">
                        {/* Mini progress bar */}
                        <div className="w-40 h-1.5 rounded-full bg-border overflow-hidden">
                            <motion.div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${progress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{answeredCount} {t('answered_of')} {allQuestions.length}</p>
                        <motion.button
                            id="bottom-submit-btn"
                            onClick={() => handleSubmit()}
                            className="px-10 sm:px-14 py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-primary-foreground bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {t('finalize_submission')}
                        </motion.button>
                    </div>
                </div>
            </main>

            {/* ── Floating Robot Proctoring Icon ── */}
            <motion.div
                className="fixed bottom-6 right-6 z-[60] pointer-events-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative flex items-center justify-center p-2"
                >
                    <FontAwesomeIcon
                        icon={faRobot}
                        className="text-xl sm:text-2xl text-primary opacity-50 drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]"
                    />
                    <motion.div
                        className="absolute -bottom-1 w-6 h-[1px] bg-red-500/30 blur-[1px]"
                        animate={{ opacity: [0, 1, 0, 1, 0], scaleX: [0.5, 1.2, 0.5], y: [0, -2, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    />
                    <motion.div
                        className="absolute -top-1 w-1 h-1 bg-red-500/60 rounded-full"
                        animate={{ scale: [1, 3], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                </motion.div>
            </motion.div>

            {/* ── Floating Appearance Panel ── */}
            <FloatingAppearancePanel />
        </div>
    );
};

export default TakeExam;
