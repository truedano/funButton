export type KeyColor = 'white' | 'yellow' | 'blue' | 'red' | 'green' | 'purple' | 'orange';
export type SoundType = 'default' | 'keyboard';

export interface AppSettings {
  caseColor: KeyColor;
  titleColor?: string | null;
  soundType?: SoundType;
}

export interface KeyConfig {
  id: string;
  text: string;
  color: KeyColor;
  audioUrl?: string | null;
  imageUrl?: string | null;
  textColor?: string | null;
}

export interface ToyConfig {
  id: string;
  name: string;
  settings: AppSettings;
  buttons: KeyConfig[];
}

export interface GlobalState {
  toys: ToyConfig[];
  activeToyId: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'action' | 'response';
}