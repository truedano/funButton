export type KeyColor = 'white' | 'yellow' | 'blue' | 'red';

export interface KeyConfig {
  id: string;
  text: string; // The raw text to display
  color: KeyColor;
  audioUrl?: string | null; // Blob URL or Data URL for the sound
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'action' | 'response';
}