import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KEYPAD_CONFIG, APP_TITLE, APP_SUBTITLE } from './constants';
import KeyButton from './components/KeyButton';
import { Bot, Settings, Mic, Upload, Play, Trash2, Plus, X, Check, StopCircle, LayoutGrid, Edit3, ChevronRight, ChevronLeft, Download, Database, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { KeyConfig, KeyColor, AppSettings, ToyConfig, GlobalState } from './types';
import { saveGlobalState, loadGlobalState, exportAllData, exportSingleToy, importData } from './utils/storage';
import { playBuffer, decodeAudio } from './utils/audio';
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

    // --- Derived State ---
    const activeToy = toys.find(t => t.id === activeToyId) || toys[0];
    const buttons = activeToy.buttons;
    const settings = activeToy.settings;

    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioBuffersRef = useRef<{ [key: string]: AudioBuffer }>({});
    const lastUrlsRef = useRef<{ [key: string]: string | null }>({});

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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                updateButton(id, { audioUrl });
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setRecordingId(id);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            showToast(t('mic_error'), "error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setRecordingId(null);
    };

    const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const audioUrl = URL.createObjectURL(file);
        updateButton(id, { audioUrl });
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
            text: t('new_button_text'),
            color: 'white',
            audioUrl: null
        };
        updateToy(activeToyId, { buttons: [...buttons, newButton] });
    };

    const removeButton = (id: string) => {
        updateToy(activeToyId, { buttons: buttons.filter(b => b.id !== id) });
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

    const getCaseStyles = (color: KeyColor) => {
        switch (color) {
            case 'yellow': return { outer: 'bg-[#FFD66B] border-[#E5BC45]', inner: 'bg-[#E5BC45]', text: 'text-yellow-900/50' };
            case 'blue': return { outer: 'bg-[#A7C7E7] border-[#86A6C6]', inner: 'bg-[#86A6C6]', text: 'text-blue-900/50' };
            case 'red': return { outer: 'bg-[#FFB7B2] border-[#DF9792]', inner: 'bg-[#DF9792]', text: 'text-red-900/50' };
            case 'green': return { outer: 'bg-[#B4E4B4] border-[#94C494]', inner: 'bg-[#94C494]', text: 'text-green-900/50' };
            case 'purple': return { outer: 'bg-[#D1C4E9] border-[#B1A4C9]', inner: 'bg-[#B1A4C9]', text: 'text-purple-900/50' };
            case 'orange': return { outer: 'bg-[#FFCCBC] border-[#DFAC9C]', inner: 'bg-[#DFAC9C]', text: 'text-orange-900/50' };
            default: return { outer: 'bg-[#F0F4F8] border-[#CED4DA]', inner: 'bg-[#CED4DA]', text: 'text-gray-900/50' };
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
                            </div>
                        </div>

                        {/* Buttons Configuration */}
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/50">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t('buttons')}</h2>
                            <div className="space-y-4">
                                {buttons.map((btn) => (
                                    <div key={btn.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <textarea
                                                    value={btn.text}
                                                    onChange={(e) => updateButton(btn.id, { text: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium resize-none focus:outline-none h-[60px]"
                                                />
                                            </div>
                                            <button onClick={() => removeButton(btn.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={18} /></button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {ALL_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() => updateButton(btn.id, { color: c })}
                                                    className={`w-6 h-6 rounded-full border transition-transform ${btn.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
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
                                            <div className="flex-1" />
                                            <div className="flex gap-1.5">
                                                <button onClick={() => playSound(btn)} disabled={!btn.audioUrl} className={`p-2 rounded-lg ${btn.audioUrl ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-300'}`}><Play size={14} /></button>
                                                <button onClick={() => recordingId === btn.id ? stopRecording() : startRecording(btn.id)} className={`px-2 py-1 rounded-lg text-xs font-bold ${recordingId === btn.id ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700'}`}>{recordingId === btn.id ? t('stop') : t('record')}</button>
                                                <label className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 cursor-pointer">{t('upload')}<input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(btn.id, e)} /></label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addButton} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-semibold flex items-center justify-center gap-2">
                                    <Plus size={20} /> {t('add_button')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`relative group perspective-1000 transform transition-transform duration-300 ${containerWidth} ${buttons.length <= 4 ? 'mt-12' : ''}`}>
                        {buttons.length <= 4 && (
                            <>
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-16 h-16 border-[6px] border-gray-300 rounded-full z-0 transform -translate-y-2" />
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-8 bg-gray-300 rounded-full z-0" />
                            </>
                        )}
                        <div className={`${caseStyles.outer} p-5 pb-7 rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] border-b-[8px] transition-all duration-300`}>
                            <h2 className={`mb-3 text-center font-black uppercase tracking-tighter text-sm ${caseStyles.text}`}>{activeToy.name}</h2>
                            <div className={`grid ${gridCols} gap-4 ${caseStyles.inner} p-2 rounded-2xl transition-all duration-300`}>
                                {buttons.map((config) => (
                                    <KeyButton key={config.id} config={config} onClick={playSound} />
                                ))}
                                {buttons.length === 0 && (
                                    <div className={`col-span-2 text-center p-8 ${caseStyles.text} font-bold`}>{t('no_buttons')}</div>
                                )}
                            </div>
                        </div>
                        <div className="mt-8 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <p className="text-gray-400 text-sm">{t('tap_to_play')}</p>
                        </div>
                    </div>
                )}
                <footer className="mt-12 text-gray-400 text-[10px] font-medium tracking-widest uppercase">
                    v{pkg.version}
                </footer>
            </main>
        </div>
    );
};

export default App;