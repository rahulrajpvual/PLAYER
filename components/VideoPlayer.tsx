import React, { useRef, useState, useEffect, useCallback } from 'react';
import VideoControls from './VideoControls';
import { VideoState, AnalysisState, Note, Shot, SceneSegment, SceneType, VisualFilter, AnnotationLine, ActivityLog, MovieMeta, SubtitleTrack, AudioTrackInfo, GridMode, InteractionEvent } from '../types';
import { 
  X, Activity, StopCircle, Check, ScanEye, Grid3x3, Layout, Target, Scaling, 
  BookOpen, Camera, Trash2, ChevronRight, Image as ImageIcon,
  Zap, Heart, AlertCircle, Feather, Smile, Scissors, BarChart3, Tag, Film,
  Loader2, AlertTriangle, Volume2, VolumeX, Play, Pause, Speaker, Wand2,
  Sword, Drama, Music, Skull, Ghost, HelpCircle, HeartHandshake, Clapperboard, Timer, Download, Circle, Plus, Edit2, Palette, Eye, Star, MessageSquare, TrendingUp, Disc
} from 'lucide-react';
import { saveToCloud, loadFromCloud } from '../services/firebase';

// --- Types ---
interface VideoPlayerProps {
  file: File;
  onClose: () => void;
}

type SidebarTab = 'storyboard' | 'scenes' | 'monitor';

const SCENE_TYPES: SceneType[] = ['action', 'comedy', 'drama', 'thriller', 'song', 'twist', 'horror', 'romance', 'dialogue', 'suspense', 'sci-fi', 'technical', 'montage', 'musical', 'mystery', 'bg-score'];

const formatTimecode = (seconds: number) => {
  if (isNaN(seconds)) return "00:00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

// Helper: Simple SRT to WebVTT converter
const srtToVtt = (srtContent: string): string => {
  let vtt = "WEBVTT\n\n";
  // Replace comma with dot in timestamps
  let text = srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  vtt += text;
  return vtt;
};

// Helper: Format movie name
const formatMovieName = (filename: string): string => {
    try {
      const name = filename.replace(/\.[^/.]+$/, ""); // Remove extension
      // Regex to capture Title (group 1) and Year (group 2)
      // Looks for 19xx or 20xx surrounded by delimiters or end of string
      const match = name.match(/^(.*?)(?:[\.\s\(]?)((?:19|20)\d{2})(?:[\.\s\)]|$)/);
      
      if (match) {
        const title = match[1].replace(/\./g, " ").replace(/_/g, " ").trim();
        const year = match[2];
        if (title) return `${title} | ${year}`;
      }
      
      return name.replace(/\./g, " ").replace(/_/g, " ");
    } catch (e) { return filename; }
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ file, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const compareVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null); 
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const monitorCanvasRef = useRef<HTMLCanvasElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const attentionHeatmapRef = useRef<number[]>(new Array(100).fill(0)); // 0-100% buckets
  const interactionHistoryRef = useRef<InteractionEvent[]>([]);
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const splitterNodeRef = useRef<ChannelSplitterNode | null>(null);
  const mergerNodeRef = useRef<ChannelMergerNode | null>(null);
  const channelGainNodesRef = useRef<GainNode[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const audioDelayNodeRef = useRef<DelayNode | null>(null);

  const [src, setSrc] = useState<string>('');
  const [gridMode, setGridMode] = useState<GridMode>('none');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('storyboard');
  const [feedbackIcon, setFeedbackIcon] = useState<React.ReactNode | null>(null);
  
  // Interaction State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<AnnotationLine | null>(null);
  const [brushColor, setBrushColor] = useState('#eab308');
  const [brushSize, setBrushSize] = useState(3);

  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(50); // Default to middle 50

  // Recording / Export State
  const [isExporting, setIsExporting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Color Analysis State
  const [colorBarcode, setColorBarcode] = useState<{time: number, color: string}[]>([]);
  const [isScanningColors, setIsScanningColors] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  
  // Realtime Analysis State
  const [realtimeColors, setRealtimeColors] = useState<{
      palette: string[];
      histogram: { r: number, g: number, b: number }[]; // 10 buckets
      luminance: number;
      avg: string[];
  }>({ palette: [], histogram: [], luminance: 0, avg: [] });
  const graphHistoryRef = useRef<number[]>(new Array(60).fill(0)); // Store last 60 frames of luminance

  // Pixel Loupe State
  const [loupePos, setLoupePos] = useState({ x: 0, y: 0 });

  // Tracks State
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string>('off');
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);

  // Data State
  const [notes, setNotes] = useState<Note[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [segments, setSegments] = useState<SceneSegment[]>([]);

  const [pendingSegment, setPendingSegment] = useState<{type: SceneType, startTime: number, endTime: number} | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [currentCues, setCurrentCues] = useState<string[]>([]);

  const [state, setState] = useState<VideoState>({
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    isFullscreen: false,
    showControls: true,
    buffered: 0,
    isBuffering: true,
    isCinemaMode: false,
    error: null,
    visualFilter: 'none',
    isLoupeActive: false,
    audioChannels: [true, true, true, true, true, true], 
    isCompareMode: false,
    compareSrc: null,
    inPoint: null,
    outPoint: null,
    audioHeatmap: undefined,
    scalingMode: 'contain',
    isAudioBypass: false,
    subtitleSync: 0,
    audioSync: 0,
    subtitleSize: 24,
    subtitlePosition: 0,
    isPureNativeAudio: false
  });

  const stateRef = useRef(state);
  const segmentsRef = useRef(segments);
  const currentRatingRef = useRef(currentRating);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { currentRatingRef.current = currentRating; }, [currentRating]);
  
  // Sync volume with native element (needed if re-mounted via isPureNativeAudio)
  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.volume = state.volume;
        videoRef.current.muted = state.isMuted;
    }
  }, [state.volume, state.isMuted, state.isPureNativeAudio]);

  const logInteraction = useCallback((type: InteractionEvent['type'], metadata?: any) => {
    if (!videoRef.current) return;
    interactionHistoryRef.current.push({
      type,
      timestamp: Date.now(),
      videoTime: videoRef.current.currentTime,
      metadata
    });
  }, []);

  // Handle countdown effect
  useEffect(() => {
    let interval: any;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            finalizePendingSegment();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      subtitles.forEach(track => URL.revokeObjectURL(track.src));
    };
  }, []);

  // Listen for fullscreen changes to sync state (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState(s => ({ ...s, isFullscreen: !!document.fullscreenElement }));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle Session Logging & Heatmap Saving on Unmount
  useEffect(() => {
    // Load existing data from cloud/local on mount
    const loadData = async () => {
       const fname = file.name;
       const savedNotes = await loadFromCloud(`notes_${fname}`, 'filename', fname) as Note[];
       if (savedNotes) setNotes(savedNotes.sort((a,b) => b.timestamp - a.timestamp));
       
       const savedSegments = await loadFromCloud(`segments_${fname}`, 'filename', fname) as SceneSegment[];
       if (savedSegments) setSegments(savedSegments.sort((a,b) => b.startTime - a.startTime));

       const metaStr = localStorage.getItem(`lumina_meta_${fname}`);
       if (metaStr) {
         try {
           const meta = JSON.parse(metaStr);
           if (meta.duration) setState(s => ({ ...s, duration: meta.duration })); 
         } catch(e) {}
       }
    };
    loadData();

    const fname = file.name;
    const savedMeta = localStorage.getItem(`lumina_meta_${fname}`);
    if (savedMeta) {
        try {
            const meta = JSON.parse(savedMeta);
            if (meta.heatmap && meta.heatmap.length === 100) {
                attentionHeatmapRef.current = meta.heatmap;
            }
        } catch(e) {}
    }

    const startTime = Date.now();
    sessionStartTimeRef.current = startTime;

    return () => {
      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      
      const currentFilename = file.name;

      logInteraction('exit');

      // Save Activity Log
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        filename: currentFilename,
        date: Date.now(),
        durationPlayed: durationSeconds,
        interactions: interactionHistoryRef.current
      };
      saveToCloud('activity_logs', newLog);
      
      // Save Metadata (Duration & Heatmap)
      if (videoRef.current && videoRef.current.duration) {
          const meta: MovieMeta = {
               duration: videoRef.current.duration,
               lastPlayed: Date.now(),
               heatmap: attentionHeatmapRef.current
          };
          localStorage.setItem(`lumina_meta_${currentFilename}`, JSON.stringify(meta));
      }
    };
  }, [file.name]);

  // Video Source Effect
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setSrc('');
    }
  }, [file]);

  // --- Audio Waveform Extraction ---
  useEffect(() => {
      const analyzeAudio = async () => {
          // Audio analysis disabled to support large movie files (2-3GB) without crashing browser
          return; 
          
          /* 
          if (!file) return;
          ... existing logic ...
          */
      };

      analyzeAudio();
  }, [file]);

  // --- Realtime Analysis Loop (Monitor & Colors) ---
  useEffect(() => {
      if ((activeSidebarTab !== 'monitor' && activeSidebarTab !== 'scenes') || !state.isPlaying || !videoRef.current) return;
      
      let animationFrameId: number;
      
      // Create offscreen canvas for analysis if not exists (via ref)
      if (!analysisCanvasRef.current) {
          const c = document.createElement('canvas');
          c.width = 64; // Small size for performance
          c.height = 36;
          analysisCanvasRef.current = c;
      }

      const analyzeFrame = () => {
          if (videoRef.current && analysisCanvasRef.current) {
              const ctx = analysisCanvasRef.current.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                  // 1. Draw Frame
                  ctx.drawImage(videoRef.current, 0, 0, 64, 36);
                  const frameData = ctx.getImageData(0, 0, 64, 36).data;
                  
                  // 2. Extract Histogram & Palette & Luminance
                  const rBins = new Array(10).fill(0);
                  const gBins = new Array(10).fill(0);
                  const bBins = new Array(10).fill(0);
                  let rSum = 0, gSum = 0, bSum = 0;
                  
                  // Sample a few pixels for palette (simple grid approach)
                  const palette: string[] = [];
                  
                  for (let i = 0; i < frameData.length; i += 4) {
                      const r = frameData[i];
                      const g = frameData[i+1];
                      const b = frameData[i+2];
                      
                      rBins[Math.floor(r / 26)]++;
                      gBins[Math.floor(g / 26)]++;
                      bBins[Math.floor(b / 26)]++;

                      rSum += r; gSum += g; bSum += b;
                  }

                  const totalPixels = 64 * 36;
                  const avgLuminance = (rSum + gSum + bSum) / (totalPixels * 3); // 0-255 approx

                  // Normalize Histogram
                  const histogram = rBins.map((_, i) => ({
                      r: rBins[i] / totalPixels,
                      g: gBins[i] / totalPixels,
                      b: bBins[i] / totalPixels
                  }));
                  
                  // Simple Palette Sampling
                  palette.push(`rgb(${frameData[(64*18+32)*4]}, ${frameData[(64*18+32)*4+1]}, ${frameData[(64*18+32)*4+2]})`); // Center
                  palette.push(`rgb(${frameData[0]}, ${frameData[1]}, ${frameData[2]})`); // TL
                  palette.push(`rgb(${frameData[(64*35)*4]}, ${frameData[(64*35)*4+1]}, ${frameData[(64*35)*4+2]})`); // BL

                  setRealtimeColors({ palette, histogram, luminance: avgLuminance });
                  
                  // Update Graph History
                  graphHistoryRef.current.push(avgLuminance);
                  if (graphHistoryRef.current.length > 60) graphHistoryRef.current.shift();

                  // Draw Monitor Graph if active
                  if (activeSidebarTab === 'monitor' && monitorCanvasRef.current) {
                      const mCtx = monitorCanvasRef.current.getContext('2d');
                      if (mCtx) {
                          const w = monitorCanvasRef.current.width;
                          const h = monitorCanvasRef.current.height;
                          mCtx.clearRect(0, 0, w, h);
                          
                          // Draw Line
                          mCtx.beginPath();
                          mCtx.strokeStyle = '#4f46e5'; // Indigo
                          mCtx.lineWidth = 2;
                          const step = w / 60;
                          
                          graphHistoryRef.current.forEach((val, i) => {
                              const y = h - (val / 255) * h;
                              if (i === 0) mCtx.moveTo(0, y);
                              else mCtx.lineTo(i * step, y);
                          });
                          mCtx.stroke();
                          
                          // Fill below
                          mCtx.lineTo((graphHistoryRef.current.length - 1) * step, h);
                          mCtx.lineTo(0, h);
                          mCtx.fillStyle = 'rgba(79, 70, 229, 0.2)';
                          mCtx.fill();
                      }
                  }
              }
          }
          animationFrameId = requestAnimationFrame(analyzeFrame);
      };

      analyzeFrame();
      return () => cancelAnimationFrame(animationFrameId);
  }, [activeSidebarTab, state.isPlaying]);

  // --- Audio Graph Logic ---
  const initAudioContext = () => {
    if (!videoRef.current || state.isPureNativeAudio) return;
    
    try {
        if (!audioContextRef.current) {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new Ctx();
        }

        const ctx = audioContextRef.current;
        
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        if (!sourceNodeRef.current) {
            sourceNodeRef.current = ctx.createMediaElementSource(videoRef.current);
            splitterNodeRef.current = ctx.createChannelSplitter(6);
            mergerNodeRef.current = ctx.createChannelMerger(6);
            
            channelGainNodesRef.current = [];
            for (let i = 0; i < 6; i++) {
                const gain = ctx.createGain();
                channelGainNodesRef.current.push(gain);
            }

            compressorNodeRef.current = ctx.createDynamicsCompressor();
            compressorNodeRef.current.threshold.value = -24;
            compressorNodeRef.current.ratio.value = 12;

            audioDelayNodeRef.current = ctx.createDelay(5.0);
            masterGainRef.current = ctx.createGain();
        }

        updateAudioGraph();
    } catch (e) {
        console.error("Audio Initialization Error:", e);
    }
  };

  const updateAudioGraph = () => {
    if (!audioContextRef.current || !sourceNodeRef.current || !masterGainRef.current || !splitterNodeRef.current || !mergerNodeRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'closed') return;

    if (state.isPureNativeAudio) {
        sourceNodeRef.current?.disconnect();
        masterGainRef.current?.disconnect();
        if (ctx.state === 'running') ctx.suspend();
        return;
    }

    const baseGain = state.isMuted ? 0 : state.volume;
    const modeMultiplier = state.isCinemaMode ? 1.5 : 1.0;

    // Disconnect EVERYTHING to rebuild fresh route
    sourceNodeRef.current.disconnect();
    splitterNodeRef.current.disconnect();
    channelGainNodesRef.current.forEach(g => g.disconnect());
    mergerNodeRef.current.disconnect();
    compressorNodeRef.current?.disconnect();
    audioDelayNodeRef.current?.disconnect();
    masterGainRef.current.disconnect();

    if (state.isAudioBypass) {
        // DIRECT BYPASS: Source -> MasterGain -> Dest
        sourceNodeRef.current.connect(masterGainRef.current);
        masterGainRef.current.connect(ctx.destination);
    } else {
        // PRO MIXER: Source -> Splitter -> Gains -> Merger -> [Compressor] -> Delay -> MasterGain -> Dest
        sourceNodeRef.current.connect(splitterNodeRef.current);
        
        for (let i = 0; i < 6; i++) {
            const gainNode = channelGainNodesRef.current[i];
            if (gainNode) {
                splitterNodeRef.current.connect(gainNode, i);
                gainNode.connect(mergerNodeRef.current, 0, i);
                
                const isActive = state.audioChannels[i];
                gainNode.gain.setTargetAtTime(isActive ? 1 : 0, ctx.currentTime, 0.03);
            }
        }

        const delay = Math.max(0, state.audioSync);
        if (audioDelayNodeRef.current) {
            audioDelayNodeRef.current.delayTime.setTargetAtTime(delay, ctx.currentTime, 0.03);
        }

        if (state.isCinemaMode && compressorNodeRef.current) {
            mergerNodeRef.current.connect(compressorNodeRef.current);
            compressorNodeRef.current.connect(audioDelayNodeRef.current);
        } else {
            mergerNodeRef.current.connect(audioDelayNodeRef.current);
        }
        
        audioDelayNodeRef.current.connect(masterGainRef.current);
        masterGainRef.current.connect(ctx.destination);
    }

    // Always apply master volume
    masterGainRef.current.gain.setTargetAtTime(baseGain * modeMultiplier, ctx.currentTime, 0.03);
    
    // Resume context if needed
    if (ctx.state === 'suspended' && !state.isPureNativeAudio) ctx.resume();
  };

  useEffect(() => { updateAudioGraph(); }, [state.audioChannels, state.isCinemaMode, state.volume, state.isMuted, state.isAudioBypass, state.audioSync, state.isPureNativeAudio]);
  const toggleAudioChannel = (index: number) => {
      const newChannels = [...state.audioChannels];
      newChannels[index] = !newChannels[index];
      setState(prev => ({ ...prev, audioChannels: newChannels }));
  };



  // --- Audio & Subtitle Tracks Discovery ---
  useEffect(() => {
      if(!videoRef.current) return;
      
      const onTracksChanged = () => {
        const vid = videoRef.current as any;
        
        // Audio Tracks
        if (vid && vid.audioTracks) {
            const tracks: AudioTrackInfo[] = [];
            for (let i = 0; i < vid.audioTracks.length; i++) {
                tracks.push({
                    id: i.toString(),
                    label: vid.audioTracks[i].label || `Track ${i+1}`,
                    language: vid.audioTracks[i].language,
                    enabled: vid.audioTracks[i].enabled
                });
            }
            setAudioTracks(tracks);
        }

        // Subtitle/Text Tracks (Embedded)
        if (vid && vid.textTracks && vid.textTracks.length > 0) {
            const subs: SubtitleTrack[] = [];
            // We can't easily get 'src' for embedded tracks, but we can list them so UI shows them
            // Switching requires setting mode='showing' on the specific track object in DOM, 
            // but our UI uses <track> tags for external. We need a way to support both.
            // For now, let's just list them if they exist and aren't our external ones.
            for(let i=0; i<vid.textTracks.length; i++) {
                const t = vid.textTracks[i];
                // Skip our own uploaded tracks (they have 'upload-' prefix)
                if(t.id && t.id.startsWith('upload-')) continue;

                // basic filter to avoid listing our own added <track> elements if possible
                // (though <track> elements appear in textTracks too)
                if(t.kind === 'subtitles' || t.kind === 'captions') {
                   // We'll give them a special ID prefix 'embedded-'
                   // Use the INDEX as the stable identifier for embedded tracks
                   subs.push({
                       id: `embedded-${i}`,
                       label: t.label || `Embedded Track ${i+1}`,
                       language: t.language,
                       src: '' // Not used for embedded
                   });
                }
            }
            // Only update if we found new ones different from external
            if(subs.length > 0) {
                setSubtitles(prev => {
                    // Keep existing uploaded tracks (those with src)
                    const uploaded = prev.filter(p => p.id.startsWith('upload-'));
                    
                    // Create a map of existing IDs to avoid flicker/re-render if nothing changed
                    const existingIds = new Set(prev.map(p => p.id));
                    const newIds = new Set([...uploaded.map(u => u.id), ...subs.map(s => s.id)]);
                    
                    // Simple equality check to avoid infinite render loops
                    if (existingIds.size === newIds.size && [...existingIds].every(id => newIds.has(id))) {
                        return prev;
                    }
                    
                    return [...uploaded, ...subs];
                });
            }
        }
      };
      
      // Some browsers populate tracks async
      const interval = setInterval(onTracksChanged, 1000);
      return () => clearInterval(interval);
  }, [src]);

  // Handle Subtitle track switching for Custom Overlay
  useEffect(() => {
      if(!videoRef.current) return;
      const vid = videoRef.current;
      
      const handleCueChange = (e: Event) => {
          const track = e.target as TextTrack;
          if (track && track.activeCues) {
              const cues = Array.from(track.activeCues).map(c => (c as VTTCue).text);
              setCurrentCues(cues);
          } else {
              setCurrentCues([]);
          }
      };

      // Helper to apply mode and listeners
      const applyTrackMode = () => {
          let found = false;
          Array.from(vid.textTracks).forEach((t: any) => {
              // Cleanup previous listeners to avoid dupes/leaks
              t.oncuechange = null;

              const isMatch = (t.id === activeSubtitleId || t.label === activeSubtitleId);
              // Special case for embedded tracks which we might have labeled as embedded-0 etc
              const isEmbeddedMatch = activeSubtitleId.startsWith('embedded-') && vid.textTracks[parseInt(activeSubtitleId.split('-')[1])] === t;
              
              if (activeSubtitleId !== 'off' && (isMatch || isEmbeddedMatch)) {
                  t.mode = 'hidden';
                  t.oncuechange = handleCueChange;
                  found = true;
                  
                  // Trigger immediate update in case there are already cues
                  if(t.activeCues && t.activeCues.length > 0) {
                     const cues = Array.from(t.activeCues).map((c: any) => c.text);
                     setCurrentCues(cues);
                  } else {
                     setCurrentCues([]);
                  }
              } else {
                  t.mode = 'disabled';
              }
          });
          return found;
      };

      // Initial attempt
      let found = applyTrackMode();

      // Retry mechanism for React-rendered tracks (race condition fix)
      let attempt = 0;
      const retryInterval = setInterval(() => {
          if (found || attempt > 10) {
              clearInterval(retryInterval);
              return;
          }
          found = applyTrackMode();
          attempt++;
      }, 100);
      
      return () => {
           clearInterval(retryInterval);
           Array.from(vid.textTracks).forEach((t: any) => {
               t.oncuechange = null;
           });
      };
  }, [activeSubtitleId, subtitles]);

  // --- Color Analysis Logic ---
  const generateColorBarcode = async () => {
    if (isScanningColors || !file) return;
    setIsScanningColors(true);
    setScanProgress(0);
    setColorBarcode([]);

    // Create hidden elements
    const scanVideo = document.createElement('video');
    scanVideo.src = URL.createObjectURL(file);
    scanVideo.muted = true;
    scanVideo.playsInline = true; // Crucial for iOS/Mobile
    scanVideo.crossOrigin = "anonymous";
    
    const scanCanvas = document.createElement('canvas');
    const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
    
    // Wait for metadata to get duration
    await new Promise((resolve) => {
        scanVideo.onloadedmetadata = () => resolve(true);
    });

    const duration = scanVideo.duration;
    const interval = 60; // 1 minute interval
    const samples: {time: number, color: string}[] = [];

    // Helper to capture a frame at a specific time
    const captureFrame = async (time: number) => {
        return new Promise<string>((resolve) => {
            const onSeeked = () => {
                scanVideo.removeEventListener('seeked', onSeeked);
                
                if (!ctx) return resolve('rgb(0,0,0)');
                
                // Low res capture for average color is faster
                scanCanvas.width = 10;
                scanCanvas.height = 10;
                ctx.drawImage(scanVideo, 0, 0, 10, 10);
                
                try {
                    const frameData = ctx.getImageData(0, 0, 10, 10).data;
                    let r = 0, g = 0, b = 0;
                    
                    for (let i = 0; i < frameData.length; i += 4) {
                        r += frameData[i];
                        g += frameData[i+1];
                        b += frameData[i+2];
                    }
                    
                    const count = frameData.length / 4;
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);
                    
                    resolve(`rgb(${r},${g},${b})`);
                } catch (e) {
                    resolve('rgb(20,20,20)'); // Fallback if tainted
                }
            };
            
            scanVideo.currentTime = time;
            scanVideo.addEventListener('seeked', onSeeked);
        });
    };

    // Scan loop
    for (let t = 0; t < duration; t += interval) {
        const color = await captureFrame(t);
        samples.push({ time: t, color });
        setScanProgress(Math.min(99, Math.round((t / duration) * 100)));
        // Allow UI updates
        await new Promise(r => setTimeout(r, 0));
    }

    setScanProgress(100);
    setColorBarcode(samples);
    setIsScanningColors(false);
    
    // Cleanup
    scanVideo.remove();
  };

  const onSubtitleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const renderReader = new FileReader();
      renderReader.onload = (e) => {
          const content = e.target?.result as string;
          let vttContent = content;
          if (file.name.endsWith('.srt')) {
              vttContent = srtToVtt(content);
          }
          
          const blob = new Blob([vttContent], { type: 'text/vtt' });
          const url = URL.createObjectURL(blob);
          
          const newTrack: SubtitleTrack = {
              id: `upload-${Date.now()}`,
              label: file.name,
              language: 'en',
              src: url
          };
          
          setSubtitles(prev => [...prev, newTrack]);
          setActiveSubtitleId(newTrack.id);
          
          showFeedback(<div className="flex flex-col items-center"><Check size={40} /><span className="text-sm font-black uppercase mt-2">Subtitle Added</span></div>);
      };
      renderReader.readAsText(file);
  };


  // --- Export Logic (GIF / Clip) ---
  const handleExportClip = useCallback((durationOverride?: number) => {
      if (!videoRef.current) return;
      
      const inTime = state.inPoint !== null ? state.inPoint : state.currentTime;
      const outTime = durationOverride 
          ? (inTime + durationOverride) 
          : (state.outPoint !== null ? state.outPoint : (inTime + 5));
      
      const setOut = outTime;
      
      // 1. Setup Recorder
      const stream = (videoRef.current as any).captureStream(); // Capture raw video stream
      const options = { mimeType: 'video/webm; codecs=vp9' };
      
      try {
          const mediaRecorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = mediaRecorder;
          recordedChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) recordedChunksRef.current.push(event.data);
          };
          
          mediaRecorder.onstop = () => {
              const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const fname = file.name;
              a.download = `gif_${fname}_${Math.floor(inTime)}.webm`;
              a.click();
              URL.revokeObjectURL(url);
              setIsExporting(false);
              videoRef.current?.pause();
              setState(prev => ({ ...prev, isPlaying: false }));
              showFeedback(<div className="flex flex-col items-center"><Disc size={40} className="text-white animate-spin"/><span className="text-sm font-bold uppercase tracking-widest mt-2">{durationOverride ? 'GIF Captured' : 'Clip Saved'}</span></div>);
          };

          // 2. Start Logic
          setIsExporting(true);
          videoRef.current.currentTime = inTime;
          videoRef.current.play().then(() => {
              mediaRecorder.start();
              
              // Schedule stop
              const durationMs = (setOut - inTime) * 1000;
              setTimeout(() => {
                  if (mediaRecorder.state === 'recording') {
                      mediaRecorder.stop();
                  }
              }, durationMs);
          });
          
      } catch (e) {
          console.error("Recording failed", e);
          setIsExporting(false);
      }
  }, [state.inPoint, state.outPoint, state.currentTime, file.name]);


  // --- In/Out Points Logic ---
  const setMarkIn = () => {
    setState(prev => {
        const t = videoRef.current?.currentTime || 0;
        showFeedback(<div className="flex flex-col items-center"><span className="text-yellow-400 font-bold text-xl">IN</span><span className="font-mono text-sm">{formatTimecode(t)}</span></div>);
        return { ...prev, inPoint: t };
    });
  };

  const setMarkOut = () => {
    setState(prev => {
        const t = videoRef.current?.currentTime || 0;
        showFeedback(<div className="flex flex-col items-center"><span className="text-yellow-400 font-bold text-xl">OUT</span><span className="font-mono text-sm">{formatTimecode(t)}</span></div>);
        return { ...prev, outPoint: t };
    });
  };

  const clearMarks = () => {
      setState(prev => ({...prev, inPoint: null, outPoint: null}));
  };

  // --- Segment Management with Conflict Resolution ---
  const resolveSegmentOverlaps = (newSeg: SceneSegment, existing: SceneSegment[]): SceneSegment[] => {
      const result: SceneSegment[] = [];
      existing.forEach(seg => {
          // If existing segment is outside the new segment, keep it
          if (seg.endTime <= newSeg.startTime || seg.startTime >= newSeg.endTime) {
              result.push(seg);
          }
          // If existing segment is partially inside the new segment, truncate it
          else if (seg.startTime < newSeg.startTime && seg.endTime > newSeg.endTime) {
              // Split into two
              result.push({ ...seg, id: seg.id + '_1', endTime: newSeg.startTime });
              result.push({ ...seg, id: seg.id + '_2', startTime: newSeg.endTime });
          }
          else if (seg.startTime < newSeg.startTime) {
              result.push({ ...seg, endTime: newSeg.startTime });
          }
          else if (seg.endTime > newSeg.endTime) {
              result.push({ ...seg, startTime: newSeg.endTime });
          }
          // If completely covered, it's removed (not added back to result)
      });
      result.push(newSeg);
      return result.filter(s => s.endTime - s.startTime > 0.01).sort((a, b) => a.startTime - b.startTime);
  };

  const finalizePendingSegment = useCallback(() => {
      setPendingSegment(pending => {
          if (pending) {
              const newSeg: SceneSegment = {
                  id: Date.now().toString(),
                  startTime: pending.startTime,
                  endTime: pending.endTime,
                  type: pending.type,
                  rating: currentRatingRef.current // Use ref for latest rating
              };
              
              const resolved = resolveSegmentOverlaps(newSeg, segmentsRef.current);
              setSegments(resolved);
              
              // Sync to cloud: For true integrity, we save the resulting set
              // In this prototype, we save the new segment. 
              // To handle deletions/splits in cloud, we'd need a multi-save or clear-and-save.
              saveToCloud(`segments_${file.name}`, newSeg);
              
              logInteraction('segment', { type: pending.type, rating: currentRatingRef.current });
              showFeedback(<div className="flex flex-col items-center uppercase"><Check size={40} className="text-green-500" /><span className="text-xs font-black">{pending.type} Finalized</span></div>);
          }
          return null;
      });
      setCountdown(0);
  }, [file.name, resolveSegmentOverlaps, logInteraction]);

  const addSceneSegment = useCallback((type: SceneType) => {
      // Logic used by UI buttons - triggers immediately
      const s = stateRef.current; 
      let start = s.inPoint;
      let end = s.outPoint;
      const current = videoRef.current?.currentTime || 0;

      // Auto-Gap Logic
      if (start === null && end === null) {
          end = current;
          const sorted = [...segmentsRef.current].sort((a,b) => b.endTime - a.endTime);
          const lastEnd = sorted.length > 0 ? sorted[0].endTime : 0;
          if (lastEnd < end) start = lastEnd;
          else start = Math.max(0, end - 5);
      }
      if (start !== null && end === null) end = current;
      if (start === null && end !== null) start = 0;
      
      const safeStart = Math.min(start ?? 0, end ?? 0);
      const safeEnd = Math.max(start ?? 0, end ?? 0);

      const newSeg: SceneSegment = {
          id: Date.now().toString(),
          startTime: safeStart,
          endTime: safeEnd,
          type: type,
          rating: currentRatingRef.current
      };
      
      const resolved = resolveSegmentOverlaps(newSeg, segmentsRef.current);
      setSegments(resolved);
      saveToCloud(`segments_${file.name}`, newSeg);
      
      clearMarks();
      setCurrentRating(50); 
      showFeedback(<div className="flex flex-col items-center uppercase"><span className="text-2xl font-black">{type}</span><span className="text-xs">Segment Added</span></div>);
  }, [file.name, resolveSegmentOverlaps]);

  const triggerSceneSegment = useCallback((type: SceneType) => {
      // If one is already pending, finalize it first
      if (pendingSegment) {
          finalizePendingSegment();
      }

      const s = stateRef.current;
      let start = s.inPoint;
      let end = s.outPoint;
      const current = videoRef.current?.currentTime || 0;

      // Auto-Gap Logic
      if (start === null && end === null) {
          end = current;
          const sorted = [...segmentsRef.current].sort((a,b) => b.endTime - a.endTime);
          const lastEnd = sorted.length > 0 ? sorted[0].endTime : 0;
          if (lastEnd < end) start = lastEnd;
          else start = Math.max(0, end - 5);
      }
      if (start !== null && end === null) end = current;
      if (start === null && end !== null) start = 0;
      
      const safeStart = Math.min(start ?? 0, end ?? 0);
      const safeEnd = Math.max(start ?? 0, end ?? 0);

      setPendingSegment({ type, startTime: safeStart, endTime: safeEnd });
      setCountdown(15);
      clearMarks();
      showFeedback(<div className="flex flex-col items-center uppercase"><Timer size={40} /><span className="text-xs font-black">Rating Pending...</span></div>);
  }, [pendingSegment, finalizePendingSegment]);

  const deleteSegment = (id: string) => {
      setSegments(prev => prev.filter(s => s.id !== id));
      // Note: Cloud delete not implemented in mock, would need specific ID handling
  };



  // --- Subtitle & Audio Sync Handlers ---
  useEffect(() => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    
    const updateCues = () => {
        const currentTime = vid.currentTime - state.subtitleSync; // Apply delay
        const active: string[] = [];
        
        for (let i = 0; i < vid.textTracks.length; i++) {
            const track = vid.textTracks[i];
            // Check if track is active
            if (track.mode === 'showing' || track.mode === 'hidden') {
                const cues = track.cues;
                if (cues) {
                    for (let j = 0; j < cues.length; j++) {
                        const cue = cues[j] as VTTCue;
                        if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
                            active.push(cue.text);
                        }
                    }
                }
            }
        }
        setCurrentCues(active);
    };

    vid.addEventListener('timeupdate', updateCues);
    return () => vid.removeEventListener('timeupdate', updateCues);
  }, [state.subtitleSync, activeSubtitleId]);

  const handleAudioTrackSelect = (id: string) => {
      const vid = videoRef.current as any;
      if (vid && vid.audioTracks) {
          for (let i = 0; i < vid.audioTracks.length; i++) {
              vid.audioTracks[i].enabled = (i.toString() === id);
          }
          // Update State
          setAudioTracks(prev => prev.map(t => ({...t, enabled: t.id === id})));
      }
  };

  // --- Drawing ---
  useEffect(() => {
      if (!isDrawingMode) { setCurrentAnnotation(null); return; }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
          if (videoRef.current) {
              canvas.width = videoRef.current.clientWidth;
              canvas.height = videoRef.current.clientHeight;
          }
      };
      window.addEventListener('resize', resize);
      resize();
      return () => window.removeEventListener('resize', resize);
  }, [isDrawingMode, state.isFullscreen]);

  const startDrawing = (e: React.MouseEvent) => {
      if (!isDrawingMode || !canvasRef.current) return;
      setIsDrawing(true);
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCurrentAnnotation({ points: [{x, y}], color: brushColor, width: brushSize });
  };

  const draw = (e: React.MouseEvent) => {
      if (!isDrawing || !isDrawingMode || !currentAnnotation || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newPoints = [...currentAnnotation.points, {x, y}];
      setCurrentAnnotation({ ...currentAnnotation, points: newPoints });
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
          ctx.strokeStyle = currentAnnotation.color;
          ctx.lineWidth = currentAnnotation.width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(currentAnnotation.points[currentAnnotation.points.length-1].x, currentAnnotation.points[currentAnnotation.points.length-1].y);
          ctx.lineTo(x, y);
          ctx.stroke();
      }
  };

  const captureFrameToCanvas = (): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.5);
    }
    return null;
  };

  const addNote = (annotation?: AnnotationLine) => {
      if (!videoRef.current) return;
      const timestamp = videoRef.current.currentTime;
      const thumbnail = captureFrameToCanvas() || undefined;
      
      const newNote: Note = {
        id: Date.now().toString(),
        timestamp,
        text: annotation ? 'Visual Annotation' : 'New Note',
        tags: [],
        thumbnail,
        drawing: annotation ? [annotation] : undefined
      };
      
      setNotes(prev => [newNote, ...prev].sort((a, b) => b.timestamp - a.timestamp));
      saveToCloud(`notes_${file.name}`, { ...newNote, filename: file.name });
      logInteraction('note', { text: newNote.text });
  };

  const stopDrawing = () => {
      if (isDrawing && currentAnnotation) {
          addNote(currentAnnotation);
      }
      setIsDrawing(false);
      setCurrentAnnotation(null);
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
  };

  // --- Loupe ---
  // --- Auto-Hide Controls Logic ---
  const handleActivity = useCallback(() => {
      setState(prev => ({ ...prev, showControls: true }));
      
      if (hideControlsTimeoutRef.current) {
          clearTimeout(hideControlsTimeoutRef.current);
      }

      // Only auto-hide if playing and not interacting with a menu (simplified check)
      // referencing stateRef to avoid stale closures if this is attached to listeners
      if (stateRef.current.isPlaying) {
          hideControlsTimeoutRef.current = setTimeout(() => {
              setState(prev => ({ ...prev, showControls: false }));
          }, 10000);
      }
  }, []);

  // Effect to start timer when play starts
  useEffect(() => {
     if (state.isPlaying) {
         handleActivity();
     } else {
         setState(prev => ({ ...prev, showControls: true }));
         if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
     }
  }, [state.isPlaying, handleActivity]);

  const handleLoupeMove = (e: React.MouseEvent) => {
      handleActivity(); // keep controls alive or just activity

      if (!state.isLoupeActive || !loupeCanvasRef.current || !videoRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLoupePos({ x, y });
      const ctx = loupeCanvasRef.current.getContext('2d');
      if (ctx) {
          const scaleX = videoRef.current.videoWidth / rect.width;
          const scaleY = videoRef.current.videoHeight / rect.height;
          const sx = x * scaleX;
          const sy = y * scaleY;
          ctx.imageSmoothingEnabled = false; 
          ctx.drawImage(videoRef.current, sx - 25, sy - 25, 50, 50, 0, 0, 200, 200);
      }
  };

  // --- Standard Handlers ---
  const togglePlay = useCallback(() => {
    initAudioContext();
    if (videoRef.current) {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
        compareVideoRef.current?.pause();
        showFeedback(<Pause size={40} fill="currentColor" />);
        setState(prev => ({ ...prev, isPlaying: false }));
        logInteraction('pause');
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Playback failed:", error);
                // Potential fallback if audio context blocks playback
            });
        }
        compareVideoRef.current?.play();
        showFeedback(<Play size={40} fill="currentColor" />);
        setState(prev => ({ ...prev, isPlaying: true }));
        logInteraction('play');
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const elem = containerRef.current as any;
    if (!elem) return;

    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && !(document as any).mozFullScreenElement && !(document as any).msFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) { /* Safari */
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) { /* IE11 */
        (document as any).msExitFullscreen();
      }
    }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      
      // Update Heatmap
      const duration = videoRef.current.duration || 1;
      const progressPercent = Math.min(99, Math.max(0, Math.floor((current / duration) * 100)));
      // Increment heatmap bucket
      if (state.isPlaying) {
        attentionHeatmapRef.current[progressPercent] += 1;
      }

      // Export Logic Check
      if (isExporting && state.outPoint !== null) {
          if (current >= state.outPoint) {
              mediaRecorderRef.current?.stop();
              return;
          }
      }

      const progress = (current / duration) * 100;
      if (compareVideoRef.current && Math.abs(compareVideoRef.current.currentTime - current) > 0.5) {
          compareVideoRef.current.currentTime = current;
      }
      setState(prev => ({ ...prev, currentTime: current, progress, isBuffering: false }));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (videoRef.current) {
      const time = (value / 100) * (videoRef.current.duration || 1);
      videoRef.current.currentTime = time;
      if (compareVideoRef.current) compareVideoRef.current.currentTime = time;
      setState(prev => ({ ...prev, progress: value, currentTime: time }));
      logInteraction('seek', { to: time });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      if(videoRef.current) videoRef.current.volume = v;
      if(compareVideoRef.current) compareVideoRef.current.volume = 0;
      setState(prev => ({ ...prev, volume: v, isMuted: v===0 }));
  };
  
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const isMuted = !videoRef.current.muted;
      videoRef.current.muted = isMuted;
      setState(prev => ({ ...prev, isMuted }));
      showFeedback(isMuted ? <VolumeX size={40} /> : <Volume2 size={40} />);
    }
  }, []);

  const handlePlaybackRate = (r: number) => {
      if(videoRef.current) videoRef.current.playbackRate = r;
      if(compareVideoRef.current) compareVideoRef.current.playbackRate = r;
      setState(prev => ({...prev, playbackRate: r}));
      showFeedback(<span className="text-2xl font-bold">{r}x</span>);
  };

  const showFeedback = (icon: React.ReactNode) => {
    setFeedbackIcon(icon);
    setTimeout(() => setFeedbackIcon(null), 600);
  };

  const ratingBufferRef = useRef<string>("");
  const ratingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Keyboard Controls ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((document.activeElement?.tagName) || '')) return;
      if (!videoRef.current) return;

      const key = e.key.toLowerCase();

      // Number Input for Rating
      if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          if (ratingTimeoutRef.current) clearTimeout(ratingTimeoutRef.current);

          const newBuffer = ratingBufferRef.current + e.key;
          const val = parseInt(newBuffer);

          if (val <= 100) {
              ratingBufferRef.current = newBuffer;
              setCurrentRating(val);
              showFeedback(<div className="flex flex-col items-center"><TrendingUp size={40} /><span className="text-2xl font-black">{val}</span></div>);
          } else {
              // Reset if > 100 (e.g. typing a new number sequence)
              ratingBufferRef.current = e.key;
              setCurrentRating(parseInt(e.key));
              showFeedback(<div className="flex flex-col items-center"><TrendingUp size={40} /><span className="text-2xl font-black">{e.key}</span></div>);
          }

          ratingTimeoutRef.current = setTimeout(() => {
              ratingBufferRef.current = "";
          }, 1500);
          return;
      }

      // Genre Shortcuts Logic
      const performTrigger = (type: SceneType) => {
          e.preventDefault();
          triggerSceneSegment(type);
      };

      switch(key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        
        case 'enter':
          if (pendingSegment) {
              e.preventDefault();
              finalizePendingSegment();
          }
          break;

        case 'escape':
          if (pendingSegment) {
              e.preventDefault();
              setPendingSegment(null);
              setCountdown(0);
          }
          break;

        // Navigation
        case 'arrowright':
        case 'l':
          e.preventDefault();
          {
             const t = Math.min(videoRef.current.duration, videoRef.current.currentTime + (key === 'l' ? 10 : 5));
             videoRef.current.currentTime = t;
             if (compareVideoRef.current) compareVideoRef.current.currentTime = t;
             setState(prev => ({ ...prev, currentTime: t, progress: (t / (videoRef.current?.duration || 1)) * 100 }));
             showFeedback(<div className="flex flex-col items-center"><ChevronRight size={40} /><span className="text-xl font-bold">+{key === 'l' ? 10 : 5}s</span></div>);
          }
          break;

        case 'arrowleft':
        case 'j':
          e.preventDefault();
          {
             const t = Math.max(0, videoRef.current.currentTime - (key === 'j' ? 10 : 5));
             videoRef.current.currentTime = t;
             if (compareVideoRef.current) compareVideoRef.current.currentTime = t;
             setState(prev => ({ ...prev, currentTime: t, progress: (t / (videoRef.current?.duration || 1)) * 100 }));
             showFeedback(<div className="flex flex-col items-center"><ChevronRight className="rotate-180" size={40} /><span className="text-xl font-bold">-{key === 'j' ? 10 : 5}s</span></div>);
          }
          break;

        case 'arrowup':
          e.preventDefault();
          {
             const v = Math.min(1, videoRef.current.volume + 0.1);
             videoRef.current.volume = v;
             setState(prev => ({ ...prev, volume: v, isMuted: v === 0 }));
             showFeedback(<div className="flex flex-col items-center"><Volume2 size={40} /><span className="text-xl font-bold">{Math.round(v*100)}%</span></div>);
          }
          break;

        case 'arrowdown':
          e.preventDefault();
          {
             const v = Math.max(0, videoRef.current.volume - 0.1);
             videoRef.current.volume = v;
             setState(prev => ({ ...prev, volume: v, isMuted: v === 0 }));
             showFeedback(<div className="flex flex-col items-center"><Volume2 size={40} /><span className="text-xl font-bold">{Math.round(v*100)}%</span></div>);
          }
          break;

        case 'm':
          e.preventDefault();
          toggleMute();
          break;

        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;

        // Genre Shortcuts Logic
        case 'a': performTrigger('action'); break;
        case 'c': performTrigger('comedy'); break;
        case 'd': performTrigger('drama'); break;
        case 't': performTrigger('thriller'); break;
        case 's': performTrigger('song'); break;
        case 'w': performTrigger('twist'); break; 
        case 'h': performTrigger('horror'); break;
        case 'r': performTrigger('romance'); break;
        case 'v': performTrigger('dialogue'); break; 
        case 'u': performTrigger('suspense'); break;
        case 'i': performTrigger('sci-fi'); break;
        case 'z': performTrigger('technical'); break;
        case 'e': performTrigger('montage'); break;
        case 'n': performTrigger('musical'); break;
        case 'q': performTrigger('mystery'); break;
        case 'b': performTrigger('bg-score'); break;
        case 'p':
          e.preventDefault();
          addNote();
          showFeedback(<div className="flex flex-col items-center"><Camera size={40} /><span className="text-xs font-black uppercase mt-2">Snapshot Added to Journal</span></div>);
          break;
        
        case 'g':
          e.preventDefault();
          const duration = window.prompt("Enter duration for GIF capture (seconds):", "3");
          if (duration) {
              const d = parseFloat(duration);
              if (!isNaN(d) && d > 0) {
                  handleExportClip(d);
              }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, addSceneSegment, pendingSegment, finalizePendingSegment, triggerSceneSegment, addNote, handleExportClip]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex overflow-hidden" ref={containerRef}>
       {/* Main Video Area with Controls Integrated */}
       <div 
          className={`relative flex-1 bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${state.showControls || !state.isPlaying ? 'cursor-default' : 'cursor-none'}`}
          onDoubleClick={toggleFullscreen}
          onMouseMove={handleActivity}
          onClick={handleActivity}
          onKeyDown={handleActivity}
       >
          
          {/* Video Layer */}
          <video 
            key={state.isPureNativeAudio ? 'native' : 'pro'}
            ref={videoRef}
            src={src}
            className={`transition-all duration-300 ${state.scalingMode === 'cover' ? 'w-full h-full object-cover' : 'w-full h-full object-contain'} ${state.visualFilter === 'monochrome' ? 'grayscale' : ''} ${state.visualFilter === 'negative' ? 'invert' : ''}`}
            style={{ 
                filter: state.visualFilter === 'false-color' ? 'hue-rotate(180deg) invert(1)' : undefined
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
                setState(prev => ({ ...prev, duration: videoRef.current?.duration || 0 }));
                if (!state.isPureNativeAudio) initAudioContext();
            }}
            onError={(e) => {
                const vid = e.currentTarget;
                let message = "Codec error: Browser cannot play this format.";
                if (vid.error) {
                    switch (vid.error.code) {
                        case 1: message = "Aborted: Media fetch stopped."; break;
                        case 2: message = "Network Error: Failed to download media."; break;
                        case 3: message = "Decode Error: Video/Audio codec unsupported."; break;
                        case 4: message = "Format Error: Browser cannot play this MKV/MP4 variation."; break;
                    }
                }
                setState(s => ({ ...s, error: message }));
                showFeedback(<div className="flex flex-col items-center bg-red-600/80 p-6 rounded border border-white/20"><AlertTriangle size={48} className="mb-2"/><span className="text-xl font-bold uppercase tracking-widest">{message}</span><span className="text-[10px] mt-2 opacity-80">Check browser MKV/HEVC support</span></div>);
            }}
            onClick={togglePlay}
            playsInline
            crossOrigin="anonymous" // Support max quality / CORS for audio analysis
          >
              {subtitles.map(track => {
                  if(!track.src) return null; // Don't render <track> for embedded subs (they exist natively)
                  return (
                  <track 
                      key={track.id}
                      id={track.id} 
                      kind="subtitles"
                      src={track.src}
                      label={track.label}
                      srcLang={track.language}
                      // Mode is managed via the useEffect above
                  />
              )})}
          </video>

          {/* KMPlayer Style Subtitle Overlay */}
          {currentCues.length > 0 && (
              <div 
                className="absolute left-0 right-0 z-40 pointer-events-none flex flex-col items-center justify-end px-12"
                style={{ 
                    bottom: `${15 + state.subtitlePosition}%`, // Customizable position
                }}
              >
                  {currentCues.map((text, i) => (
                      <div 
                        key={i} 
                        className="text-center drop-shadow-[0_2px_4px_rgba(0,0,0,1)] font-bold transition-all"
                        style={{ 
                            fontSize: `${state.subtitleSize}px`,
                            color: '#ffffff', // Typical KMPlayer white (can add toggle for Yellow)
                            textShadow: '2px 2px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000, 0px 1px 0px #000',
                            backgroundColor: 'rgba(0,0,0,0.05)', // Subtle background
                            padding: '4px 8px',
                            lineHeight: '1.2'
                        }}
                        dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }}
                      />
                  ))}
              </div>
          )}
          
          {/* Compare Video Layer (Split Screen) */}
          {state.isCompareMode && (
              <div className="absolute inset-0 w-1/2 overflow-hidden border-r border-white/50 bg-black z-10 pointer-events-none">
                 <video 
                    ref={compareVideoRef}
                    src={src} // compare with self for now, or grading check
                    className={`absolute left-0 top-1/2 -translate-y-1/2 ${state.scalingMode === 'cover' ? 'w-full h-full object-cover' : 'max-w-none'}`}
                    style={state.scalingMode !== 'cover' ? { 
                        width: videoRef.current?.clientWidth,
                        height: videoRef.current?.clientHeight,
                    } : undefined}
                 />
                 <div className="absolute top-4 left-4 bg-black/50 px-2 py-1 text-xs font-bold border border-white/20 rounded">ORIGINAL</div>
              </div>
          )}

          {/* Canvas Layers */}
          <canvas 
            ref={canvasRef}
            className={`absolute inset-0 z-20 ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
          />
          
          {/* Loupe Canvas (Hidden, used for processing) */}
          <canvas ref={loupeCanvasRef} className="hidden" width={200} height={200} />
          
          {/* Loupe Overlay */}
          {state.isLoupeActive && (
              <div 
                className="absolute w-48 h-48 rounded-full border-4 border-white shadow-2xl overflow-hidden z-30 pointer-events-none"
                style={{ 
                    left: loupePos.x - 96, 
                    top: loupePos.y - 96,
                }}
              >
                 <canvas 
                    width={200} height={200} 
                    ref={(c) => {
                        if(c && loupeCanvasRef.current) {
                            const ctx = c.getContext('2d');
                            ctx?.drawImage(loupeCanvasRef.current, 0, 0);
                        }
                    }}
                 />
              </div>
          )}

          {/* Grid Overlays */}
          {gridMode !== 'none' && (
              <div className="absolute inset-0 pointer-events-none z-10">
                  {gridMode === 'thirds' && (
                      <>
                          <div className="absolute top-1/3 left-0 w-full h-px bg-white/30"></div>
                          <div className="absolute top-2/3 left-0 w-full h-px bg-white/30"></div>
                          <div className="absolute left-1/3 top-0 h-full w-px bg-white/30"></div>
                          <div className="absolute left-2/3 top-0 h-full w-px bg-white/30"></div>
                      </>
                  )}
                  {gridMode === 'golden' && (
                      <>
                          <div className="absolute top-[38.2%] left-0 w-full h-px bg-white/30"></div>
                          <div className="absolute top-[61.8%] left-0 w-full h-px bg-white/30"></div>
                          <div className="absolute left-[38.2%] top-0 h-full w-px bg-white/30"></div>
                          <div className="absolute left-[61.8%] top-0 h-full w-px bg-white/30"></div>
                      </>
                  )}
                  {gridMode === 'crosshair' && (
                      <>
                          <div className="absolute top-1/2 left-0 w-full h-px bg-white/30"></div>
                          <div className="absolute left-1/2 top-0 h-full w-px bg-white/30"></div>
                      </>
                  )}
                  {gridMode === 'diagonal' && (
                      <svg className="absolute inset-0 w-full h-full">
                          <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                          <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                      </svg>
                  )}
              </div>
          )}

          {/* Feedback Icon */}
          {feedbackIcon && (
              <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none animate-in zoom-in fade-out duration-500">
                  <div className="bg-black/60 backdrop-blur-md p-6 rounded-3xl text-white shadow-2xl">
                      {feedbackIcon}
                  </div>
              </div>
          )}

          {/* Pending Segment HUD */}
          {pendingSegment && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4">
                  <div className="bg-[#0a0a0a]/90 backdrop-blur-sm border border-indigo-500/30 px-6 py-4 rounded-none flex items-center gap-6 shadow-none">
                      <div className="flex flex-col">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Pending Entry</span>
                          <span className="text-2xl font-[1000] text-white uppercase italic leading-none">{pendingSegment.type}</span>
                      </div>
                      
                      <div className="h-10 w-px bg-white/10" />
                      
                      <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Rating</span>
                          <span className="text-2xl font-black text-indigo-500 leading-none">{currentRating}</span>
                      </div>

                      <div className="h-10 w-px bg-white/10" />

                      <div className="relative w-12 h-12 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90">
                              <circle 
                                cx="24" cy="24" r="20" fill="transparent" 
                                stroke="rgba(255,255,255,0.1)" strokeWidth="4" 
                              />
                              <circle 
                                cx="24" cy="24" r="20" fill="transparent" 
                                stroke="#6366f1" strokeWidth="4" 
                                strokeDasharray={125.6}
                                strokeDashoffset={125.6 * (1 - countdown / 15)}
                                className="transition-all"
                              />
                          </svg>
                          <span className="absolute text-lg font-black text-white">{countdown}</span>
                      </div>

                      <div className="flex items-center gap-2 ml-2">
                           <button 
                             onClick={finalizePendingSegment}
                             className="p-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-all active:scale-95 cursor-pointer"
                           >
                               <Check size={20} />
                           </button>
                           <button 
                             onClick={() => { setPendingSegment(null); setCountdown(0); }}
                             className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-all cursor-pointer"
                           >
                               <X size={20} />
                           </button>
                      </div>
                  </div>
              </div>
          )}

          {/* Hover Loupe Event Capture (invisible layer) */}
          {state.isLoupeActive && (
              <div className="absolute inset-0 z-25 cursor-none" onMouseMove={handleLoupeMove} onClick={() => setState(s => ({...s, isLoupeActive: false}))}></div>
          )}

          {/* Controls - Moved Inside Main Area to respect margins */}
          <VideoControls 
                state={state}
                shots={shots}
                segments={segments}
                subtitles={subtitles}
                audioTracks={audioTracks}
                onPlayPause={togglePlay}
                onSeek={handleSeek}
                onVolumeChange={handleVolumeChange}
                onToggleMute={toggleMute}
                onToggleFullscreen={toggleFullscreen}
                onPlaybackRateChange={handlePlaybackRate}
                onTogglePiP={() => document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture()}
                onToggleCinemaMode={() => setState(s => ({...s, isCinemaMode: !s.isCinemaMode}))}
                onFilterChange={(f) => setState(s => ({...s, visualFilter: f}))}
                onToggleLoupe={() => setState(s => ({...s, isLoupeActive: !s.isLoupeActive}))}
                onToggleAudioChannel={toggleAudioChannel}
                onToggleCompare={() => setState(s => ({...s, isCompareMode: !s.isCompareMode}))}
                onToggleDrawing={() => setIsDrawingMode(!isDrawingMode)}
                onSubtitleSelect={(id) => setActiveSubtitleId(id)}
                onAudioTrackSelect={handleAudioTrackSelect}
                onSubtitleUpload={() => subtitleInputRef.current?.click()}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onToggleScaling={() => setState(s => ({...s, scalingMode: s.scalingMode === 'contain' ? 'cover' : 'contain'}))}
                onGridModeChange={(mode) => setGridMode(mode)}
                gridMode={gridMode}
                activeSubtitleId={activeSubtitleId}
                isDrawingMode={isDrawingMode}
                isSidebarOpen={isSidebarOpen}
                title={formatMovieName(file.name)}
                brushColor={brushColor}
                setBrushColor={setBrushColor}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                onSubtitleSyncChange={(val) => setState(s => ({ ...s, subtitleSync: val }))}
                onAudioSyncChange={(val) => setState(s => ({ ...s, audioSync: val }))}
                onSubtitleSizeChange={(val) => setState(s => ({ ...s, subtitleSize: val }))}
                onSubtitlePositionChange={(val) => setState(s => ({ ...s, subtitlePosition: val }))}
                onToggleAudioBypass={() => setState(s => ({ ...s, isAudioBypass: !s.isAudioBypass }))}
                onTogglePureNative={() => setState(s => ({ ...s, isPureNativeAudio: !s.isPureNativeAudio }))}
           />

       </div>

       {/* Sidebar */}
       <div className={`absolute top-0 right-0 h-full bg-[#0a0a0a]/90 backdrop-blur-2xl border-l border-white/10 w-80 transition-transform duration-300 z-[60] flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} ${state.isFullscreen ? 'shadow-2xl' : ''}`}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex gap-4">
                    <button onClick={() => setActiveSidebarTab('storyboard')} className={`text-xs font-bold uppercase ${activeSidebarTab === 'storyboard' ? 'text-white' : 'text-gray-500'}`}>Storyboard</button>
                    <button onClick={() => setActiveSidebarTab('scenes')} className={`text-xs font-bold uppercase ${activeSidebarTab === 'scenes' ? 'text-white' : 'text-gray-500'}`}>Scenes</button>
                    <button onClick={() => setActiveSidebarTab('monitor')} className={`text-xs font-bold uppercase ${activeSidebarTab === 'monitor' ? 'text-white' : 'text-gray-500'}`}>Monitor</button>
                </div>
                <button onClick={() => setIsSidebarOpen(false)}><ChevronRight size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pb-20 p-4 custom-scrollbar">
                {activeSidebarTab === 'storyboard' && (
                    <div className="space-y-4">
                        <button onClick={() => addNote()} className="w-full py-3 bg-white/5 border border-white/10 rounded-none text-sm font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors uppercase tracking-widest">
                            <Plus size={16} /> Add Timestamped Note
                        </button>
                        {notes.map(note => (
                            <div key={note.id} className="bg-[#0a0a0a] p-3 rounded-none border border-white/5 group">
                                <div className="flex justify-between items-start mb-2">
                                    <span 
                                        onClick={() => { if(videoRef.current) videoRef.current.currentTime = note.timestamp; }}
                                        className="text-indigo-400 font-mono text-xs cursor-pointer hover:underline"
                                    >
                                        {formatTimecode(note.timestamp)}
                                    </span>
                                    <button onClick={() => setNotes(notes.filter(n => n.id !== note.id))} className="text-gray-600 hover:text-red-500"><Trash2 size={12} /></button>
                                </div>
                                {note.thumbnail && <img src={note.thumbnail} className="w-full h-20 object-cover rounded-none mb-2 opacity-80" />}
                                <textarea 
                                    className="w-full bg-transparent text-sm text-gray-300 focus:outline-none resize-none"
                                    rows={2}
                                    value={note.text}
                                    onChange={(e) => setNotes(notes.map(n => n.id === note.id ? {...n, text: e.target.value} : n))}
                                    placeholder="Enter note..."
                                />
                            </div>
                        ))}
                        {notes.length === 0 && <div className="text-gray-600 text-xs text-center py-10">No notes yet.</div>}
                    </div>
                )}
                
                {activeSidebarTab === 'scenes' && (
                    <div className="space-y-4">
                        {/* 0-100 Rating Slider Component */}
                        <div className="bg-[#0a0a0a] p-4 rounded-none border border-white/5 flex flex-col gap-3 mb-4">
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rate This Moment</div>
                                <div className="flex items-center gap-1.5">
                                    <TrendingUp size={12} className="text-indigo-500" />
                                    <div className="text-xl font-black text-white font-mono leading-none">
                                        {currentRating}
                                        <span className="text-[10px] text-gray-600 ml-1 font-bold">/ 100</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative h-6 flex items-center">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    step="1"
                                    value={currentRating} 
                                    onChange={(e) => setCurrentRating(parseInt(e.target.value))}
                                    className="w-full h-1 bg-white/10 rounded-none appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                                />
                                {/* Track highlights */}
                                <div className="absolute inset-x-0 h-1 bg-indigo-500/50 rounded-none pointer-events-none" style={{ width: `${currentRating}%` }}></div>
                            </div>
                            
                            <div className="flex justify-between text-[8px] font-black text-gray-600 uppercase tracking-tighter">
                                <span>Quiet</span>
                                <span>Moderate</span>
                                <span>Peak Intensity</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {SCENE_TYPES.map(type => (
                                    <button 
                                        key={type}
                                        onClick={() => addSceneSegment(type)}
                                        className="group/btn px-2 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-none flex flex-col items-center gap-1 transition-all active:scale-95 overflow-hidden relative"
                                    >
                                         <div 
                                           className="w-2 h-2 rounded-none transition-shadow group-hover/btn:shadow-[0_0_8px_currentColor]" 
                                           style={{ 
                                             backgroundColor: 
                                               type === 'action' ? '#ef4444' : 
                                               type === 'comedy' ? '#eab308' : 
                                               type === 'drama' ? '#3b82f6' : 
                                               type === 'thriller' ? '#8b5cf6' : 
                                               type === 'twist' ? '#d946ef' : 
                                               type === 'song' ? '#ec4899' : 
                                               type === 'horror' ? '#22c55e' : 
                                               type === 'romance' ? '#f43f5e' : 
                                               type === 'suspense' ? '#f97316' :
                                               type === 'sci-fi' ? '#06b6d4' :
                                               type === 'technical' ? '#64748b' :
                                               type === 'montage' ? '#84cc16' :
                                               type === 'musical' ? '#6366f1' :
                                               type === 'mystery' ? '#10b981' :
                                               type === 'bg-score' ? '#f59e0b' :
                                               type === 'dialogue' ? '#f8fafc' :
                                               '#ffffff'
                                           }} 
                                         />
                                         <span className="text-[9px] font-bold uppercase text-gray-400 group-hover/btn:text-white transition-colors">{type}</span>
                                         <span className="absolute top-1 right-1 text-[7px] font-black text-white/20 group-hover/btn:text-indigo-400 transition-colors uppercase">
                                            {
                                              type === 'action' ? 'A' :
                                              type === 'comedy' ? 'C' :
                                              type === 'drama' ? 'D' :
                                              type === 'thriller' ? 'T' :
                                              type === 'song' ? 'S' :
                                              type === 'twist' ? 'W' :
                                              type === 'horror' ? 'H' :
                                              type === 'romance' ? 'R' :
                                              type === 'dialogue' ? 'V' :
                                              type === 'suspense' ? 'U' :
                                              type === 'sci-fi' ? 'I' :
                                              type === 'technical' ? 'Z' :
                                              type === 'montage' ? 'E' :
                                              type === 'musical' ? 'N' :
                                              type === 'mystery' ? 'Q' :
                                              type === 'bg-score' ? 'B' : ''
                                            }
                                         </span>
                                     <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                        
                        <div className="space-y-2 mt-4">
                            {segments.map(seg => (
                                <div key={seg.id} className="bg-[#0a0a0a] p-3 rounded-none border border-white/5 flex gap-3 group/seg">
                                    <div className="w-1 bg-white/20 rounded-none group-hover/seg:bg-indigo-500 transition-colors"></div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-black uppercase text-white">{seg.type}</span>
                                            {seg.rating !== undefined && (
                                                <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-none">
                                                    <Zap size={8} className="text-indigo-400 fill-indigo-400" />
                                                    <span className="text-[10px] font-black text-indigo-400">{seg.rating}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-mono text-gray-500 block mb-1">{formatTimecode(seg.startTime)} - {formatTimecode(seg.endTime)}</span>
                                        {editingSegmentId === seg.id ? (
                                            <input 
                                                autoFocus
                                                className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-gray-300"
                                                value={seg.description || ''}
                                                onChange={(e) => {
                                                    setSegments(segments.map(s => s.id === seg.id ? {...s, description: e.target.value} : s));
                                                }}
                                                onBlur={() => setEditingSegmentId(null)}
                                                placeholder="Scene description..."
                                            />
                                        ) : (
                                            <p onClick={() => setEditingSegmentId(seg.id)} className="text-xs text-gray-400 hover:text-white cursor-text min-h-[1.5em] line-clamp-2">
                                                {seg.description || "Add description..."}
                                            </p>
                                        )}
                                    </div>
                                    <button onClick={() => deleteSegment(seg.id)} className="text-gray-700 hover:text-red-500 self-start transition-colors"><X size={12} /></button>
                                </div>
                            ))}
                            <div className="flex justify-center gap-4 mt-4">
                                <button onClick={setMarkIn} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Set IN</button>
                                <div className="w-px h-3 bg-white/10" />
                                <button onClick={setMarkOut} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Set OUT</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeSidebarTab === 'monitor' && (
                    <div className="space-y-6">
                        <div className="bg-[#0a0a0a] p-4 rounded-none border border-white/5">
                            <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Realtime Waveform</h4>
                            <canvas ref={monitorCanvasRef} width={240} height={80} className="w-full h-24 bg-black/50 rounded-none border border-white/10" />
                            <div className="flex justify-between text-[9px] text-gray-600 mt-2 font-mono">
                                <span>-60f</span>
                                <span>LIVE</span>
                            </div>
                        </div>

                        <div className="bg-[#0a0a0a] p-4 rounded-none border border-white/5">
                            <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Color Histogram</h4>
                            <div className="flex h-12 gap-px mb-2 overflow-hidden rounded-none bg-black/40">
                                 {(realtimeColors.avg || []).map((c, i) => (
                                     <div key={i} className="flex-1" style={{ backgroundColor: c }} title={c} />
                                 ))}
                             </div>
                             <div className="h-32 w-full bg-black/50 rounded-none border border-white/10 relative overflow-hidden">
                                 <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                     {/* Red Channel */}
                                     <path 
                                         d={`M 0 100 ${realtimeColors.histogram.map((h, i) => `L ${i} ${100 - h.r * 100}`).join(' ')} L 100 100`} 
                                         fill="rgba(239, 68, 68, 0.2)" stroke="rgba(239, 68, 68, 0.8)" strokeWidth="0.5"
                                     />
                                     {/* Green Channel */}
                                     <path 
                                         d={`M 0 100 ${realtimeColors.histogram.map((h, i) => `L ${i} ${100 - h.g * 100}`).join(' ')} L 100 100`} 
                                         fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.8)" strokeWidth="0.5"
                                     />
                                     {/* Blue Channel */}
                                     <path 
                                         d={`M 0 100 ${realtimeColors.histogram.map((h, i) => `L ${i} ${100 - h.b * 100}`).join(' ')} L 100 100`} 
                                         fill="rgba(59, 130, 246, 0.2)" stroke="rgba(59, 130, 246, 0.8)" strokeWidth="0.5"
                                     />
                                 </svg>
                             </div>
                        </div>

                        <div className="bg-[#0a0a0a] p-4 rounded-none border border-white/5">
                             <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Intensity Mapping</h4>
                             <div className="h-24 w-full bg-black/50 rounded-none border border-white/10 relative overflow-visible">
                                 <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                     <defs>
                                         <linearGradient id="sidebarIntensityGrad" x1="0" y1="0" x2="0" y2="1">
                                             <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                                             <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                                         </linearGradient>
                                     </defs>
                                     {segments.length > 0 ? (
                                         <path 
                                            d={`M 0 100 ${segments.sort((a,b) => a.startTime - b.startTime).map((seg) => {
                                                const x = (seg.startTime / (videoRef.current?.duration || 1)) * 1000;
                                                const y = 100 - (seg.rating || 0);
                                                const midX = ((seg.startTime + seg.endTime) / 2 / (videoRef.current?.duration || 1)) * 1000;
                                                return `L ${x} ${y} Q ${midX} ${y} ${(seg.endTime / (videoRef.current?.duration || 1)) * 1000} ${y}`;
                                            }).join(' ')} L 1000 100 Z`}
                                            fill="url(#sidebarIntensityGrad)"
                                            stroke="#6366f1"
                                            strokeWidth="1.5"
                                         />
                                     ) : (
                                         <text x="500" y="55" textAnchor="middle" fill="#333" className="text-[10px] uppercase font-black">Waiting for Data</text>
                                     )}
                                 </svg>
                                 <div className="absolute inset-0 flex">
                                     {segments.map(seg => (
                                         <div 
                                             key={seg.id}
                                             className="h-full hover:bg-white/5 transition-all cursor-pointer group relative"
                                             style={{
                                                 width: `${((seg.endTime - seg.startTime) / (videoRef.current?.duration || 1)) * 100}%`,
                                             }}
                                             onClick={() => { if(videoRef.current) videoRef.current.currentTime = seg.startTime; }}
                                         >
                                             <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap z-50 font-bold shadow-xl border border-white/10">
                                                 {(seg.type || 'scene').toUpperCase()}: {seg.rating}%
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                        
                        <div className="bg-[#0a0a0a] p-4 rounded-none border border-white/5">
                             <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Color Barcode</h4>
                                <button 
                                    onClick={generateColorBarcode} 
                                    disabled={isScanningColors}
                                    className="text-[10px] px-2 py-1 bg-white/10 rounded hover:bg-white/20 disabled:opacity-50"
                                >
                                    {isScanningColors ? `${scanProgress}%` : 'GENERATE'}
                                </button>
                             </div>
                             <div className="h-40 w-full flex bg-black rounded-none overflow-hidden relative">
                                 {colorBarcode.map((bar, i) => (
                                     <div 
                                        key={i} 
                                        className="h-full flex-1" 
                                        style={{ backgroundColor: bar.color }} 
                                        title={`Time: ${formatTimecode(bar.time)}`}
                                        onClick={() => { if(videoRef.current) videoRef.current.currentTime = bar.time; }}
                                     />
                                 ))}
                                 {colorBarcode.length === 0 && !isScanningColors && (
                                     <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">
                                         Click Generate to scan movie colors
                                     </div>
                                 )}
                             </div>
                        </div>
                    </div>
                )}
            </div>
       </div>

        {/* Top Bar (Close) */}
        <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-start pointer-events-none">
            <button onClick={onClose} className="bg-black/50 p-2 border border-white/20 hover:bg-white text-white hover:text-black transition-colors rounded-none pointer-events-auto"><X size={20}/></button>
            
            <div className="flex gap-2 pointer-events-auto">
                <button 
                    onClick={() => {
                        const newBypass = !state.isAudioBypass;
                        setState(s => ({ ...s, isAudioBypass: newBypass }));
                        showFeedback(<div className="flex flex-col items-center"><Speaker size={40} className={newBypass ? 'text-amber-500' : 'text-indigo-500'} /><span className="text-[10px] font-black uppercase mt-2">{newBypass ? 'Compatibility Mode: ON' : 'Pro Mixer: ON'}</span></div>);
                    }}
                    className={`px-3 py-1.5 border text-[10px] font-black uppercase tracking-widest transition-all ${state.isAudioBypass ? 'bg-amber-600 border-amber-400 text-white' : 'bg-black/50 border-white/20 text-gray-400 hover:border-white'}`}
                    title="Toggle compatibility mode if you have no sound"
                >
                    {state.isAudioBypass ? 'Audio Bypass ON' : 'Audio Bypass OFF'}
                </button>
            </div>
        </div>

       {/* Hidden File Input for Subtitles */}
       <input 
           type="file" 
           ref={subtitleInputRef} 
           className="hidden" 
           accept=".srt,.vtt"
           onChange={onSubtitleFileChange}
       />
    </div>
  );
};

export default VideoPlayer;
