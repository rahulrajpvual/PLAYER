import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, PictureInPicture, Zap, Speaker, Activity,
  Eye, Aperture, Search, PenTool, SplitSquareHorizontal, Layers,
  Mic2, AlertTriangle, ChevronsLeft, ChevronsRight, Check, Scaling
} from 'lucide-react';
import { VideoState, Shot, SceneSegment, SubtitleTrack, AudioTrackInfo } from '../types';

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
  activeSubtitleId: string;
  isDrawingMode: boolean;
  isSidebarOpen: boolean;
  title?: string;
  brushColor: string;
  setBrushColor: (c: string) => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
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
  setBrushSize
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioMixer, setShowAudioMixer] = useState(false);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const audioMixerRef = useRef<HTMLDivElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
      if (audioMixerRef.current && !audioMixerRef.current.contains(event.target as Node)) {
        setShowAudioMixer(false);
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
      className={`absolute bottom-0 left-0 right-0 p-6 pt-32 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-500 ease-in-out ${state.showControls || !state.isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'} ${isSidebarOpen && !state.isFullscreen ? 'mr-80' : ''}`}
    >
      {/* Visual Tools Bar (Floating above controls) */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-1 flex items-center gap-1 shadow-2xl pointer-events-auto relative">
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
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button 
                  onClick={(e) => { e.stopPropagation(); onToggleLoupe(); }}
                  className={`p-2 rounded-full transition-all ${state.isLoupeActive ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
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
                  className={`p-2 rounded-full transition-all ${state.isCompareMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                  title="Compare Mode"
              >
                  <SplitSquareHorizontal size={18} />
              </button>
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
      <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl ring-1 ring-white/5 relative z-20 pointer-events-auto">
        
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

          {/* Scene Segments (Genres) - Colored Bars */}
          <div className="absolute top-0 left-0 w-full h-1.5 z-20">
             {segments.map(seg => {
                const startPct = (seg.startTime / state.duration) * 100;
                const endPct = (seg.endTime / state.duration) * 100;
                const width = Math.max(0.5, endPct - startPct);
                
                return (
                  <div 
                    key={seg.id}
                    className="absolute top-0 h-full rounded-full shadow-[0_0_5px_rgba(0,0,0,0.5)] hover:h-2 transition-all cursor-help"
                    style={{ 
                      left: `${startPct}%`,
                      width: `${width}%`,
                      backgroundColor: getGenreColor(seg.type)
                    }}
                    title={`${seg.type.toUpperCase()}: ${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}`}
                  />
                );
             })}
          </div>

          {/* Audio Heatmap Layer (Background Waveform) */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-8 flex items-end gap-[1px] opacity-60 z-0 pointer-events-none">
             {state.audioHeatmap ? (
                 state.audioHeatmap.map((amp, i) => {
                     // Color gradient: Quiet (Blue/Cyan) -> Loud (Red/Orange)
                     const isLoud = amp > 0.6;
                     const color = isLoud ? `rgba(239, 68, 68, ${0.4 + amp * 0.6})` : `rgba(59, 130, 246, ${0.3 + amp * 0.3})`;
                     return (
                         <div 
                            key={i} 
                            style={{ 
                                width: `${100 / state.audioHeatmap!.length}%`, 
                                height: `${Math.max(10, amp * 100)}%`,
                                backgroundColor: color
                            }} 
                            className="rounded-t-sm transition-all duration-300"
                         />
                     );
                 })
             ) : (
                /* Fallback Heatmap using shots if audio not analyzed yet */
                shots.map((shot) => {
                    const intensity = shot.motionScore ? shot.motionScore : 0; 
                    const color = `rgba(${50 + intensity * 200}, ${50}, ${150 - intensity * 100}, 0.2)`;
                    const width = ((shot.endTime - shot.startTime) / state.duration) * 100;
                    return (
                        <div 
                            key={shot.id} 
                            style={{ width: `${width}%`, backgroundColor: color, height: '40%' }} 
                        />
                    );
                })
             )}
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
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-indigo-500" />
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

        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center space-x-6">
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
              {state.isCinemaMode && <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline">Immersive</span>}
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
                   <button onClick={onSubtitleUpload} className="w-full py-1.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-bold hover:bg-indigo-500/30 transition-colors border border-indigo-500/30">
                     Upload .SRT / .VTT
                   </button>
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