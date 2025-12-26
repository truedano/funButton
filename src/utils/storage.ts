import { get, set } from 'idb-keyval';
import { KeyConfig, AppSettings, ToyConfig, GlobalState } from '../types';

const DB_KEY = 'funbutton_multi_toy_v1';

interface StoredKeyConfig extends Omit<KeyConfig, 'audioUrl'> {
    audioBlob?: Blob | null;
}

interface StoredToyConfig extends Omit<ToyConfig, 'buttons'> {
    buttons: StoredKeyConfig[];
}

interface StoredGlobalState {
    toys: StoredToyConfig[];
    activeToyId: string;
}

export const saveGlobalState = async (state: GlobalState) => {
    const storedToys: StoredToyConfig[] = await Promise.all(
        state.toys.map(async (toy) => {
            const storedButtons: StoredKeyConfig[] = await Promise.all(
                toy.buttons.map(async (btn) => {
                    let audioBlob: Blob | null = null;
                    if (btn.audioUrl) {
                        try {
                            const response = await fetch(btn.audioUrl);
                            audioBlob = await response.blob();
                        } catch (error) {
                            console.error(`Failed to fetch blob for button ${btn.id}`, error);
                        }
                    }
                    return {
                        id: btn.id,
                        text: btn.text,
                        color: btn.color,
                        audioBlob,
                    };
                })
            );
            return {
                ...toy,
                buttons: storedButtons,
            };
        })
    );

    const storedState: StoredGlobalState = {
        toys: storedToys,
        activeToyId: state.activeToyId,
    };
    await set(DB_KEY, storedState);
};

export const loadGlobalState = async (): Promise<GlobalState | null> => {
    const data = await get<StoredGlobalState>(DB_KEY);
    if (!data) return null;

    const toys: ToyConfig[] = data.toys.map((toy) => ({
        ...toy,
        buttons: toy.buttons.map((btn) => ({
            id: btn.id,
            text: btn.text,
            color: btn.color,
            audioUrl: btn.audioBlob ? URL.createObjectURL(btn.audioBlob) : null,
        })),
    }));

    return {
        toys,
        activeToyId: data.activeToyId,
    };
};

// --- Export / Import helpers ---

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'audio/webm';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
};

export const exportAllData = async (state: GlobalState): Promise<string> => {
    const backupToys = await Promise.all(
        state.toys.map(async (toy) => {
            const buttons = await Promise.all(
                toy.buttons.map(async (btn) => {
                    let audioBase64: string | null = null;
                    if (btn.audioUrl) {
                        try {
                            const response = await fetch(btn.audioUrl);
                            const blob = await response.blob();
                            audioBase64 = await blobToBase64(blob);
                        } catch (e) {
                            console.error(`Export: Failed to convert audio for ${btn.id}`, e);
                        }
                    }
                    return {
                        id: btn.id,
                        text: btn.text,
                        color: btn.color,
                        audioBase64,
                    };
                })
            );
            return { ...toy, buttons };
        })
    );

    const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        activeToyId: state.activeToyId,
        toys: backupToys,
    };

    return JSON.stringify(backupData, null, 2);
};

export const importAllData = async (jsonContent: string): Promise<GlobalState> => {
    const data = JSON.parse(jsonContent);

    // Basic validation
    if (!data.toys || !Array.isArray(data.toys)) {
        throw new Error('Invalid backup file format');
    }

    const restoredToys: ToyConfig[] = data.toys.map((toy: any) => ({
        id: toy.id || `toy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: toy.name || 'Restored Toy',
        settings: toy.settings || { caseColor: 'yellow' },
        buttons: (toy.buttons || []).map((btn: any) => ({
            id: btn.id || `btn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: btn.text || '',
            color: btn.color || 'white',
            audioUrl: btn.audioBase64 ? URL.createObjectURL(base64ToBlob(btn.audioBase64)) : null,
        })),
    }));

    return {
        toys: restoredToys,
        activeToyId: data.activeToyId || restoredToys[0]?.id || 'toy_default',
    };
};
