import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KEYPAD_CONFIG, APP_TITLE, APP_SUBTITLE } from './constants';
import KeyButton from './components/KeyButton';
import { Bot, Settings, Mic, Upload, Play, Trash2, Plus, X, Check, StopCircle, LayoutGrid, Edit3, ChevronRight, ChevronLeft, Download, Database, CheckCircle, AlertCircle, Globe, Copy, Image as ImageIcon, Type } from 'lucide-react';
import { KeyConfig, KeyColor, AppSettings, ToyConfig, GlobalState } from './types';
import { saveGlobalState, loadGlobalState, exportAllData, exportSingleToy, importData } from './utils/storage';
import { playBuffer, decodeAudio, trimAndNormalize, audioBufferToWav, getAudioContext, ensureAudioContextStarted } from './utils/audio';
import { getDarkerColor, getContrastingTextColor } from './utils/colorUtils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, TouchSensor, MouseSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableKeyButton from './components/SortableKeyButton';
import pkg from '../package.json';

const App: React.FC = () => {
    const { t, i18n } = useTranslation();

    // --- State ---
    const [toys, setToys] = useState<ToyConfig[]>([
        {
            id: 'toy_default',
            name: t('default_toy_name'),
            settings: { caseColor: 'yellow' },
            buttons: KEYPAD_CONFIG.map(btn => ({
                ...btn,
                text: t(btn.id as any) || btn.text
            }))
        }
    ]);
    const [activeToyId, setActiveToyId] = useState<string>('toy_default');
    const [isEditing, setIsEditing] = useState(false);
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // --- New State for Recording Enhancements ---
    const [audioLevel, setAudioLevel] = useState(0);
    const [pendingRecording, setPendingRecording] = useState<{ id: string; blob: Blob; url: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- New State for Edit Mode Preview ---
    const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
    const [previewProgress, setPreviewProgress] = useState(0);

    // --- New State for Focus Editing ---
    const [editingButtonId, setEditingButtonId] = useState<string | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    // --- Dnd Sensors ---
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: any) => {
        setActiveDragId(event.active.id);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = buttons.findIndex((b) => b.id === active.id);
            const newIndex = buttons.findIndex((b) => b.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                updateToy(activeToyId, { buttons: arrayMove(buttons, oldIndex, newIndex) });
            }
        }

        setActiveDragId(null);
    };

    const handleDragCancel = () => {
        setActiveDragId(null);
    };

    // --- Derived State ---
    const activeToy = toys.find(t => t.id === activeToyId) || toys[0];
    const buttons = activeToy.buttons;
    const settings = activeToy.settings;
    const editingButton = buttons.find(b => b.id === editingButtonId);

    // Set default editing button
    useEffect(() => {
        if (isEditing && !editingButtonId && buttons.length > 0) {
            setEditingButtonId(buttons[0].id);
        }
    }, [isEditing, buttons, editingButtonId]);

    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioBuffersRef = useRef<{ [key: string]: AudioBuffer }>({});
    const lastUrlsRef = useRef<{ [key: string]: string | null }>({});
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // --- Persistence ---
    useEffect(() => {
        loadGlobalState().then((data) => {
            if (data && data.toys.length > 0) {
                setToys(data.toys);
                setActiveToyId(data.activeToyId);
            }
            setIsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (isLoaded) {
            saveGlobalState({ toys, activeToyId });
        }
    }, [toys, activeToyId, isLoaded]);

    // --- Audio Logic: Caching (Only for current toy's buttons for performance) ---
    useEffect(() => {
        if (!isLoaded) return;

        const syncAudio = async () => {
            const currentButtons = [...buttons];
            for (const btn of currentButtons) {
                if (btn.audioUrl && btn.audioUrl !== lastUrlsRef.current[btn.id]) {
                    try {
                        const response = await fetch(btn.audioUrl);
                        const arrayBuffer = await response.arrayBuffer();
                        const audioBuffer = await decodeAudio(arrayBuffer);
                        audioBuffersRef.current[btn.id] = audioBuffer;
                        lastUrlsRef.current[btn.id] = btn.audioUrl;
                    } catch (e) {
                        console.error(`Failed to decode audio for button ${btn.id}`, e);
                    }
                } else if (!btn.audioUrl) {
                    delete audioBuffersRef.current[btn.id];
                    delete lastUrlsRef.current[btn.id];
                }
            }
        };

        syncAudio();
    }, [buttons, isLoaded]);

    // --- Audio Logic: Playback ---
    const playSound = useCallback((config: KeyConfig) => {
        const buffer = audioBuffersRef.current[config.id];
        if (buffer) {
            playBuffer(buffer);
        } else if (config.audioUrl) {
            const audio = new Audio(config.audioUrl);
            audio.play().catch(e => console.error("Playback failed:", e));
        }
    }, []);

    // --- Audio Logic: Recording ---
    const startRecording = async (id: string) => {
        try {
            await ensureAudioContextStarted();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Setup Analyser for Visualization
            const ctx = getAudioContext();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const updateLevel = () => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                if (analyserRef.current) {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    setAudioLevel(Math.min(1, average / 128));
                    animationFrameRef.current = requestAnimationFrame(updateLevel);
                }
            };
            updateLevel();

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                analyserRef.current = null;

                // Final safety: clear recording ID here too
                setRecordingId(null);
                setAudioLevel(0);

                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    setPendingRecording({ id, blob: audioBlob, url: audioUrl });
                }

                stream.getTracks().forEach(track => {
                    try { track.stop(); } catch (e) { }
                });
            };

            mediaRecorder.start();
            setRecordingId(id);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            showToast(t('mic_error'), "error");
            setRecordingId(null);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                console.error("Failed to stop media recorder", e);
                // Force state cleanup even if stop() fails
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                setRecordingId(null);
                setAudioLevel(0);
            }
        } else {
            // Already inactive or never started
            setRecordingId(null);
            setAudioLevel(0);
        }
    };

    // --- Edit Mode Preview Logic ---
    const toggleButtonPreview = (id: string, url: string) => {
        if (previewPlayingId === id) {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
            setPreviewPlayingId(null);
            setPreviewProgress(0);
        } else {
            // Stop any existing preview
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
            }

            const audio = new Audio(url);
            previewAudioRef.current = audio;
            setPreviewPlayingId(id);
            setPreviewProgress(0);

            audio.ontimeupdate = () => {
                const progress = (audio.currentTime / audio.duration) * 100;
                setPreviewProgress(isNaN(progress) ? 0 : progress);
            };

            audio.onended = () => {
                setPreviewPlayingId(null);
                setPreviewProgress(0);
                previewAudioRef.current = null;
            };

            audio.play().catch(e => {
                console.error("Preview playback failed", e);
                setPreviewPlayingId(null);
            });
        }
    };

    const savePendingRecording = async () => {
        if (!pendingRecording) return;
        setIsProcessing(true);
        try {
            const arrayBuffer = await pendingRecording.blob.arrayBuffer();
            const originalBuffer = await decodeAudio(arrayBuffer);

            // Process: Trim and Normalize
            const processedBuffer = trimAndNormalize(originalBuffer);
            const processedBlob = audioBufferToWav(processedBuffer);
            const processedUrl = URL.createObjectURL(processedBlob);

            updateButton(pendingRecording.id, { audioUrl: processedUrl });
            setPendingRecording(null);
            showToast(t('save_success'), "success");
        } catch (e) {
            console.error("Failed to process recording", e);
            showToast(t('process_error'), "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const audioUrl = URL.createObjectURL(file);
        updateButton(id, { audioUrl });
    };

    const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Resize image to max 300x300
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > 300 || height > 300) {
                    if (width > height) {
                        height = Math.round((height *= 300 / width));
                        width = 300;
                    } else {
                        width = Math.round((width *= 300 / height));
                        height = 300;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const imageUrl = URL.createObjectURL(blob);
                        updateButton(id, { imageUrl });
                    }
                }, 'image/jpeg', 0.85);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const removeImage = (id: string) => {
        updateButton(id, { imageUrl: null });
    };

    // --- Data Management: Toys ---
    const addToy = () => {
        const newId = `toy_${Date.now()}`;
        const newToy: ToyConfig = {
            id: newId,
            name: `${t('default_toy_name')} ${toys.length + 1}`,
            settings: { caseColor: 'yellow' },
            buttons: []
        };
        setToys([...toys, newToy]);
        setActiveToyId(newId);
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const removeToy = (id: string) => {
        if (toys.length <= 1) return;
        const newToys = toys.filter(t => t.id !== id);
        setToys(newToys);
        if (activeToyId === id) {
            setActiveToyId(newToys[0].id);
        }
    };

    const updateToy = (id: string, updates: Partial<ToyConfig>) => {
        setToys(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const updateActiveSettings = (updates: Partial<AppSettings>) => {
        updateToy(activeToyId, { settings: { ...settings, ...updates } });
    };

    // --- Data Management: Buttons ---
    const updateButton = (id: string, updates: Partial<KeyConfig>) => {
        const newButtons = buttons.map(b => b.id === id ? { ...b, ...updates } : b);
        updateToy(activeToyId, { buttons: newButtons });
    };

    const addButton = () => {
        const newId = `btn_${Date.now()}`;
        const newButton: KeyConfig = {
            id: newId,
            text: '',
            color: 'white',
            audioUrl: null
        };
        updateToy(activeToyId, { buttons: [...buttons, newButton] });
        setEditingButtonId(newId);
    };

    const removeButton = (id: string) => {
        const index = buttons.findIndex(b => b.id === id);
        const newButtons = buttons.filter(b => b.id !== id);
        updateToy(activeToyId, { buttons: newButtons });

        if (editingButtonId === id) {
            if (newButtons.length > 0) {
                const nextIndex = Math.min(index, newButtons.length - 1);
                setEditingButtonId(newButtons[nextIndex].id);
            } else {
                setEditingButtonId(null);
            }
        }
    };

    const duplicateButton = (id: string) => {
        const index = buttons.findIndex(b => b.id === id);
        if (index === -1) return;

        const originalButton = buttons[index];
        const newId = `btn_${Date.now()}`;
        const newButton: KeyConfig = {
            ...originalButton,
            id: newId
        };

        const newButtons = [...buttons];
        newButtons.splice(index + 1, 0, newButton);

        updateToy(activeToyId, { buttons: newButtons });
        setEditingButtonId(newId);
    };

    const deleteAudio = (id: string) => {
        updateButton(id, { audioUrl: null });
    };

    const handleExport = async () => {
        try {
            const json = await exportAllData({ toys, activeToyId });
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fun-button-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export failed", e);
            showToast(t('export_failed'), "error");
        }
    };

    const handleExportToy = async (toy: ToyConfig) => {
        try {
            const json = await exportSingleToy(toy);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `toy-${toy.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Single export failed", e);
            showToast(t('export_toy_failed'), "error");
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const content = event.target?.result as string;
                    const newState = await importData(content, toys);
                    setToys(newState.toys);
                    setActiveToyId(newState.activeToyId);
                    showToast(t('import_success'), "success");
                } catch (err) {
                    console.error("Import parsing failed", err);
                    showToast(t('import_failed_format'), "error");
                }
            };
            reader.readAsText(file);
        } catch (e) {
            console.error("Import failed", e);
            showToast(t('import_read_failed'), "error");
        }
        // Reset input
        e.target.value = '';
    };

    // --- Layout Helpers ---
    const gridCols = buttons.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
    const containerWidth = buttons.length <= 4 ? 'max-w-[320px]' : 'max-w-[480px]';
    const ALL_COLORS: KeyColor[] = ['white', 'yellow', 'blue', 'red', 'green', 'purple', 'orange'];

    const getCaseStyles = (color: string) => {
        const isPredefinedColor = ['white', 'yellow', 'blue', 'red', 'green', 'purple', 'orange'].includes(color);

        if (isPredefinedColor) {
            switch (color) {
                case 'yellow': return { outer: 'bg-[#FFD66B] border-[#E5BC45]', inner: 'bg-[#E5BC45]', text: 'text-yellow-900/50' };
                case 'blue': return { outer: 'bg-[#A7C7E7] border-[#86A6C6]', inner: 'bg-[#86A6C6]', text: 'text-blue-900/50' };
                case 'red': return { outer: 'bg-[#FFB7B2] border-[#DF9792]', inner: 'bg-[#DF9792]', text: 'text-red-900/50' };
                case 'green': return { outer: 'bg-[#B4E4B4] border-[#94C494]', inner: 'bg-[#94C494]', text: 'text-green-900/50' };
                case 'purple': return { outer: 'bg-[#D1C4E9] border-[#B1A4C9]', inner: 'bg-[#B1A4C9]', text: 'text-purple-900/50' };
                case 'orange': return { outer: 'bg-[#FFCCBC] border-[#DFAC9C]', inner: 'bg-[#DFAC9C]', text: 'text-orange-900/50' };
                default: return { outer: 'bg-[#F0F4F8] border-[#CED4DA]', inner: 'bg-[#CED4DA]', text: 'text-gray-900/50' };
            }
        } else {
            // Dynamic generation for custom colors
            // Outer casing is the main color
            // Border is darker version
            // Inner keypad area is slightly darker than main color to create depth
            // Text color is high contrast

            // Note: We use inline styles for dynamic colors, so here we return empty or generic classes 
            // and handle the specific colors via style props in the JSX where needed.
            // BUT, for the layout to work, we need to return valid object. 
            // However, the current implementation of caseStyles usage is class-based. 
            // We need to refactor the usage site slightly or generate classes on fly which is hard with Tailwind.
            // Better approach: Return a specific object that indicates custom color, and handle it in the return JSX.

            // Actually, we can just return generic structure and use `style` attribute on the elements.
            // Let's modify the usage site to accept style objects.
            return {
                isCustom: true,
                color: color,
                borderColor: getDarkerColor(color),
                innerColor: getDarkerColor(color, 0.05), // Inner part slightly darker
                textColor: getContrastingTextColor(color) === 'black' ? 'text-black/50' : 'text-white/50'
            };
        }
    };

    const caseStyles = getCaseStyles(settings.caseColor);

    return (
        <div className="min-h-screen bg-[#e0e5ec] text-gray-800 flex flex-col items-center py-8 px-4 sm:px-6 relative overflow-y-auto">
            {/* Background blobs */}
            <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-200/30 rounded-full blur-3xl pointer-events-none" />

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`px-4 py-3 rounded-2xl shadow-lg backdrop-blur-md flex items-center gap-3 border ${toast.type === 'success'
                        ? 'bg-white/80 border-green-100 text-green-800'
                        : 'bg-white/80 border-red-100 text-red-800'
                        }`}>
                        {toast.type === 'success' ? <CheckCircle size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}
                        <span className="text-sm font-bold tracking-tight">{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="mb-8 text-center relative z-10 mt-4 w-full max-w-2xl flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4 px-4">
                    <div className="w-10"></div>
                    <div className="flex flex-col items-center">
                        <div className="inline-flex items-center justify-center p-3 bg-white rounded-full shadow-md mb-2">
                            <Bot className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900 leading-none">{t('app_title')}</h1>
                        <p className="text-gray-500 font-medium text-sm">{t('app_subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh-TW' : 'en')}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
                            title={t('language')}
                        >
                            <Globe size={18} />
                        </button>
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isEditing ? 'bg-blue-500 text-white shadow-inner' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'}`}
                        >
                            {isEditing ? <Check size={20} /> : <Settings size={20} />}
                        </button>
                    </div>
                </div>

                {/* Toy Selector Bar */}
                {!isEditing && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full max-w-md px-4 scrollbar-hide no-scrollbar">
                        {toys.map(toy => (
                            <button
                                key={toy.id}
                                onClick={() => setActiveToyId(toy.id)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeToyId === toy.id ? 'bg-gray-800 text-white shadow-md' : 'bg-white/50 text-gray-500 hover:bg-white'}`}
                            >
                                {toy.name}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            <main className="flex-1 w-full flex flex-col items-center justify-start relative z-10 pb-20">
                {isEditing ? (
                    <div className="w-full max-w-lg space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Manage Toys */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/50">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <LayoutGrid size={16} /> {t('manage_toys')}
                            </h2>
                            <div className="space-y-3">
                                {toys.map(toy => (
                                    <div
                                        key={toy.id}
                                        onClick={() => setActiveToyId(toy.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group/toy ${activeToyId === toy.id ? 'bg-blue-50/50 border-blue-400 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                                    >
                                        <div className="flex-1 flex flex-col">
                                            <input
                                                className="bg-transparent font-bold text-sm focus:outline-none cursor-text"
                                                value={toy.name}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => updateToy(toy.id, { name: e.target.value })}
                                            />
                                            <span className="text-[10px] text-gray-400">{t('toy_count', { count: toy.buttons.length })}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleExportToy(toy); }}
                                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-white rounded-lg transition-colors"
                                                title={t('export_toy')}
                                            >
                                                <Download size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeToy(toy.id); }}
                                                disabled={toys.length <= 1}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-colors disabled:opacity-0"
                                                title={t('delete_toy')}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={addToy}
                                    className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-gray-400 text-sm font-semibold flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-500 transition-colors"
                                >
                                    <Plus size={16} /> {t('add_toy')}
                                </button>
                            </div>
                        </div>

                        {/* Data Management */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/50">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Database size={16} /> {t('data_management')}
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleExport}
                                    className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    <Download size={16} className="text-blue-500" /> {t('export')}
                                </button>
                                <label className="flex items-center justify-center gap-2 py-3 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
                                    <Upload size={16} className="text-green-500" /> {t('import')}
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={handleImport}
                                    />
                                </label>
                            </div>
                            <p className="mt-3 text-[10px] text-gray-400 text-center">{t('export_hint')}</p>
                        </div>

                        {/* Active Toy Settings */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/50">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t('settings_title', { name: activeToy.name })}</h2>
                            <label className="text-xs text-gray-400 font-semibold mb-2 block">{t('case_color')}</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => updateActiveSettings({ caseColor: c })}
                                        className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-95 ${settings.caseColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                                        style={{
                                            backgroundColor:
                                                c === 'white' ? '#F0F4F8' :
                                                    c === 'yellow' ? '#F3E388' :
                                                        c === 'blue' ? '#A7C7E7' :
                                                            c === 'red' ? '#FFB7B2' :
                                                                c === 'green' ? '#B4E4B4' :
                                                                    c === 'purple' ? '#D1C4E9' : '#FFCCBC'
                                        }}
                                    />
                                ))}
                                <div className="relative">
                                    <button
                                        className={`w-8 h-8 rounded-full border-2 transition-all active:scale-90 flex items-center justify-center bg-gray-100 ${!ALL_COLORS.includes(settings.caseColor as any) ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent shadow-sm'}`}
                                        style={!ALL_COLORS.includes(settings.caseColor as any) ? { backgroundColor: settings.caseColor } : { background: 'conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #00FF00 120deg, #0000FF 240deg, #FF0000 360deg)' }}
                                    >
                                        {!ALL_COLORS.includes(settings.caseColor as any) ? null : <div className="w-3 h-3 rounded-full bg-white/50 backdrop-blur-sm" />}
                                    </button>
                                    <input
                                        type="color"
                                        value={!ALL_COLORS.includes(settings.caseColor as any) ? settings.caseColor : '#ffffff'}
                                        onChange={(e) => updateActiveSettings({ caseColor: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                <label className="text-xs text-gray-400 font-semibold">{t('title_color_label')}</label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex items-center gap-1 cursor-pointer bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                                        <Type size={14} className="transition-colors" style={{ color: settings.titleColor || '#9CA3AF' }} />
                                        <input
                                            type="color"
                                            value={settings.titleColor || '#000000'}
                                            onChange={(e) => updateActiveSettings({ titleColor: e.target.value })}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    {settings.titleColor && (
                                        <button
                                            onClick={() => updateActiveSettings({ titleColor: null })}
                                            className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider px-2 py-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            {t('auto_color')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                <label className="text-xs text-gray-400 font-semibold">{t('sound_type_label')}</label>
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => updateActiveSettings({ soundType: 'default' })}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${(!settings.soundType || settings.soundType === 'default') ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {t('sound_default')}
                                    </button>
                                    <button
                                        onClick={() => updateActiveSettings({ soundType: 'keyboard' })}
                                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${settings.soundType === 'keyboard' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {t('sound_keyboard')}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                                <label className="text-xs text-gray-400 font-semibold">{t('glow_type_label')}</label>
                                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl">
                                    {(['none', 'backlit', 'bloom', 'surface', 'aura'] as const).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => updateActiveSettings({ glowType: type })}
                                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${((!settings.glowType && type === 'none') || settings.glowType === type) ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {t(`glow_${type}` as any)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Interactive Preview Container */}
                        <div className="flex flex-col items-center py-4 bg-white/40 backdrop-blur-md rounded-3xl border border-white/50 shadow-inner overflow-hidden">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragCancel={handleDragCancel}
                            >
                                <div className={`relative group perspective-1000 transform transition-all duration-300 scale-90 sm:scale-100 ${containerWidth}`}>
                                    <div
                                        className={`${!caseStyles.isCustom ? caseStyles.outer : ''} p-5 pb-7 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] border-b-[8px] transition-all duration-300`}
                                        style={caseStyles.isCustom ? {
                                            backgroundColor: caseStyles.color,
                                            borderColor: caseStyles.borderColor,
                                            color: caseStyles.textColor
                                        } : {}}
                                    >
                                        <h2
                                            className={`mb-3 text-center font-black uppercase tracking-tighter text-sm ${!caseStyles.isCustom && caseStyles.text}`}
                                            style={{
                                                ...(caseStyles.isCustom ? { color: caseStyles.textColor } : {}),
                                                ...(settings.titleColor ? { color: settings.titleColor } : {})
                                            }}
                                        >
                                            {activeToy.name}
                                        </h2>
                                        <div
                                            className={`grid ${gridCols} gap-4 ${!caseStyles.isCustom && caseStyles.inner} p-2 rounded-2xl transition-all duration-300`}
                                            style={caseStyles.isCustom ? { backgroundColor: caseStyles.innerColor } : {}}
                                        >
                                            <SortableContext
                                                items={buttons.map(b => b.id)}
                                                strategy={rectSortingStrategy}
                                            >
                                                {buttons.map((config) => (
                                                    <SortableKeyButton
                                                        key={config.id}
                                                        id={config.id}
                                                        config={config}
                                                        onClick={(c) => setEditingButtonId(c.id)}
                                                        isSelected={editingButtonId === config.id}
                                                        isActive={previewPlayingId === config.id}
                                                        isEditing={isEditing}
                                                        soundType={settings.soundType}
                                                        glowType={settings.glowType}
                                                    />
                                                ))}
                                            </SortableContext>
                                            {buttons.length === 0 && (
                                                <div className="col-span-2 text-center p-8 text-gray-400 font-bold">{t('no_buttons')}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DragOverlay adjustScale={true} zIndex={1000}>
                                    {activeDragId ? (
                                        <div className="w-full h-full transform scale-105 cursor-grabbing">
                                            <KeyButton
                                                config={buttons.find(b => b.id === activeDragId)!}
                                                onClick={() => { }}
                                                isSelected={true}
                                                soundType={settings.soundType}
                                                glowType={settings.glowType}
                                            />
                                        </div>
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={addButton}
                                    className="px-4 py-2 bg-white/80 hover:bg-white rounded-full text-xs font-bold text-gray-600 shadow-sm border border-gray-100 flex items-center gap-2 transition-all active:scale-95"
                                >
                                    <Plus size={14} /> {t('add_button')}
                                </button>
                            </div>
                        </div>

                        {/* Focus Editor Panel */}
                        {editingButton ? (
                            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] border border-white animate-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-8 rounded-full shadow-inner"
                                            style={{
                                                backgroundColor: ['white', 'yellow', 'blue', 'red', 'green', 'purple', 'orange'].includes(editingButton.color) ?
                                                    (editingButton.color === 'white' ? '#F0F4F8' :
                                                        editingButton.color === 'yellow' ? '#F3E388' :
                                                            editingButton.color === 'blue' ? '#A7C7E7' :
                                                                editingButton.color === 'red' ? '#FFB7B2' :
                                                                    editingButton.color === 'green' ? '#B4E4B4' :
                                                                        editingButton.color === 'purple' ? '#D1C4E9' : '#FFCCBC')
                                                    : editingButton.color
                                            }}
                                        />
                                        <div>
                                            <h3 className="font-black text-gray-900 leading-none">{t('edit_button_title')}</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                                {t('button_index', { current: buttons.indexOf(editingButton) + 1, total: buttons.length })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={buttons.indexOf(editingButton) === 0}
                                            onClick={() => setEditingButtonId(buttons[buttons.indexOf(editingButton) - 1].id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100 transition-colors"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <button
                                            disabled={buttons.indexOf(editingButton) === buttons.length - 1}
                                            onClick={() => setEditingButtonId(buttons[buttons.indexOf(editingButton) + 1].id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100 transition-colors"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                        <div className="w-px h-4 bg-gray-200 mx-1" />
                                        <button
                                            onClick={() => duplicateButton(editingButton.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-400 hover:bg-blue-100 hover:text-blue-500 transition-colors"
                                            title={t('duplicate')}
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            onClick={() => removeButton(editingButton.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('button_text_label')}</label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex items-center gap-1 cursor-pointer bg-gray-100 px-2 py-1.5 rounded-xl hover:bg-gray-200 transition-colors">
                                                    <Type size={14} className="transition-colors" style={{ color: editingButton.textColor || '#9CA3AF' }} />
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('text_color_label')}</span>
                                                    <input
                                                        type="color"
                                                        value={editingButton.textColor || '#000000'}
                                                        onChange={(e) => updateButton(editingButton.id, { textColor: e.target.value })}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                </div>
                                                {editingButton.textColor && (
                                                    <button
                                                        onClick={() => updateButton(editingButton.id, { textColor: null })}
                                                        className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider px-2 py-1.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                                    >
                                                        {t('auto_color')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <textarea
                                            value={editingButton.text}
                                            onChange={(e) => updateButton(editingButton.id, { text: e.target.value })}
                                            placeholder={t('new_button_placeholder')}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all h-[60px] shadow-inner"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">{t('button_color_label')} & {t('button_image_label')}</label>
                                            {editingButton.imageUrl && (
                                                <button
                                                    onClick={() => removeImage(editingButton.id)}
                                                    className="text-[10px] text-red-400 hover:text-red-500 font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    <X size={12} /> {t('remove_image')}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-3 p-1 items-center">
                                            {ALL_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() => updateButton(editingButton.id, { color: c })}
                                                    className={`w-10 h-10 rounded-2xl border-2 transition-all active:scale-90 ${editingButton.color === c ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent shadow-sm'}`}
                                                    style={{
                                                        backgroundColor:
                                                            c === 'white' ? '#F0F4F8' :
                                                                c === 'yellow' ? '#F3E388' :
                                                                    c === 'blue' ? '#A7C7E7' :
                                                                        c === 'red' ? '#FFB7B2' :
                                                                            c === 'green' ? '#B4E4B4' :
                                                                                c === 'purple' ? '#D1C4E9' : '#FFCCBC'
                                                    }}
                                                />
                                            ))}
                                            <div className="relative">
                                                <button
                                                    className={`w-10 h-10 rounded-2xl border-2 transition-all active:scale-90 flex items-center justify-center bg-gray-100 ${!ALL_COLORS.includes(editingButton.color as any) ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent shadow-sm'}`}
                                                    style={!ALL_COLORS.includes(editingButton.color as any) ? { backgroundColor: editingButton.color } : { background: 'conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #00FF00 120deg, #0000FF 240deg, #FF0000 360deg)' }}
                                                >
                                                    {!ALL_COLORS.includes(editingButton.color as any) ? null : <div className="w-4 h-4 rounded-full bg-white/50 backdrop-blur-sm" />}
                                                </button>
                                                <input
                                                    type="color"
                                                    value={!ALL_COLORS.includes(editingButton.color as any) ? editingButton.color : '#ffffff'}
                                                    onChange={(e) => updateButton(editingButton.id, { color: e.target.value })}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </div>

                                            <div className="w-px h-8 bg-gray-200 mx-1" />

                                            <label className={`w-10 h-10 rounded-2xl border-2 transition-all active:scale-90 flex items-center justify-center cursor-pointer overflow-hidden ${editingButton.imageUrl ? 'border-gray-800 scale-110 shadow-md bg-white' : 'border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500 bg-gray-50 text-gray-400'}`}>
                                                {editingButton.imageUrl ? (
                                                    <img src={editingButton.imageUrl} className="w-full h-full object-cover" alt="button texture" />
                                                ) : (
                                                    <ImageIcon size={18} />
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleImageUpload(editingButton.id, e)}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex items-center gap-3">
                                        <button
                                            onClick={() => editingButton.audioUrl && toggleButtonPreview(editingButton.id, editingButton.audioUrl)}
                                            disabled={!editingButton.audioUrl}
                                            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${editingButton.audioUrl ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-gray-100 text-gray-300'}`}
                                            style={previewPlayingId === editingButton.id ? {
                                                background: `linear-gradient(to right, #22c55e ${previewProgress}%, #4ade80 ${previewProgress}%)`
                                            } : {}}
                                        >
                                            {previewPlayingId === editingButton.id ? <StopCircle size={20} /> : <Play size={20} />}
                                            {previewPlayingId === editingButton.id ? t('stop') : t('listen')}
                                        </button>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => recordingId === editingButton.id ? stopRecording() : startRecording(editingButton.id)}
                                                className={`p-4 rounded-2xl font-black transition-all active:scale-[0.98] shadow-md ${recordingId === editingButton.id ? 'bg-red-500 text-white animate-pulse' : 'bg-white border border-gray-100 text-gray-700 hover:bg-gray-50'}`}
                                            >
                                                {recordingId === editingButton.id ? <StopCircle size={20} /> : <Mic size={20} />}
                                            </button>

                                            <label className="p-4 rounded-2xl bg-white border border-gray-100 text-gray-700 shadow-md hover:bg-gray-50 transition-all active:scale-[0.98] cursor-pointer">
                                                <Upload size={20} />
                                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(editingButton.id, e)} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white/40 backdrop-blur-md rounded-3xl border border-dashed border-gray-300 text-gray-400 font-bold">
                                {t('select_button_hint')}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className={`relative group perspective-1000 transform transition-transform duration-300 ${containerWidth} mt-12`}>
                        <>
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-16 h-16 border-[6px] border-gray-300 rounded-full z-0 transform -translate-y-2" />
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-8 bg-gray-300 rounded-full z-0" />
                        </>
                        <div
                            className={`${!caseStyles.isCustom ? caseStyles.outer : ''} p-5 pb-7 rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] border-b-[8px] transition-all duration-300`}
                            style={caseStyles.isCustom ? {
                                backgroundColor: caseStyles.color,
                                borderColor: caseStyles.borderColor,
                                color: caseStyles.textColor
                            } : {}}
                        >
                            <h2
                                className={`mb-3 text-center font-black uppercase tracking-tighter text-sm ${!caseStyles.isCustom && caseStyles.text}`}
                                style={{
                                    ...(caseStyles.isCustom ? { color: caseStyles.textColor } : {}),
                                    ...(settings.titleColor ? { color: settings.titleColor } : {})
                                }}
                            >
                                {activeToy.name}
                            </h2>
                            <div
                                className={`grid ${gridCols} gap-4 ${!caseStyles.isCustom && caseStyles.inner} p-2 rounded-2xl transition-all duration-300`}
                                style={caseStyles.isCustom ? { backgroundColor: caseStyles.innerColor } : {}}
                            >
                                {buttons.map((config) => (
                                    <KeyButton
                                        key={config.id}
                                        config={config}
                                        onClick={playSound}
                                        soundType={settings.soundType}
                                        glowType={settings.glowType}
                                    />
                                ))}
                                {buttons.length === 0 && (
                                    <div
                                        className={`col-span-2 text-center p-8 ${!caseStyles.isCustom && caseStyles.text} font-bold`}
                                        style={caseStyles.isCustom ? { color: caseStyles.textColor } : {}}
                                    >
                                        {t('no_buttons')}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-8 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <p className="text-gray-400 text-sm">{t('tap_to_play')}</p>
                        </div>
                    </div>
                )
                }
                <footer className="mt-12 text-gray-400 text-[10px] font-medium tracking-widest uppercase">
                    v{pkg.version}
                </footer>
            </main >

            {/* Recording Visualizer Overlay (Only shown when recording) */}
            {
                recordingId && (
                    <div
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/5 backdrop-blur-[2px] cursor-pointer"
                        onClick={() => stopRecording()}
                    >
                        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200 pointer-events-auto">
                            <div className="relative flex items-center justify-center h-24 w-48">
                                {[...Array(12)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-2 mx-0.5 rounded-full bg-red-500 transition-all duration-75"
                                        style={{
                                            height: `${Math.max(10, audioLevel * 100 * (0.5 + Math.random() * 0.5))}px`,
                                            opacity: 0.3 + audioLevel * 0.7
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse mb-2" />
                                <span className="text-lg font-black text-gray-900 tracking-tight uppercase">{t('recording')}</span>
                                <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-widest">{t('tap_to_stop')}</p>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Pending Recording Preview Modal */}
            {
                pendingRecording && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-sm border border-white flex flex-col items-center animate-in zoom-in-95 duration-300">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                                <Mic className="w-10 h-10 text-blue-500" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">{t('recording_preview')}</h3>
                            <p className="text-gray-500 text-sm mb-8 text-center">{t('preview_hint')}</p>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => {
                                        const audio = new Audio(pendingRecording.url);
                                        audio.play();
                                    }}
                                    className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                                >
                                    <Play size={20} /> {t('listen')}
                                </button>

                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <button
                                        onClick={() => setPendingRecording(null)}
                                        className="py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                                    >
                                        {t('discard')}
                                    </button>
                                    <button
                                        onClick={savePendingRecording}
                                        disabled={isProcessing}
                                        className="py-4 bg-gray-800 text-white rounded-2xl font-bold hover:bg-gray-900 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={20} />}
                                        {isProcessing ? t('processing') : t('save_recording')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default App;