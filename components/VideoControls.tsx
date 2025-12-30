import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, PictureInPicture, Zap, Speaker, Activity,
  Eye, Aperture, Search, PenTool, SplitSquareHorizontal, Layers,
  Mic2, AlertTriangle, ChevronsLeft, ChevronsRight, Check, Scaling,
  Grid3x3, LayoutGrid, Square, Crosshair, ChevronDown, LogOut
} from 'lucide-react';
import { VideoState, Shot, SceneSegment, SubtitleTrack, AudioTrackInfo, GridMode } from '../types';

interface VideoControlsProps {
  state: VideoState;
  shots?: Shot[];
  segments?: SceneSegment[];
  subtitles: SubtitleTrack[];
  audioTracks: AudioTrackInfo[];
  onPlayPause: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onTogglePiP: () => void;
  onToggleCinemaMode: () => void;
  onFilterChange: (filter: any) => void;
  onToggleLoupe: () => void;
  onToggleAudioChannel: (index: number) => void;
  onToggleCompare: () => void;
  onToggleDrawing: () => void;
  onSubtitleSelect: (id: string) => void;
  onAudioTrackSelect: (id: string) => void;
  onSubtitleUpload: () => void;
  onToggleSidebar: () => void;
  onToggleScaling: () => void;
  onGridModeChange: (mode: GridMode) => void;
  gridMode: GridMode;
  activeSubtitleId: string;
  isDrawingMode: boolean;
  isSidebarOpen: boolean;
  title?: string;
  brushColor: string;
  setBrushColor: (c: string) => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  onSubtitleSyncChange: (val: number) => void;
  onAudioSyncChange: (val: number) => void;
  onSubtitleSizeChange: (val: number) => void;
  onSubtitlePositionChange: (val: number) => void;
  onToggleAudioBypass: () => void;
  onTogglePureNative: () => void;
}

const formatTime = (time: number) => {
  if (isNaN(time)) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getGenreColor = (type: string) => {
  switch(type) {
    case 'action': return '#ef4444'; // Red
    case 'comedy': return '#eab308'; // Yellow
    case 'drama': return '#3b82f6'; // Blue
    case 'thriller': return '#8b5cf6'; // Violet
    case 'twist': return '#d946ef'; // Fuchsia
    case 'song': return '#ec4899'; // Pink
    case 'horror': return '#22c55e'; // Green
    case 'romance': return '#f43f5e'; // Rose
    case 'dialogue': return '#f8fafc'; // Slate 50
    case 'suspense': return '#f97316'; // Orange
    case 'sci-fi': return '#06b6d4'; // Cyan
    case 'technical': return '#64748b'; // Slate 500
    case 'montage': return '#84cc16'; // Lime
    case 'musical': return '#6366f1'; // Indigo
    case 'mystery': return '#10b981'; // Emerald
    case 'bg-score': return '#f59e0b'; // Amber
    default: return '#ffffff';
  }
};

const VideoControls: React.FC<VideoControlsProps> = ({
  state,
  shots = [],
  segments = [],
  subtitles,
  audioTracks,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  onPlaybackRateChange,
  onTogglePiP,
  onToggleCinemaMode,
  onFilterChange,
  onToggleLoupe,
  onToggleAudioChannel,
  onToggleCompare,
  onToggleDrawing,
  onSubtitleSelect,
  onAudioTrackSelect,
  onSubtitleUpload,
  onToggleSidebar,
  onToggleScaling,
  activeSubtitleId,
  isDrawingMode,
  isSidebarOpen,
  title,
  brushColor,
  setBrushColor,
  brushSize,
  setBrushSize,
  gridMode,
  onGridModeChange,
  onSubtitleSyncChange,
  onAudioSyncChange,
  onSubtitleSizeChange,
  onSubtitlePositionChange,
  onToggleAudioBypass,
  onTogglePureNative
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioMixer, setShowAudioMixer] = useState(false);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const audioMixerRef = useRef<HTMLDivElement>(null);
  const gridMenuRef = useRef<HTMLDivElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  const [showGridMenu, setShowGridMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (audioMixerRef.current && !audioMixerRef.current.contains(event.target as Node)) {
        setShowAudioMixer(false);
      }
      if (gridMenuRef.current && !gridMenuRef.current.contains(event.target as Node)) {
        setShowGridMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressContainerRef.current) {
      const rect = progressContainerRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const time = pos * state.duration;
      setHoverTime(formatTime(Math.max(0, Math.min(time, state.duration))));
      setHoverPosition(pos * 100);
    }
  };

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 p-4 md:p-6 pt-16 md:pt-32 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-500 ease-in-out ${state.showControls || !state.isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${isSidebarOpen && !state.isFullscreen ? 'md:mr-80' : ''}`}
    >
      {/* Visual Tools Bar (Floating above controls) */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 md:gap-4 w-full md:w-auto px-4 justify-center">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-1 flex items-center gap-0.5 md:gap-1 shadow-2xl pointer-events-auto relative">
              <button 
                  onClick={(e) => { e.stopPropagation(); onFilterChange(state.visualFilter === 'false-color' ? 'none' : 'false-color'); }}
                  className={`p-2 rounded-full transition-all ${state.visualFilter === 'false-color' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="False Color (Exposure)"
              >
                  <Aperture size={18} />
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); onFilterChange(state.visualFilter === 'focus-peaking' ? 'none' : 'focus-peaking'); }}
                  className={`p-2 rounded-full transition-all ${state.visualFilter === 'focus-peaking' ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Focus Peaking"
              >
                  <Eye size={18} />
              </button>
              <div className="hidden sm:block w-px h-4 bg-white/10 mx-1"></div>
              <button 
                  onClick={(e) => { e.stopPropagation(); onToggleLoupe(); }}
                  className={`p-2 rounded-full transition-all hidden sm:flex ${state.isLoupeActive ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Pixel Zoom (Loupe)"
              >
                  <Search size={18} />
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); onToggleDrawing(); }}
                  className={`p-2 rounded-full transition-all ${isDrawingMode ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Annotate Frame"
              >
                  <PenTool size={18} />
              </button>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button 
                  onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
                  className={`p-2 rounded-full transition-all hidden sm:flex ${state.isCompareMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Compare Mode"
              >
                  <SplitSquareHorizontal size={18} />
              </button>
              
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              
              <div className="relative" ref={gridMenuRef}>
                  <button 
                      onClick={(e) => { e.stopPropagation(); setShowGridMenu(!showGridMenu); }}
                      className={`p-2 rounded-full transition-all ${gridMode !== 'none' ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                      title="Composition Grids"
                  >
                      <Grid3x3 size={18} />
                  </button>
                  
                  {showGridMenu && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-1 shadow-2xl flex flex-col gap-1 min-w-[140px] animate-in fade-in slide-in-from-bottom-2 z-50">
                          {[
                              { id: 'none', label: 'No Grid', icon: <Square size={14} /> },
                              { id: 'thirds', label: 'Rule of Thirds', icon: <Grid3x3 size={14} /> },
                              { id: 'golden', label: 'Golden Ratio', icon: <LayoutGrid size={14} /> },
                              { id: 'crosshair', label: 'Crosshair', icon: <Crosshair size={14} /> },
                              { id: 'diagonal', label: 'Diagonal', icon: <SplitSquareHorizontal className="rotate-45" size={14} /> },
                          ].map((item) => (
                              <button 
                                  key={item.id}
                                  onClick={(e) => { e.stopPropagation(); onGridModeChange(item.id as GridMode); setShowGridMenu(false); }}
                                  className={`flex items-center gap-3 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${gridMode === item.id ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                              >
                                  {item.icon}
                                  {item.label}
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              <button 
                  onClick={(e) => { e.stopPropagation(); onToggleSidebar(); }}
                  className={`p-2 rounded-full transition-all ${isSidebarOpen ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Toggle Sidebar"
              >
                  <ChevronsRight size={18} className={isSidebarOpen ? "rotate-0" : "rotate-180"} />
              </button>
          </div>
          
          {/* Drawing Toolbar */}
          {isDrawingMode && (
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-3 animate-in slide-in-from-top-2 pointer-events-auto">
                  <div className="flex gap-1 border-r border-white/10 pr-3">
                      {['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#ffffff'].map(c => (
                          <button
                              key={c}
                              onClick={() => setBrushColor(c)}
                              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${brushColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                              style={{ backgroundColor: c }}
                          />
                      ))}
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
                      <input 
                          type="range" min="1" max="20" 
                          value={brushSize} 
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-20 accent-white h-1"
                      />
                      <div className="w-4 h-4 bg-white rounded-full opacity-50"></div>
                  </div>
              </div>
          )}
      </div>

      {/* Main Controls Bar */}
      <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-xl md:rounded-2xl p-2 md:p-4 shadow-2xl ring-1 ring-white/5 relative z-20 pointer-events-auto">
        
        {/* Progress Bar Container */}
        <div 
          ref={progressContainerRef}
          className="group relative w-full h-12 mb-2 cursor-pointer flex items-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Tooltip */}
          {hoverTime && (
            <div 
              className="absolute bottom-full mb-3 -translate-x-1/2 bg-white text-black text-xs font-bold py-1 px-2 rounded shadow-[0_0_15px_rgba(255,255,255,0.3)] pointer-events-none z-30"
              style={{ left: `${hoverPosition}%` }}
            >
              {hoverTime}
            </div>
          )}

          {/* Cinematic Intensity & Sentiment Waveform - Smooth SVG Path */}
          <div className="absolute -top-24 left-0 w-full h-24 pointer-events-none z-10 opacity-40 group-hover:opacity-100 transition-all duration-700">
             <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                <defs>
                   <linearGradient id="intensityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                   </linearGradient>
                </defs>
                {/* Draw a smooth spline through segment ratings */}
                {segments.length > 1 ? (
                   <path 
                     d={`M 0 100 ${segments
                       .sort((a,b) => a.startTime - b.startTime)
                       .reduce((acc: any[], seg) => {
                           const lastEnd = acc.length > 0 ? acc[acc.length - 1].endTime : -1;
                           if (seg.startTime >= lastEnd) acc.push(seg);
                           return acc;
                       }, [])
                       .map((seg, i, arr) => {
                         const x = (seg.startTime / state.duration) * 1000;
                         const y = 100 - (seg.rating || 0);
                         const endX = (seg.endTime / state.duration) * 1000;
                         
                         if (i === 0) return `L 0 ${y} L ${x} ${y} L ${endX} ${y}`;
                         
                         const prev = arr[i-1];
                         const prevEndX = (prev.endTime / state.duration) * 1000;
                         const prevY = 100 - (prev.rating || 0);
                         
                         // Smooth S-curve transition
                         const cp1x = prevEndX + (x - prevEndX) / 2;
                         const cp2x = prevEndX + (x - prevEndX) / 2;
                         
                         return `C ${cp1x} ${prevY}, ${cp2x} ${y}, ${x} ${y} L ${endX} ${y}`;
                       }).join(' ')} L 1000 100 Z`}
                    fill="url(#intensityGradient)"
                    stroke="#818cf8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  />
                ) : segments.length === 1 && (
                  <rect 
                    x={(segments[0].startTime / state.duration) * 1000} 
                    y={100 - segments[0].rating} 
                    width={((segments[0].endTime - segments[0].startTime) / state.duration) * 1000} 
                    height={segments[0].rating} 
                    fill="url(#intensityGradient)"
                    stroke="#818cf8"
                    strokeWidth="1"
                  />
                )}
             </svg>
          </div>

          {/* Scene Segments (Genres) - Colored Rail */}
          <div className="absolute top-0 left-0 w-full h-1.5 z-20 flex overflow-hidden rounded-full">
             {segments.map(seg => {
                const startPct = (seg.startTime / state.duration) * 100;
                const endPct = (seg.endTime / state.duration) * 100;
                const width = Math.max(0.1, endPct - startPct);
                
                return (
                  <div 
                    key={seg.id}
                    className="h-full transition-all cursor-help relative group/seg"
                    style={{ 
                      width: `${width}%`,
                      backgroundColor: getGenreColor(seg.type)
                    }}
                    title={`${(seg.type || 'scene').toUpperCase()}: ${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}`}
                  >
                      <div className="absolute inset-0 bg-white opacity-0 group-hover/seg:opacity-20 transition-opacity" />
                  </div>
                );
             })}
          </div>

          {/* Audio Intelligence Layer (Continuous Pulse Waveform) */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-10 opacity-60 z-0 pointer-events-none">
             <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                {state.audioHeatmap ? (
                  <path 
                    d={`M 0 50 ${state.audioHeatmap.map((amp, i) => {
                      const x = (i / (state.audioHeatmap!.length - 1)) * 1000;
                      const y = 50 - (amp * 40); // Top half
                      const y2 = 50 + (amp * 40); // Bottom half (mirror)
                      return `L ${x} ${y}`;
                    }).join(' ')} ${[...state.audioHeatmap].reverse().map((amp, i) => {
                      const x = ((state.audioHeatmap!.length - 1 - i) / (state.audioHeatmap!.length - 1)) * 1000;
                      const y2 = 50 + (amp * 40);
                      return `L ${x} ${y2}`;
                    }).join(' ')} Z`}
                    fill="rgba(99, 102, 241, 0.3)"
                    stroke="rgba(129, 140, 248, 0.5)"
                    strokeWidth="1"
                  />
                ) : (
                  /* Fallback using shot motion data if audio not ready */
                  shots.map((shot, i) => {
                    const startPct = (shot.startTime / state.duration) * 1000;
                    const widthPct = ((shot.endTime - shot.startTime) / state.duration) * 1000;
                    const intensity = shot.motionScore || 0.2;
                    return (
                      <rect 
                        key={shot.id} 
                        x={startPct} y={50 - intensity * 20} 
                        width={widthPct} height={intensity * 40} 
                        fill="rgba(99, 102, 241, 0.1)" 
                      />
                    );
                  })
                )}
             </svg>
          </div>

          {/* Buffered Bar */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 w-full rounded-full overflow-hidden pointer-events-none z-10">
             <div 
              className="h-full bg-white/10 absolute top-0 left-0 transition-all duration-300"
              style={{ width: `${state.buffered}%` }}
            />
          </div>

          {/* In/Out Point Visualization */}
          {state.inPoint !== null && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-8 w-0.5 bg-yellow-400 z-10 rounded-l-sm shadow-[0_0_10px_yellow]"
              style={{ left: `${(state.inPoint / state.duration) * 100}%` }}
            />
          )}
          {state.outPoint !== null && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-8 w-0.5 bg-yellow-400 z-10 rounded-r-sm shadow-[0_0_10px_yellow]"
              style={{ left: `${(state.outPoint / state.duration) * 100}%` }}
            />
          )}
          {state.inPoint !== null && state.outPoint !== null && (
             <div 
               className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-yellow-400/30 z-0"
               style={{ 
                 left: `${(state.inPoint / state.duration) * 100}%`,
                 width: `${((state.outPoint - state.inPoint) / state.duration) * 100}%`
               }}
             />
          )}
          
          {/* Playback Progress */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full z-10 pointer-events-none shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            style={{ width: `${state.progress}%` }}
          >
             {/* Handle */}
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-all shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-indigo-500 z-30" />
             
             {/* Vertical Playhead (Reference Image Style) */}
             <div className="absolute right-0 bottom-1/2 w-px h-24 bg-white/40 pointer-events-none z-20" />
          </div>
          
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.001"
            value={state.progress || 0} 
            onChange={onSeek}
            className="absolute top-0 left-0 w-full h-full opacity-0 z-20 cursor-pointer"
            aria-label="Seek timeline"
          />
        </div>

        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Left Controls */}
          <div className="flex items-center space-x-2 md:space-x-6">
            <button 
              onClick={onPlayPause}
              className="text-white hover:text-indigo-400 transition-all transform active:scale-95 focus:outline-none"
            >
              {state.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>

            {/* Audio Section */}
            <div className="flex items-center gap-2 relative" ref={audioMixerRef}>
                <div className="flex items-center group/vol">
                    <button onClick={onToggleMute} className="text-white hover:text-indigo-400 transition-colors">
                        {state.isMuted || state.volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 ease-out flex items-center">
                        <input 
                            type="range" min="0" max="1" step="0.05"
                            value={state.isMuted ? 0 : state.volume} 
                            onChange={onVolumeChange}
                            className="w-16 h-1 mx-2 accent-indigo-500 cursor-pointer"
                        />
                    </div>
                </div>

                {/* Mixer Button */}
                <button 
                    onClick={() => setShowAudioMixer(!showAudioMixer)}
                    className={`p-1.5 rounded transition-colors ${showAudioMixer ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
                    title="Audio Channel Mixer"
                >
                    <Mic2 size={16} />
                </button>

                {/* Mixer Popup */}
                {showAudioMixer && (
                    <div className="absolute bottom-full left-0 mb-4 bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl w-48 animate-in fade-in slide-in-from-bottom-2 z-50">
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Mixer (5.1)</div>
                        <div className="grid grid-cols-2 gap-2">
                            {['L', 'R', 'C', 'LFE', 'SL', 'SR'].map((ch, i) => (
                                <button 
                                    key={ch}
                                    onClick={() => onToggleAudioChannel(i)}
                                    className={`text-xs font-bold py-1.5 rounded border transition-colors ${state.audioChannels[i] ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-black border-white/10 text-gray-500 hover:text-white'}`}
                                >
                                    {ch}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="text-sm font-medium text-white/90 font-mono tracking-wide">
              {formatTime(state.currentTime)} <span className="text-white/30 mx-1">/</span> {formatTime(state.duration)}
            </div>
          </div>

          {/* Title */}
          {title && (
            <div className="hidden xl:block absolute left-1/2 transform -translate-x-1/2 max-w-[30%] truncate text-sm font-medium text-white/50 pointer-events-none">
              {title}
            </div>
          )}

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
             <button
               onClick={onToggleCinemaMode}
               className={`transition-all p-2 rounded-lg flex items-center gap-2 ${state.isCinemaMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
               title="Cinema Audio Mode"
            >
              <Activity size={18} />
              {state.isCinemaMode && <span className="text-[10px] font-black uppercase tracking-wider hidden lg:inline">Immersive</span>}
            </button>
            
            <button
               onClick={onToggleScaling}
               className={`transition-all p-2 rounded-lg flex items-center gap-2 ${state.scalingMode === 'cover' ? 'text-indigo-400 bg-indigo-500/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
               title={state.scalingMode === 'cover' ? "Fit to Screen" : "Fill Screen (Zoom)"}
            >
              <Scaling size={18} />
            </button>

            <div className="h-6 w-px bg-white/10 mx-2"></div>

            <button onClick={onTogglePiP} className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
              <PictureInPicture size={18} />
            </button>

            <div className="relative" ref={settingsRef}>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`text-white/70 hover:text-white transition-all p-2 hover:bg-white/5 rounded-lg ${showSettings ? 'bg-white/10 text-white rotate-45' : ''}`}
              >
                <Settings size={18} />
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-4 w-64 bg-[#0a0a0a] border border-white/10 backdrop-blur-2xl rounded-xl p-3 shadow-2xl animate-in fade-in zoom-in-95 z-50">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 px-1">Playback Speed</div>
                  <div className="flex space-x-1 mb-4">
                    {[0.5, 1, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => { onPlaybackRateChange(rate); }}
                        className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${state.playbackRate === rate ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Subtitles Section */}
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 px-1">Subtitles</div>
                   <div className="space-y-1 mb-2 max-h-32 overflow-y-auto custom-scrollbar">
                      <button 
                        onClick={() => onSubtitleSelect('off')} 
                        className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium flex justify-between ${activeSubtitleId === 'off' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                        <span>Off</span>
                        {activeSubtitleId === 'off' && <Check size={12} />}
                      </button>
                      {subtitles.map(track => (
                        <button 
                          key={track.id}
                          onClick={() => onSubtitleSelect(track.id)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium flex justify-between ${activeSubtitleId === track.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                          <span className="truncate max-w-[80%]">{track.label}</span>
                          {activeSubtitleId === track.id && <Check size={12} />}
                        </button>
                      ))}
                   </div>
                    <div className="flex gap-2">
                        <button onClick={onSubtitleUpload} className="flex-1 py-1.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-black uppercase hover:bg-indigo-500/30 transition-colors border border-indigo-500/30">
                            Upload .SRT
                        </button>
                    </div>

                    {/* Advanced Controls */}
                    <div className="border-t border-white/5 mt-4 pt-4 space-y-3">
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2 px-1">Audio Compatibility</div>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={onToggleAudioBypass}
                                className={`w-full py-2 px-3 rounded text-[10px] font-black uppercase tracking-widest text-left border transition-all ${state.isAudioBypass ? 'bg-amber-600/20 border-amber-500/50 text-amber-400 font-bold' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                {state.isAudioBypass ? 'FX_BYPASS: ON' : 'FX_BYPASS: OFF'}
                            </button>
                            <button 
                                onClick={onTogglePureNative}
                                className={`w-full py-2 px-3 rounded text-[10px] font-black uppercase tracking-widest text-left border transition-all ${state.isPureNativeAudio ? 'bg-red-600/20 border-red-500/50 text-red-400 font-bold' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                            >
                                {state.isPureNativeAudio ? 'PURE_NATIVE: ON' : 'PURE_NATIVE: OFF'}
                            </button>
                            <p className="text-[8px] text-gray-600 italic px-1 leading-tight">Use PURE_NATIVE if sound is missing (best for EAC3/AC3).</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/10">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Sync</div>
                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">Subtitle ({state.subtitleSync.toFixed(1)}s)</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onSubtitleSyncChange(state.subtitleSync - 0.1)} className="p-1 bg-white/5 hover:bg-white/10 rounded"><ChevronsLeft size={14}/></button>
                                        <button onClick={() => onSubtitleSyncChange(state.subtitleSync + 0.1)} className="p-1 bg-white/5 hover:bg-white/10 rounded"><ChevronsRight size={14}/></button>
                                        <button onClick={() => onSubtitleSyncChange(0)} className="text-[8px] opacity-40 hover:opacity-100 uppercase font-black">Reset</button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">Audio ({state.audioSync.toFixed(1)}s)</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onAudioSyncChange(state.audioSync - 0.1)} className="p-1 bg-white/5 hover:bg-white/10 rounded"><ChevronsLeft size={14}/></button>
                                        <button onClick={() => onAudioSyncChange(state.audioSync + 0.1)} className="p-1 bg-white/5 hover:bg-white/10 rounded"><ChevronsRight size={14}/></button>
                                        <button onClick={() => onAudioSyncChange(0)} className="text-[8px] opacity-40 hover:opacity-100 uppercase font-black">Reset</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Style</div>
                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">Size ({state.subtitleSize}px)</span>
                                    <input 
                                        type="range" min="12" max="64" step="1"
                                        value={state.subtitleSize}
                                        onChange={(e) => onSubtitleSizeChange(parseInt(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-400 uppercase tracking-widest">Position ({state.subtitlePosition}%)</span>
                                    <input 
                                        type="range" min="0" max="50" step="1"
                                        value={state.subtitlePosition}
                                        onChange={(e) => onSubtitlePositionChange(parseInt(e.target.value))}
                                        className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio Track Selection (KMPlayer Style) */}
                    {audioTracks.length > 1 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Audio Tracks</div>
                            <div className="space-y-1">
                                {audioTracks.map(track => (
                                    <button 
                                        key={track.id}
                                        onClick={() => onAudioTrackSelect(track.id)}
                                        className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-medium flex justify-between uppercase tracking-widest ${track.enabled ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                                    >
                                        <span>{track.label || 'Unknown Track'} ({track.language || '??'})</span>
                                        {track.enabled && <Check size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
              )}
            </div>

            <button onClick={onToggleFullscreen} className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
              {state.isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoControls;