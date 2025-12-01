import { get, set } from 'idb-keyval';
import { KeyConfig } from '../types';

const DB_KEY = 'funbutton_config';

interface StoredKeyConfig extends Omit<KeyConfig, 'audioUrl'> {
    audioBlob?: Blob | null;
}

export const saveButtons = async (buttons: KeyConfig[]) => {
    const storedButtons: StoredKeyConfig[] = await Promise.all(
        buttons.map(async (btn) => {
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
    await set(DB_KEY, storedButtons);
};

export const loadButtons = async (): Promise<KeyConfig[] | null> => {
    const storedButtons = await get<StoredKeyConfig[]>(DB_KEY);
    if (!storedButtons) return null;

    return storedButtons.map((btn) => ({
        id: btn.id,
        text: btn.text,
        color: btn.color,
        audioUrl: btn.audioBlob ? URL.createObjectURL(btn.audioBlob) : null,
    }));
};
