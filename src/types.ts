export type KeyColor = 'white' | 'yellow' | 'blue' | 'red' | 'green' | 'purple' | 'orange';

export interface AppSettings {
  caseColor: KeyColor;
}

export interface KeyConfig {
  id: string;
  text: string;
  color: KeyColor;
  audioUrl?: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'action' | 'response';
}