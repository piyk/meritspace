import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeartPulse, faChevronLeft, faUser, faTerminal, faDownload, faShieldHalved, faBolt, faCheckCircle, faUsers, faFileCsv, faRotateRight, faTrash, faVideo, faXmark, faQrcode, faCopy, faClock, faPen } from '@fortawesome/free-solid-svg-icons';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, SOCKET_PATH } from '../config';
import showToast from '../utils/swal';

const socket = io('', {
    path: SOCKET_PATH,
    transports: ['websocket'],
    upgrade: false,
    secure: true
});

interface LiveLog {
    studentId: string;
    studentName: string;
    studentPicture?: string;
    eventType: 'FOCUS_LOST' | 'FOCUS_GAINED' | 'SUBMITTED' | 'LEFT_EXAM' | 'DISCONNECTED' | 'CONNECTED';
    timestamp: string;
    score?: number;
    totalQuestions?: number;
}

interface StudentState {
    name: string;
    email: string;
    status: 'away' | 'focused' | 'submitted' | 'offline';
    lastUpdate: string;
    picture?: string;
    score?: number;
    totalQuestions?: number;
}

interface Exam {
    title: string;
    course: string;
    status: 'active' | 'closed' | 'draft';
    start_time: string | null;
    enable_video_proctoring: number;
    allow_late_submission?: number;
    start_method?: 'auto' | 'manual';
    duration_minutes?: number;
}

const VideoPlayer = ({ stream }: { stream: MediaStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);
    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-lg border border-primary/20 bg-black"
        />
    );
};

const MonitoringDashboard = () => {
    const { examId } = useParams<{ examId: string }>();
    const { t } = useLanguage();
    const { user } = useAuth();
    const [exam, setExam] = useState<Exam | null>(null);
    const [liveLogs, setLiveLogs] = useState<LiveLog[]>([]);
    const [studentStatus, setStudentStatus] = useState<Record<string, StudentState>>({});
    const [activeTab, setActiveTab] = useState<'participants' | 'logs'>('participants');
    const [studentStreams, setStudentStreams] = useState<Record<string, MediaStream>>({});
    const [showQR, setShowQR] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const examRef = useRef<Exam | null>(null);
    const studentStatusRef = useRef<Record<string, StudentState>>({});

    useEffect(() => {
        examRef.current = exam;
    }, [exam]);

    useEffect(() => {
        studentStatusRef.current = studentStatus;
    }, [studentStatus]);

    interface ExtendedPeerConnection extends RTCPeerConnection {
        candidateQueue?: RTCIceCandidateInit[];
    }

    const initiateConnection = async (studentId: string) => {
        const currentExam = examRef.current;
        const currentStatus = studentStatusRef.current[studentId];
        const existingPc = peerConnections.current[studentId] as ExtendedPeerConnection;

        // Efficiency: Don't connect if student is already submitted
        if (!user || !currentExam || currentExam.enable_video_proctoring !== 1 || currentStatus?.status === 'submitted') return;

        // If connection is already progressing or active, don't re-initiate automatically
        if (existingPc && (existingPc.connectionState === 'connected' || existingPc.connectionState === 'connecting')) return;

        // Clean up old PC if it exists and we're retrying
        if (existingPc) {
            existingPc.close();
            delete peerConnections.current[studentId];
        }

        console.log(`[WebRTC] Initiating connection to student ${studentId}`);
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        }) as ExtendedPeerConnection;
        peerConnections.current[studentId] = pc;
        pc.candidateQueue = [];

        // Explicitly tell the PeerConnection we want to receive video
        pc.addTransceiver('video', { direction: 'recvonly' });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc_signal', {
                    examId,
                    targetId: studentId,
                    fromId: user.id,
                    signal: { type: 'candidate', candidate: event.candidate }
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received track from student ${studentId}`);
            if (event.streams && event.streams[0]) {
                setStudentStreams(prev => ({ ...prev, [studentId]: event.streams[0] }));
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] PC State (${studentId}):`, pc.connectionState);
        };

        const offer = await pc.createOffer({ offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_signal', {
            examId,
            targetId: studentId,
            fromId: user.id,
            signal: offer
        });
    };

    useEffect(() => {
        const handleSignal = async ({ fromId, signal, targetId }: { fromId: string, signal: any, targetId: string }) => {
            if (targetId !== user?.id) return;

            // Efficiency: Ignore signals from submitted students
            if (studentStatusRef.current[fromId]?.status === 'submitted') return;

            console.log(`[WebRTC] Received signal from student ${fromId}:`, signal.type || 'candidate');
            const pc = peerConnections.current[fromId] as ExtendedPeerConnection;
            if (!pc) return;

            try {
                if (signal.type === 'answer') {
                    if (pc.signalingState !== 'have-local-offer') {
                        console.warn(`[WebRTC] Ignoring answer from student ${fromId} because state is ${pc.signalingState}`);
                        return;
                    }
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    console.log(`[WebRTC] Set remote description for student ${fromId}`);

                    // Process queued candidates
                    const queue = pc.candidateQueue || [];
                    while (queue.length > 0) {
                        const cand = queue.shift();
                        if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
                    }
                } else if (signal.type === 'candidate') {
                    if (pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    } else {
                        if (!pc.candidateQueue) pc.candidateQueue = [];
                        pc.candidateQueue.push(signal.candidate);
                    }
                }
            } catch (e) {
                console.error("[WebRTC] RTC Error:", e);
            }
        };

        socket.on('webrtc_signal', handleSignal);
        return () => {
            socket.off('webrtc_signal', handleSignal);
        };
    }, [user, examId]);

    const fetchExamAndParticipants = async () => {
        try {
            const token = localStorage.getItem('token');

            const examRes = await axios.get(`${API_BASE_URL}/api/exams/${examId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExam(examRes.data);

            const participantsRes = await axios.get(`${API_BASE_URL}/api/exams/${examId}/participants`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const initialStatus: Record<string, StudentState> = {};
            participantsRes.data.forEach((p: { id: string; name: string; email: string; picture?: string; status: string; isOnline: boolean; submitted_at?: string; raw_score?: number; total_questions?: number }) => {
                initialStatus[p.id] = {
                    name: p.name,
                    email: p.email,
                    picture: p.picture,
                    status: p.status === 'submitted' ? 'submitted' : (p.isOnline ? 'focused' : 'offline'),
                    lastUpdate: p.submitted_at || new Date().toISOString(),
                    score: p.raw_score,
                    totalQuestions: p.total_questions,
                };
            });
            setStudentStatus(initialStatus);

            // Wait for state to settle then sync
            setTimeout(() => {
                socket.emit('request_status_sync', { examId });
            }, 100);

        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
    };

    useEffect(() => {
        fetchExamAndParticipants();

        const handleConnect = () => {
            socket.emit('join_exam', { examId });
            socket.emit('request_status_sync', { examId });
        };

        socket.on('connect', handleConnect);
        if (socket.connected) handleConnect();

        const handleWebRTCReady = ({ studentId }: { studentId: string }) => {
            // Efficiency: Don't initiate if student already submitted
            if (studentStatusRef.current[studentId]?.status === 'submitted') return;
            console.log(`[WebRTC] Student ${studentId} is ready, initiating...`);
            initiateConnection(studentId);
        };

        socket.on('webrtc_ready', handleWebRTCReady);

        socket.on('monitor_update', (data: LiveLog) => {
            // Efficiency: Ignore any updates for students who have already submitted
            if (studentStatusRef.current[data.studentId]?.status === 'submitted') return;

            setLiveLogs(prev => [...prev, data].slice(-50));
            setStudentStatus(prev => {
                const current = prev[data.studentId];
                if (current?.status === 'submitted') return prev;

                let newStatus: StudentState['status'] = 'focused';
                if (data.eventType === 'SUBMITTED') {
                    newStatus = 'submitted';
                    // Stop WebRTC monitoring immediately on submission
                    if (peerConnections.current[data.studentId]) {
                        console.log(`[Efficiency] Disconnecting student ${data.studentId} after submission`);
                        peerConnections.current[data.studentId].close();
                        delete peerConnections.current[data.studentId];
                        setStudentStreams(prevStreams => {
                            const next = { ...prevStreams };
                            delete next[data.studentId];
                            return next;
                        });
                    }
                }
                else if (data.eventType === 'FOCUS_LOST') newStatus = 'away';
                else if (data.eventType === 'LEFT_EXAM' || data.eventType === 'DISCONNECTED') {
                    newStatus = 'offline';
                    if (peerConnections.current[data.studentId]) {
                        peerConnections.current[data.studentId].close();
                        delete peerConnections.current[data.studentId];
                        setStudentStreams(prevStreams => {
                            const next = { ...prevStreams };
                            delete next[data.studentId];
                            return next;
                        });
                    }
                }
                else if (data.eventType === 'CONNECTED' || data.eventType === 'FOCUS_GAINED') {
                    newStatus = 'focused';
                }

                return {
                    ...prev,
                    [data.studentId]: {
                        name: data.studentName,
                        email: current?.email || 'Loading...',
                        picture: data.studentPicture || current?.picture,
                        status: newStatus,
                        lastUpdate: new Date().toISOString(),
                        score: newStatus === 'submitted' ? data.score ?? current?.score : current?.score,
                        totalQuestions: newStatus === 'submitted' ? data.totalQuestions ?? current?.totalQuestions : current?.totalQuestions,
                    }
                };
            });
        });

        const handleStatusSyncRequest = () => {
            // If another lecturer requests sync, we might need to re-initiate?
            // Usually only one lecturer at a time, but to be safe:
        };
        socket.on('status_sync_request', handleStatusSyncRequest);

        socket.on('exam_deleted', () => {
            alert("This assessment has been deleted.");
            window.location.href = '/';
        });

        return () => {
            socket.off('connect', handleConnect);
            socket.off('monitor_update');
            socket.off('exam_deleted');
            socket.off('webrtc_ready', handleWebRTCReady);
            socket.off('status_sync_request', handleStatusSyncRequest);
            Object.values(peerConnections.current).forEach(pc => pc.close());
        };
    }, [examId]);

    const triggerSync = () => {
        socket.emit('request_status_sync', { examId });
    };

    const startExam = async () => {
        if (!exam) return;
        const isFuture = !!(exam.status === 'active' && exam.start_time && new Date(exam.start_time) > new Date());

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
            const res = await axios.post(`${API_BASE_URL}/api/exams/${examId}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast.success('Exam Started', `Exam started at ${new Date(res.data.start_time).toLocaleTimeString()}`);
            fetchExamAndParticipants();
        } catch (err) {
            console.error('Failed to start exam', err);
            showToast.error('Error', 'Failed to start exam');
        }
    };

    const stopExam = async () => {
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
            await axios.patch(`${API_BASE_URL}/api/exams/${examId}/status`,
                { status: 'closed', force: exam.allow_late_submission === 1 },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            showToast.success('Success', 'Exam has been stopped.');
            fetchExamAndParticipants();
        } catch (err) {
            console.error('Failed to stop exam', err);
            showToast.error('Error', 'Failed to stop exam');
        }
    };

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (exam && exam.status === 'active' && exam.start_time) {
            const startTime = new Date(exam.start_time).getTime();
            const durationMs = (exam.duration_minutes || 0) * 60000;
            const endTime = startTime + durationMs;

            const updateTimer = () => {
                const now = Date.now();
                const diff = Math.floor((endTime - now) / 1000);
                setTimeLeft(diff);
            };

            updateTimer();
            interval = setInterval(updateTimer, 1000);
        } else {
            setTimeLeft(null);
        }
        return () => clearInterval(interval);
    }, [exam]);

    const formatTimeLeft = (seconds: number) => {
        const absSecs = Math.abs(seconds);
        const h = Math.floor(absSecs / 3600);
        const m = Math.floor((absSecs % 3600) / 60);
        const s = absSecs % 60;
        const timeStr = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return seconds < 0 ? `-${timeStr}` : timeStr;
    };

    useEffect(() => {
        const terminal = document.getElementById('terminal-logs');
        if (terminal) {
            terminal.scrollTo({
                top: terminal.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [liveLogs]);

    const handleExportResults = () => {
        const token = localStorage.getItem('token');
        window.open(`${API_BASE_URL}/api/exams/${examId}/results/export?token=${token}`, '_blank');
    };

    const handleExportLogs = () => {
        const token = localStorage.getItem('token');
        window.open(`${API_BASE_URL}/api/exams/${examId}/logs/export?token=${token}`, '_blank');
    };

    const handleResetResults = async () => {
        const confirmResult = await showToast.question(
            t('reset_confirm'),
            t('reset_text'),
            t('reset_results'),
            t('cancel')
        );

        if (!confirmResult.isConfirmed) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/exams/${examId}/submissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await showToast.success(t('success'), "Results have been reset successfully.");
            window.location.reload();
        } catch (err) {
            console.error("Failed to reset results:", err);
            showToast.error(t('error'), "Failed to reset results. Please try again.");
        }
    };

    const stats = useMemo(() => {
        const students = Object.values(studentStatus);
        const total = students.length;
        const submitted = students.filter(s => s.status === 'submitted').length;
        const active = students.filter(s => s.status === 'focused').length;
        const away = students.filter(s => s.status === 'away').length;

        // User requested only submitted students for score stats
        const relevantStudents = students.filter(s => s.status === 'submitted' && s.score !== undefined);
        const scores = relevantStudents.map(s => s.score as number);

        const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
        const minScore = scores.length > 0 ? Math.min(...scores) : 0;
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        return { total, submitted, active, away, maxScore, minScore, avgScore };
    }, [studentStatus]);

    return (
        <div className="page-container max-w-[1260px] mx-auto px-4 py-8 pt-2">
            <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-primary transition-all bg-surface/40 px-4 py-2 rounded-full border border-border/50 backdrop-blur-sm mb-6">
                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                <span>{t('back_to_dashboard')}</span>
            </Link>

            {/* Header Area */}
            <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 mb-3">
                        <div className="w-6 h-[1px] bg-primary/30"></div>
                        {t('real_time_monitor')}
                    </div>
                    <div className="flex items-center gap-4">
                        <h4 className="text-md md:text-md font tracking-[0.2em] text-foreground">
                            {exam?.title || 'MONITORING'}
                        </h4>
                        {exam && (
                            <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${exam.status === 'active'
                                ? (exam.start_time && new Date(exam.start_time) > new Date() ? 'bg-orange-500/5 text-orange-500 border-orange-500/20' : 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]')
                                : 'bg-red-500/5 text-red-500 border-red-500/20'
                                }`}>
                                {exam.status === 'active'
                                    ? (exam.start_time && new Date(exam.start_time) > new Date() ? t('scheduled') : '● ' + t('live_session'))
                                    : exam.status
                                }
                            </div>
                        )}
                    </div>
                    <p className="text-muted-foreground/50 text-[11px] font-bold tracking-[0.1em] uppercase mt-2 italic">{exam?.course}</p>
                </div>

                <div className="flex flex-col items-end gap-6">
                    <div className="flex items-center bg-surface/40 backdrop-blur-sm border border-border/50 rounded-full p-1 shadow-sm">
                        <div className="flex items-center mr-1">
                            {exam && (
                                <>
                                    {(exam.status !== 'active' || (exam.start_time && new Date(exam.start_time) > new Date())) && (
                                        <button onClick={startExam} className="h-8 px-4 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-sm">
                                            Start
                                        </button>
                                    )}
                                    {exam.status === 'active' && timeLeft !== null && (
                                        <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-hover/30 rounded-full ">
                                            <FontAwesomeIcon icon={faClock} className={`text-[10px] ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'opacity-30'}`} />
                                            <span className={`text-sm font-bold font-mono tabular-nums ${timeLeft < 300 ? 'text-red-500' : 'text-foreground/70'}`}>
                                                {formatTimeLeft(timeLeft)}
                                            </span>
                                        </div>
                                    )}
                                    {exam.status === 'active' && (
                                        <button onClick={stopExam} className="h-8 px-4 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all">
                                            End Session
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1 border-l border-border/50 pl-1">
                            <button onClick={() => setShowQR(true)} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all" title="QR">
                                <FontAwesomeIcon icon={faQrcode} className="text-xs" />
                            </button>
                            <Link to={`/edit-form/${examId}`} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all" title="Edit Content">
                                <FontAwesomeIcon icon={faPen} className="text-[10px]" />
                            </Link>
                            <button onClick={triggerSync} className="w-8 h-8 flex items-center justify-center rounded-full text-primary/60 hover:bg-primary/5 transition-all" title="Sync">
                                <FontAwesomeIcon icon={faRotateRight} className="text-xs" />
                            </button>
                            <button onClick={handleExportResults} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover transition-all" title="Export">
                                <FontAwesomeIcon icon={faDownload} className="text-xs" />
                            </button>
                            <button onClick={handleResetResults} className="w-8 h-8 flex items-center justify-center rounded-full text-red-400/60 hover:bg-red-500/5 transition-all" title="Reset">
                                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Subtle Stats Row */}
            <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-8">
                <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                    <span className="text-2xl font-light text-foreground">{stats.total}</span>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{t('total')}</p>
                        <p className="text-[10px] font-bold text-muted-foreground/60">Candidates</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-light text-emerald-500">{stats.active}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/40">{t('active')}</p>
                        <p className="text-[10px] font-bold text-emerald-500/60">Focused</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                    <span className="text-2xl font-light text-orange-500">{stats.away}</span>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-500/40">{t('away')}</p>
                        <p className="text-[10px] font-bold text-orange-500/60">Warnings</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                    <span className="text-2xl font-light text-indigo-500">{stats.submitted}</span>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500/40">{t('completed')}</p>
                        <p className="text-[10px] font-bold text-indigo-500/60">Finalized</p>
                    </div>
                </div>
                {
                    stats.submitted > 0 && (
                        <>
                            <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                                <span className="text-2xl font-light text-violet-500">{stats.maxScore}</span>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-500/40">{t('max_score')}</p>
                                    <p className="text-[10px] font-bold text-violet-500/60">Points</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                                <span className="text-2xl font-light text-rose-500">{stats.minScore}</span>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-500/40">{t('min_score')}</p>
                                    <p className="text-[10px] font-bold text-rose-500/60">Points</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-surface/20 px-4 py-2.5 rounded-[18px] border border-border/40">
                                <span className="text-2xl font-light text-amber-500">{stats.avgScore.toFixed(1)}</span>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/40">{t('avg_score')}</p>
                                    <p className="text-[10px] font-bold text-amber-500/60">Average</p>
                                </div>
                            </div>
                        </>
                    )
                }
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden bg-surface/40 backdrop-blur-md rounded-full border border-border/50 p-1 mb-8">
                <button
                    onClick={() => setActiveTab('participants')}
                    className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'participants' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground'}`}
                >
                    <FontAwesomeIcon icon={faUser} className="mr-2" /> Participants
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground'}`}
                >
                    <FontAwesomeIcon icon={faTerminal} className="mr-2" /> Security Logs
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1 md:gap-8">
                {/* Participants */}
                <div className={`lg:col-span-8 space-y-4 md:space-y-6 ${activeTab !== 'participants' ? 'hidden lg:block' : ''}`}>
                    <h2 className="hidden lg:flex text-xs font-bold uppercase tracking-widest text-muted-foreground items-center gap-2">
                        <FontAwesomeIcon icon={faUser} className="text-sm text-primary" /> Active Participants
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                        {Object.keys(studentStatus).length === 0 ? (
                            <div className="col-span-full py-20 text-center bg-surface/20 border border-dashed border-border/50 rounded-[32px]">
                                <FontAwesomeIcon icon={faShieldHalved} className="text-5xl mx-auto mb-6 text-muted-foreground opacity-20" />
                                <p className="text-muted-foreground/60 text-[11px] font-bold uppercase tracking-[0.2em] italic">
                                    Waiting for student connections...
                                </p>
                            </div>
                        ) : (
                            Object.entries(studentStatus)
                                .sort(([, a], [, b]) => {
                                    // Priority: focused > away > offline > submitted
                                    const statusOrder: Record<StudentState['status'], number> = { focused: 0, away: 1, offline: 2, submitted: 3 };
                                    const orderA = statusOrder[a.status] ?? 4;
                                    const orderB = statusOrder[b.status] ?? 4;
                                    if (orderA !== orderB) return orderA - orderB;
                                    return (a.name || '').localeCompare(b.name || '');
                                })
                                .map(([id, info]) => (
                                    <motion.div
                                        key={id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`group relative flex flex-col p-2 rounded-2xl border transition-all duration-300 ${info.status === 'offline'
                                            ? 'bg-surface/10 border-border/20 opacity-60'
                                            : 'bg-surface/30 hover:bg-surface/40 border-border/50 backdrop-blur-sm shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div
                                                onClick={() => initiateConnection(id)}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer border shadow-sm transition-all ${info.status === 'away' ? 'border-orange-500/50' :
                                                    info.status === 'submitted' ? 'border-indigo-500/50' :
                                                        info.status === 'offline' ? 'border-border/50' :
                                                            'border-emerald-500/50'
                                                    }`}
                                            >
                                                {studentStreams[id] && exam?.enable_video_proctoring === 1 ? (
                                                    <VideoPlayer stream={studentStreams[id]} />
                                                ) : info.picture ? (
                                                    <img src={info.picture} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-surface-hover flex items-center justify-center">
                                                        <span className="text-xs font-black text-muted-foreground/40 uppercase">
                                                            {info.name?.charAt(0)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${info.status === 'offline' ? 'bg-surface/20 border-border/30' :
                                                info.status === 'away' ? 'bg-orange-500/5 border-orange-500/20 shadow-[0_0_10px_-4px_rgba(249,115,22,0.3)]' :
                                                    info.status === 'submitted' ? 'bg-indigo-500/5 border-indigo-500/20' :
                                                        'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_10px_-4px_rgba(16,185,129,0.3)]'
                                                }`}>
                                                <span className={`w-1 h-1 rounded-full ${info.status === 'offline' ? 'bg-muted-foreground/40' :
                                                    info.status === 'away' ? 'bg-orange-500 animate-pulse' :
                                                        info.status === 'submitted' ? 'bg-indigo-500' :
                                                            'bg-emerald-500 animate-pulse'
                                                    }`} />
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${info.status === 'offline' ? 'text-muted-foreground/60' :
                                                    info.status === 'away' ? 'text-orange-500' :
                                                        info.status === 'submitted' ? 'text-indigo-500' :
                                                            'text-emerald-500'
                                                    }`}>
                                                    {info.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col min-w-0">
                                            <h3 className="text-[11px] font-bold text-foreground truncate tracking-tight uppercase mb-0.5">{info.name}</h3>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[9px] text-muted-foreground/40 truncate font-bold uppercase tracking-widest">{info.email?.split('@')[0]}</p>
                                                {info.status === 'submitted' && info.score !== undefined && (
                                                    <span className="text-[9px] font-black text-emerald-500/80 whitespace-nowrap">
                                                        {info.score}/{info.totalQuestions}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                        )}
                    </div>
                </div>

                {/* Activity Feed */}
                <div className={`lg:col-span-4 space-y-4 ${activeTab !== 'logs' ? 'hidden lg:block' : ''}`}>
                    <h2 className="flex text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 items-center gap-2 mb-4">
                        <FontAwesomeIcon icon={faTerminal} className="text-primary/40" /> {t('security_activity')}
                    </h2>
                    <div className="bg-surface/30 backdrop-blur-md border border-border/50 rounded-[32px] h-[600px] flex flex-col overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border/50 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">TELEMETRY STREAM</span>
                            <div className="flex gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/40"></span>
                                <span className="w-2 h-2 rounded-full bg-orange-500/20 border border-orange-500/40"></span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500/20 border border-emerald-500/40"></span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide" id="terminal-logs">
                            <AnimatePresence initial={false}>
                                {liveLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-20">
                                        <FontAwesomeIcon icon={faShieldHalved} className="text-5xl" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">System Monitoring Inactive</p>
                                    </div>
                                ) : (
                                    liveLogs.slice().reverse().map((log, idx) => (
                                        <motion.div
                                            key={`${log.studentId}-${log.timestamp}-${idx}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-start gap-4 text-[11px]"
                                        >
                                            <span className="text-muted-foreground/30 font-mono tabular-nums shrink-0 mt-0.5 text-[10px]">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="leading-relaxed">
                                                    <span className="font-bold text-foreground/70 uppercase tracking-tight">{log.studentName} : </span>
                                                    {/* <span className="mx-2 text-muted-foreground/20 italic">has transitioned to</span> */}
                                                    <span className={`font-black uppercase tracking-widest text-[10px] ${log.eventType === 'FOCUS_LOST' ? 'text-orange-500' :
                                                        log.eventType === 'SUBMITTED' ? 'text-indigo-500' :
                                                            log.eventType === 'DISCONNECTED' ? 'text-red-500' :
                                                                'text-emerald-500'
                                                        }`}>
                                                        {log.eventType.replace('_', ' ')}
                                                    </span>
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== QR CODE MODAL ========== */}
            <AnimatePresence>
                {showQR && exam && (() => {
                    const examUrl = `${window.location.origin}/app/take-form/${examId}`;
                    return (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-background/90 backdrop-blur-md"
                                onClick={() => setShowQR(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.85 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                className="w-full max-w-sm bg-card border border-border rounded-3xl relative overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-5 sm:p-6 border-b border-border bg-surface/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                                <FontAwesomeIcon icon={faQrcode} className="text-violet-500 text-base" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black tracking-tight truncate">{exam.title}</h3>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Share QR Code</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowQR(false)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface transition-colors text-muted-foreground flex-shrink-0 ml-2"
                                        >
                                            <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                        </button>
                                    </div>
                                </div>

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
                                        Students can scan this QR code to access the assessment session directly.
                                    </p>
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

                                <div className="p-4 sm:p-5 border-t border-border bg-surface/30 flex justify-end">
                                    <button
                                        onClick={() => setShowQR(false)}
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

export default MonitoringDashboard;
