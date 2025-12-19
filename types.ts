

export type VisualFilter = 'none' | 'false-color' | 'focus-peaking' | 'monochrome' | 'negative';
export type GridMode = 'none' | 'thirds' | 'golden' | 'crosshair' | 'diagonal';

export interface VideoState {
  isPlaying: boolean;
  progress: number; // 0 to 100
  currentTime: number;
  duration: number;
  volume: number; // 0 to 1
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  showControls: boolean;
  buffered: number; // 0 to 100
  isBuffering: boolean;
  isCinemaMode: boolean; // Dynamic Compression
  error: string | null;
  visualFilter: VisualFilter;
  isLoupeActive: boolean;
  audioChannels: boolean[]; // Array of 6 booleans for 5.1 mix
  isCompareMode: boolean; // Split screen
  compareSrc: string | null; // URL for 2nd video
  inPoint: number | null; // Mark In timestamp
  outPoint: number | null; // Mark Out timestamp
  audioHeatmap?: number[]; // Normalized amplitude data (0-1)
  scalingMode: 'contain' | 'cover'; // Zoom to fill support
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  src: string; // Blob URL
}

export interface AudioTrackInfo {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}

export interface AnnotationLine {
  points: {x: number, y: number}[];
  color: string;
  width: number;
}

export interface EngagementPoint {
  timestamp: number;
  score: number; // 0-100
  reason: string;
}

// Added NewsArticle interface to satisfy usage in geminiService.ts
export interface NewsArticle {
  title: string;
  uri: string;
  source: string;
  snippet: string;
}

export interface Note {
  id: string;
  timestamp: number;
  text: string;
  thumbnail?: string; // Data URL
  tags: string[]; // "Framing", "Light", "Sound", "Acting", "Blocking"
  drawing?: AnnotationLine[]; // Vector drawing
}

export interface Shot {
  id: string;
  startTime: number;
  endTime: number;
  motionScore?: number; // 0-1 for heatmap
}

export type SceneType = 'action' | 'comedy' | 'drama' | 'thriller' | 'song' | 'twist' | 'horror' | 'romance' | 'dialogue';

export interface SceneSegment {
  id: string;
  startTime: number;
  endTime: number; // If same as startTime, it's a point
  type: SceneType;
  description?: string;
  rating?: number; // 0-100 Score
}

export interface AnalysisState {
  isAnalyzing: boolean;
  progress: number; // 0-100 for loading bar
  data: EngagementPoint[] | null;
  error: string | null;
}

export interface ActivityLog {
  id: string;
  filename: string;
  date: number; // timestamp
  durationPlayed: number; // seconds
}

export interface PlannerEntry {
  id: string;
  movieId?: string;
  title: string;
  date: number; // timestamp for the planned day
  status: 'planned' | 'watched' | 'skipped';
  platform?: string; // Netflix, Theater, BluRay etc.
  notes?: string;
  rating?: string;
  year?: number;
  posterPath?: string;
  overview?: string;
}

export interface MovieMeta {
  duration: number;
  lastPlayed: number;
  heatmap: number[]; // Array of 100 integers representing attention/rewatch count per % of video
}

export interface StoredStoryboard {
  filename: string;
  notes: Note[];
  segments?: SceneSegment[];
  lastModified: number;
  folder?: string;
  duration?: number;
  heatmap?: number[];
}