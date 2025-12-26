import { get, set } from 'idb-keyval';
import { KeyConfig, AppSettings } from '../types';

const DB_KEY = 'funbutton_config_v2'; // Increment key for new structure

interface StoredKeyConfig extends Omit<KeyConfig, 'audioUrl'> {
    audioBlob?: Blob | null;
}

interface AppData {
    buttons: StoredKeyConfig[];
    settings: AppSettings;
}

export const saveAppData = async (buttons: KeyConfig[], settings: AppSettings) => {
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
    await set(DB_KEY, { buttons: storedButtons, settings });
};

export const loadAppData = async (): Promise<{ buttons: KeyConfig[], settings: AppSettings } | null> => {
    const data = await get<AppData>(DB_KEY);
    if (!data) return null;

    const buttons: KeyConfig[] = data.buttons.map((btn) => ({
        id: btn.id,
        text: btn.text,
        color: btn.color,
        audioUrl: btn.audioBlob ? URL.createObjectURL(btn.audioBlob) : null,
    }));

    return {
        buttons,
        settings: data.settings || { caseColor: 'yellow' }
    };
};
