import React, { useState, useRef, useCallback, useEffect } from 'react';
import { KEYPAD_CONFIG, APP_TITLE, APP_SUBTITLE } from './constants';
import KeyButton from './components/KeyButton';
import { Bot, Settings, Mic, Upload, Play, Trash2, Plus, X, Check, StopCircle } from 'lucide-react';
import { KeyConfig, KeyColor } from './types';
import { saveButtons, loadButtons } from './utils/storage';

const App: React.FC = () => {
    // --- State ---
    const [buttons, setButtons] = useState<KeyConfig[]>(KEYPAD_CONFIG);
    const [isEditing, setIsEditing] = useState(false);
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // --- Refs ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

    // --- Persistence ---
    useEffect(() => {
        loadButtons().then((stored) => {
            if (stored) {
                setButtons(stored);
            }
            setIsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (isLoaded) {
            saveButtons(buttons);
        }
    }, [buttons, isLoaded]);

    // --- Audio Logic: Playback ---
    const playSound = useCallback((config: KeyConfig) => {
        if (!config.audioUrl) return;

        // Create a new Audio object for overlapping playback
        const audio = new Audio(config.audioUrl);
        audio.play().catch(e => console.error("Playback failed:", e));
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

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setRecordingId(id);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setRecordingId(null);
    };

    // --- Audio Logic: Upload ---
    const handleFileUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const audioUrl = URL.createObjectURL(file);
            updateButton(id, { audioUrl });
        }
    };

    // --- Data Management ---
    const updateButton = (id: string, updates: Partial<KeyConfig>) => {
        setButtons(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    };

    const addButton = () => {
        const newId = `btn_${Date.now()}`;
        const newButton: KeyConfig = {
            id: newId,
            text: 'New\nButton',
            color: 'white',
            audioUrl: null
        };
        setButtons(prev => [...prev, newButton]);
    };

    const removeButton = (id: string) => {
        setButtons(prev => prev.filter(b => b.id !== id));
    };

    const deleteAudio = (id: string) => {
        updateButton(id, { audioUrl: null });
    };

    // --- Layout Helpers ---
    // Determine grid columns based on button count
    const gridCols = buttons.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
    const containerWidth = buttons.length <= 4 ? 'max-w-[320px]' : 'max-w-[480px]';

    return (
        <div className="min-h-screen bg-[#e0e5ec] text-gray-800 flex flex-col items-center py-8 px-4 sm:px-6 relative overflow-y-auto">

            {/* Decorative background blobs */}
            <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-yellow-200/30 rounded-full blur-3xl pointer-events-none" />

            {/* Header & Controls */}
            <header className="mb-8 text-center relative z-10 mt-4 w-full max-w-2xl flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4 px-4">
                    <div className="w-10"></div> {/* Spacer for centering */}
                    <div className="flex flex-col items-center">
                        <div className="inline-flex items-center justify-center p-3 bg-white rounded-full shadow-md mb-2">
                            <Bot className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight text-gray-900 leading-none">{APP_TITLE}</h1>
                        <p className="text-gray-500 font-medium text-sm">{APP_SUBTITLE}</p>
                    </div>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isEditing ? 'bg-blue-500 text-white shadow-inner' : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'}`}
                        title={isEditing ? "Done Editing" : "Edit Settings"}
                    >
                        {isEditing ? <Check size={20} /> : <Settings size={20} />}
                    </button>
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col items-center justify-start relative z-10 pb-20">

                {isEditing ? (
                    // --- EDIT MODE UI ---
                    <div className="w-full max-w-lg space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/50">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Button Configuration</h2>

                            <div className="space-y-4">
                                {buttons.map((btn) => (
                                    <div key={btn.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                                        {/* Top Row: Text & Delete */}
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-400 font-semibold mb-1 block">Button Text</label>
                                                <textarea
                                                    value={btn.text}
                                                    onChange={(e) => updateButton(btn.id, { text: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 h-[60px]"
                                                />
                                            </div>
                                            <button
                                                onClick={() => removeButton(btn.id)}
                                                className="text-gray-400 hover:text-red-500 self-start p-1"
                                                title="Remove Button"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        {/* Middle Row: Color Picker */}
                                        <div>
                                            <label className="text-xs text-gray-400 font-semibold mb-2 block">Color</label>
                                            <div className="flex gap-2">
                                                {(['white', 'yellow', 'blue', 'red'] as KeyColor[]).map((c) => (
                                                    <button
                                                        key={c}
                                                        onClick={() => updateButton(btn.id, { color: c })}
                                                        className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-95 ${btn.color === c ? 'border-gray-800 scale-110' : 'border-transparent'
                                                            }`}
                                                        style={{
                                                            backgroundColor:
                                                                c === 'white' ? '#F0F4F8' :
                                                                    c === 'yellow' ? '#F3E388' :
                                                                        c === 'blue' ? '#A7C7E7' : '#FFB7B2'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Bottom Row: Audio Controls */}
                                        <div>
                                            <label className="text-xs text-gray-400 font-semibold mb-2 block">Sound</label>
                                            <div className="flex flex-wrap items-center gap-2">

                                                {/* Play Preview */}
                                                <button
                                                    onClick={() => playSound(btn)}
                                                    disabled={!btn.audioUrl}
                                                    className={`p-2 rounded-lg flex items-center justify-center transition-colors ${btn.audioUrl ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-300'}`}
                                                    title="Preview Sound"
                                                >
                                                    <Play size={16} fill={btn.audioUrl ? "currentColor" : "none"} />
                                                </button>

                                                {/* Recording Button */}
                                                <button
                                                    onClick={() => recordingId === btn.id ? stopRecording() : startRecording(btn.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${recordingId === btn.id
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {recordingId === btn.id ? <StopCircle size={16} /> : <Mic size={16} />}
                                                    {recordingId === btn.id ? 'Stop' : 'Record'}
                                                </button>

                                                {/* Upload Button */}
                                                <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
                                                    <Upload size={16} />
                                                    Upload
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        className="hidden"
                                                        onChange={(e) => handleFileUpload(btn.id, e)}
                                                    />
                                                </label>

                                                {/* Clear Audio */}
                                                {btn.audioUrl && (
                                                    <button
                                                        onClick={() => deleteAudio(btn.id)}
                                                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg ml-auto"
                                                        title="Delete Sound"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}

                                                {btn.audioUrl && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded ml-2">Sound Ready</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={addButton}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 font-semibold flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-500 transition-colors"
                                >
                                    <Plus size={20} />
                                    Add New Button
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- PLAY MODE UI ---
                    <div className={`relative group perspective-1000 transform transition-transform duration-300 ${containerWidth}`}>
                        {/* Keyring Loop Visual - Only show if it looks like a cube (<=4) */}
                        {buttons.length <= 4 && (
                            <>
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-16 h-16 border-[6px] border-gray-300 rounded-full z-0 transform -translate-y-2" />
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-4 h-8 bg-gray-300 rounded-full z-0" />
                            </>
                        )}

                        {/* Casing Body */}
                        <div className="bg-[#FFD66B] p-5 pb-7 rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25)] border-b-[8px] border-[#E5BC45] transition-all duration-300">
                            {/* Inner Grid */}
                            <div className={`grid ${gridCols} gap-4 bg-[#E5BC45] p-2 rounded-2xl transition-all duration-300`}>
                                {buttons.map((config) => (
                                    <KeyButton
                                        key={config.id}
                                        config={config}
                                        onClick={playSound}
                                    />
                                ))}
                                {buttons.length === 0 && (
                                    <div className="col-span-2 text-center p-8 text-yellow-800 opacity-50 font-bold">
                                        No buttons! <br /> Click settings to add some.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="mt-8 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <p className="text-gray-400 text-sm">Click buttons to play sound</p>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;