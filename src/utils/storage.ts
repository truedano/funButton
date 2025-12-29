import { get, set } from 'idb-keyval';
import { KeyConfig, AppSettings, ToyConfig, GlobalState } from '../types';

const DB_KEY = 'funbutton_multi_toy_v1';

interface StoredKeyConfig extends Omit<KeyConfig, 'audioUrl' | 'imageUrl'> {
    audioBlob?: Blob | null;
    imageBlob?: Blob | null;
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
                            console.error(`Failed to fetch audio blob for button ${btn.id}`, error);
                        }
                    }

                    let imageBlob: Blob | null = null;
                    if (btn.imageUrl) {
                        try {
                            const response = await fetch(btn.imageUrl);
                            imageBlob = await response.blob();
                        } catch (error) {
                            console.error(`Failed to fetch image blob for button ${btn.id}`, error);
                        }
                    }

                    return {
                        id: btn.id,
                        text: btn.text,
                        color: btn.color,
                        audioBlob,
                        imageBlob,
                        textColor: btn.textColor,
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
            imageUrl: btn.imageBlob ? URL.createObjectURL(btn.imageBlob) : null,
            textColor: btn.textColor,
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

const processToyForExport = async (toy: ToyConfig) => {
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

            let imageBase64: string | null = null;
            if (btn.imageUrl) {
                try {
                    const response = await fetch(btn.imageUrl);
                    const blob = await response.blob();
                    imageBase64 = await blobToBase64(blob);
                } catch (e) {
                    console.error(`Export: Failed to convert image for ${btn.id}`, e);
                }
            }

            return {
                id: btn.id,
                text: btn.text,
                color: btn.color,
                audioBase64,
                imageBase64,
                textColor: btn.textColor,
            };
        })
    );
    return { ...toy, buttons };
};

export const exportAllData = async (state: GlobalState): Promise<string> => {
    const backupToys = await Promise.all(
        state.toys.map(toy => processToyForExport(toy))
    );

    const backupData = {
        version: '1.0',
        type: 'full_backup',
        timestamp: new Date().toISOString(),
        activeToyId: state.activeToyId,
        toys: backupToys,
    };

    return JSON.stringify(backupData, null, 2);
};

export const exportSingleToy = async (toy: ToyConfig): Promise<string> => {
    const processedToy = await processToyForExport(toy);

    const backupData = {
        version: '1.0',
        type: 'single_toy',
        timestamp: new Date().toISOString(),
        toy: processedToy,
    };

    return JSON.stringify(backupData, null, 2);
};

export const importData = async (jsonContent: string, currentToys: ToyConfig[]): Promise<GlobalState> => {
    const data = JSON.parse(jsonContent);

    const restoreToy = (toy: any): ToyConfig => ({
        id: `toy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Always give new ID on import to avoid conflicts
        name: toy.name || 'Restored Toy',
        settings: toy.settings || { caseColor: 'yellow' },
        buttons: (toy.buttons || []).map((btn: any) => ({
            id: `btn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: btn.text || '',
            color: btn.color || 'white',
            audioUrl: btn.audioBase64 ? URL.createObjectURL(base64ToBlob(btn.audioBase64)) : null,
            imageUrl: btn.imageBase64 ? URL.createObjectURL(base64ToBlob(btn.imageBase64)) : null,
            textColor: btn.textColor || null,
        })),
    });

    if (data.type === 'single_toy' && data.toy) {
        const newToy = restoreToy(data.toy);
        return {
            toys: [...currentToys, newToy],
            activeToyId: newToy.id
        };
    } else if (data.toys && Array.isArray(data.toys)) {
        const restoredToys = data.toys.map((t: any) => restoreToy(t));
        return {
            toys: restoredToys,
            activeToyId: data.activeToyId || restoredToys[0]?.id || 'toy_default',
        };
    } else {
        throw new Error('Invalid backup file format');
    }
};
