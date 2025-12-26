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
