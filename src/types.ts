export type KeyColor = 'white' | 'yellow' | 'blue' | 'red' | 'green' | 'purple' | 'orange';
export type SoundType = 'default' | 'keyboard';
export type GlowType = 'none' | 'backlit' | 'bloom' | 'surface' | 'aura';

export interface AppSettings {
  caseColor: KeyColor;
  titleColor?: string | null;
  soundType?: SoundType;
  glowType?: GlowType;
}

export interface KeyConfig {
  id: string;
  text: string;
  color: KeyColor;
  audioUrl?: string | null;
  imageUrl?: string | null;
  textColor?: string | null;
}

export interface MacroStep {
  buttonId: string;
  delay: number; // delay in ms AFTER this button press
}

export interface MacroConfig {
  id: string;
  name: string;
  steps: MacroStep[];
}

export interface ToyConfig {
  id: string;
  name: string;
  settings: AppSettings;
  buttons: KeyConfig[];
  macros?: MacroConfig[];
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