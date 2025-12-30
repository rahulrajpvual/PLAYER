import React, { useState, useCallback, useEffect, useMemo } from 'react';
import VideoPlayer from './components/VideoPlayer';
import StoryboardReview from './components/StoryboardReview';
import { supabase, loadFromCloud, fetchAllStoryboards, saveToCloud, loadPlannerEntries, savePlannerEntry, deletePlannerEntry, deleteStoryboard, saveStoryIdea, deleteStoryIdea, loadStoryIdeas } from './services/firebase';
import { TopMovie } from './movieData';
import { 
  Upload, Film, FileVideo, Layers, Shield, Zap, Clock, Trash2, Layout, 
  PlayCircle, FolderPlus, Folder, ChevronRight, ChevronDown, MoreVertical, 
  Search, BookOpen, BarChart3, TrendingUp, Star, Calendar as CalendarIcon, 
  MonitorPlay, Clapperboard, RefreshCcw, LogOut, ChevronLeft, Plus, CheckCircle2, XCircle,
  Activity, Tv, Monitor, Disc, Database, Ticket, Play, ArrowRight, Flame,
  Globe, Lightbulb, Hash, X
} from 'lucide-react';
import { Note, SceneSegment, ActivityLog, MovieMeta, PlannerEntry, StoredStoryboard, StoryIdea } from './types';
import { tmdbService } from './services/tmdbService';

// --- Helpers ---
const formatMovieName = (filename: string): string => {
  try {
    const name = filename.replace(/\.[^/.]+$/, ""); // Remove extension
    // Regex to capture Title (group 1) and Year (group 2)
    // Looks for 19xx or 20xx surrounded by delimiters or end of string
    const match = name.match(/^(.*?)(?:[\.\s\(]?)((?:19|20)\d{2})(?:[\.\s\)]|$)/);
    
    if (match) {
      const title = match[1].replace(/\./g, " ").replace(/_/g, " ").trim();
      const year = match[2];
      // Only format if title isn't empty
      if (title) return `${title} | ${year}`;
    }
    
    // Fallback: replace dots/underscores with spaces
    return name.replace(/\./g, " ").replace(/_/g, " ");
  } catch (e) { return filename; }
};

// --- 3D Primitives ---

// A single plane in 3D space
const Face = ({ w, h, x=0, y=0, z=0, rx=0, ry=0, rz=0, className="", style={} }: any) => (
  <div 
    className={`wireframe-face ${className}`}
    style={{
      width: w, 
      height: h,
      marginTop: -h/2, // Center vertically
      marginLeft: -w/2, // Center horizontally
      transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
      ...style
    }} 
  />
);

// A 6-sided box
const Box = ({ w, h, d, x=0, y=0, z=0, rx=0, ry=0, rz=0, className="" }: any) => (
    <div className={`preserve-3d absolute top-1/2 left-1/2 ${className}`} 
         style={{ transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}>
        <Face w={w} h={h} z={d/2} />
        <Face w={w} h={h} z={-d/2} ry={180} />
        <Face w={d} h={h} x={w/2} ry={90} />
        <Face w={d} h={h} x={-w/2} ry={-90} />
        <Face w={w} h={d} y={-h/2} rx={90} />
        <Face w={w} h={d} y={h/2} rx={-90} />
    </div>
);

// A Cylinder approximated by N faces
const Cylinder = ({ r, h, sides = 12, x=0, y=0, z=0, rx=0, ry=0, rz=0, className="" }: any) => {
    const sideWidth = 2 * r * Math.tan(Math.PI / sides);
    return (
        <div className={`preserve-3d absolute top-1/2 left-1/2 ${className}`} 
             style={{ transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` }}>
            {/* Sides */}
            {Array.from({ length: sides }).map((_, i) => (
                <div 
                    key={i} 
                    className="wireframe-face border-white/30"
                    style={{
                        width: `${sideWidth + 1}px`, // +1 overlap
                        height: `${h}px`,
                        marginTop: -h/2,
                        marginLeft: -(sideWidth+1)/2,
                        transform: `rotateY(${(360/sides) * i}deg) translateZ(${r}px)`
                    }}
                />
            ))}
            {/* Caps (using cross-sections for wireframe look) */}
            <Face w={r*2} h={r*2} y={-h/2} rx={90} className="rounded-full !border-white/20 !border-2" />
            <Face w={r*2} h={r*2} y={h/2} rx={90} className="rounded-full !border-white/20 !border-2" />
        </div>
    );
};


// --- 3D Models ---

const WireframeCamera = () => (
    <div className="absolute top-[25%] left-[15%] preserve-3d animate-spin-3d hover:[animation-play-state:paused] opacity-40 hover:opacity-100 transition-opacity duration-500 cursor-pointer">
        {/* Main Body */}
        <Box w={120} h={140} d={200} className="[&>div]:!border-indigo-400/30" />
        
        {/* Lens (Cylinder) */}
        <Cylinder r={40} h={80} z={140} rx={90} className="[&>div]:!border-white/40" />
        
        {/* Reels (Cylinders on top) */}
        <Cylinder r={50} h={30} y={-90} z={40} rx={0} className="[&>div]:!border-indigo-400/30" />
        <Cylinder r={50} h={30} y={-90} z={-40} rx={0} className="[&>div]:!border-indigo-400/30" />
        
        {/* Viewfinder */}
        <Box w={30} h={30} d={80} x={-65} y={-30} z={-20} className="[&>div]:!border-white/30" />
    </div>
);

const WireframeClapperboard = () => (
    <div className="absolute bottom-[20%] right-[20%] preserve-3d animate-tumble hover:[animation-play-state:paused] opacity-30 hover:opacity-100 transition-opacity duration-500 cursor-pointer">
        {/* Board */}
        <Box w={180} h={140} d={15} y={20} className="[&>div]:!border-pink-500/30" />
        {/* Clapper Hinge Area */}
        <Box w={180} h={25} d={15} y={-60} className="[&>div]:!border-pink-500/30" />
        {/* Clapper Top (Rotated Open) */}
        <div className="preserve-3d absolute" style={{ transform: 'translateY(-72px) translateX(-90px) rotateZ(-25deg)' }}>
             <Box w={180} h={25} d={15} x={90} className="[&>div]:!border-white/60" />
        </div>
    </div>
);

const WireframeReel = () => (
    <div className="absolute top-[15%] right-[20%] preserve-3d animate-spin-3d opacity-30 hover:opacity-100 transition-opacity duration-500 cursor-pointer" style={{ animationDirection: 'reverse', animationDuration: '25s' }}>
        {/* Core */}
        <Cylinder r={20} h={40} rx={90} className="[&>div]:!border-white/20" />
        {/* Outer Rims */}
        <Cylinder r={80} h={5} z={20} rx={90} sides={16} className="[&>div]:!border-yellow-500/30" />
        <Cylinder r={80} h={5} z={-20} rx={90} sides={16} className="[&>div]:!border-yellow-500/30" />
        {/* Spokes */}
        <Box w={140} h={10} d={40} rz={0} className="[&>div]:!border-white/10" />
        <Box w={140} h={10} d={40} rz={45} className="[&>div]:!border-white/10" />
        <Box w={140} h={10} d={40} rz={90} className="[&>div]:!border-white/10" />
        <Box w={140} h={10} d={40} rz={135} className="[&>div]:!border-white/10" />
    </div>
);

const WireframeBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none perspective-800 z-0 flex items-center justify-center">
        {/* Floating Container */}
        <div className="preserve-3d w-full h-full relative">
            <WireframeCamera />
            <WireframeClapperboard />
            <WireframeReel />
        </div>
    </div>
);

// --- Logo Component ---
const FilmdaLogoText = () => (
  <span className="text-3xl font-[1000] tracking-[-0.08em] leading-none uppercase italic text-white flex items-center">
    FILMDA<span className="text-indigo-600 ml-[-2px]">.</span>
  </span>
);

// --- Diagnostic UI ---
const DiagnosticPanel = () => {
    const [stats, setStats] = useState({ supabase: 'checking', storage: 'ok', mkv: 'checking', audio: 'checking' });
    
    useEffect(() => {
        const check = async () => {
            // Check connectivity by trying to ping a known table
            const { error } = await supabase.from('activity_logs').select('count', { count: 'exact', head: true });
            
            const v = document.createElement('video');
            const mkvSupport = v.canPlayType('video/x-matroska');
            const aacSupport = v.canPlayType('audio/aac');
            const mp4aSupport = v.canPlayType('audio/mp4; codecs="mp4a.40.2"');
            
            setStats({ 
                supabase: error ? 'offline' : 'online', 
                storage: 'ok', 
                mkv: mkvSupport ? 'supported' : 'limited',
                audio: (aacSupport || mp4aSupport) ? 'aac-ok' : 'limited'
            });
        };
        check();
    }, []);

    return (
        <div className="fixed top-24 left-6 z-[100] bg-black/60 backdrop-blur-xl border border-white/10 p-4 space-y-3 pointer-events-auto hidden xl:block shadow-2xl">
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${stats.supabase === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-200">
                    Supabase: {stats.supabase === 'online' ? 'CloudSync' : 'LocalMode'}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-200">Storage: Online</span>
            </div>
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${stats.audio === 'aac-ok' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-200">Audio: {(stats.audio || 'checking').toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${stats.mkv === 'supported' ? 'bg-indigo-500' : 'bg-gray-700'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-200">Codec: MKV {stats.mkv}</span>
            </div>
            {(stats.supabase === 'offline' || stats.audio === 'limited') && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                    {stats.supabase === 'offline' && <div className="text-[7px] text-amber-500 font-bold leading-tight">SYSCFG: LOCAL ONLY</div>}
                    {stats.audio === 'limited' && <div className="text-[7px] text-red-500 font-bold leading-tight uppercase tracking-tight">CORS/AAC CODES WARNING</div>}
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const observerTarget = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'storyboards' | 'analysis' | 'calendar' | 'movies' | 'insights' | 'ideas'>('home');
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", description: "", tags: "" });
  const [isIdeasLoading, setIsIdeasLoading] = useState(false);
  const [storyboards, setStoryboards] = useState<StoredStoryboard[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [folderMap, setFolderMap] = useState<Record<string, string>>({});
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [plannerEntries, setPlannerEntries] = useState<PlannerEntry[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TopMovie[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [recentlyWatched, setRecentlyWatched] = useState<TopMovie[]>([]);
  const [isRecentlyWatchedLoading, setIsRecentlyWatchedLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddingPlan, setIsAddingPlan] = useState<number | null>(null); // Date timestamp
  const [planTitle, setPlanTitle] = useState("");
  const [planPlatform, setPlanPlatform] = useState("Theater");

  // Analysis State
  const [selectedAnalysisMovie, setSelectedAnalysisMovie] = useState<string | null>(null);
  
  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  
  // Playing State (for library items)
  const [playingStoryboard, setPlayingStoryboard] = useState<StoredStoryboard | null>(null);

  const handleMigration = async () => {
    if (!confirm("This will upload all local data to Supabase. Continue?")) return;
    setIsMigrating(true);
    let count = 0;
    
    try {
        // Migrate Logs
        const logs = JSON.parse(localStorage.getItem('lumina_activity_log') || '[]');
        for (const log of logs) {
            await saveToCloud('activity_logs', log);
            count++;
        }

        // Migrate Storyboards
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('lumina_notes_')) {
                const filename = key.replace('lumina_notes_', '');
                const notes = JSON.parse(localStorage.getItem(key) || '[]');
                const segments = JSON.parse(localStorage.getItem(`lumina_segments_${filename}`) || '[]');
                
                for (const note of notes) {
                    await saveToCloud(`notes_${filename}`, { ...note, filename });
                    count++;
                }
                for (const segment of segments) {
                    await saveToCloud(`segments_${filename}`, { ...segment, filename });
                    count++;
                }
            }
        }
        alert(`Migration complete! Moved ${count} items to cloud.`);
        // Reload data to show new items
        loadData();
    } catch (e) {
        console.error("Migration failed", e);
        alert("Migration failed. Check console.");
    } finally {
        setIsMigrating(false);
    }
  };

  // Recently Watched Tracking
  const addToRecentlyWatched = useCallback((filename: string) => {
    const existing = JSON.parse(localStorage.getItem('lumina_recently_watched') || '[]');
    const updated = [filename, ...existing.filter((f: string) => f !== filename)].slice(0, 20);
    localStorage.setItem('lumina_recently_watched', JSON.stringify(updated));
  }, []);

  const handleDeleteStoryboard = useCallback(async (filename: string) => {
    if (confirm(`Are you sure you want to delete analysis for "${formatMovieName(filename)}"? This cannot be undone.`)) {
        const success = await deleteStoryboard(filename);
        if (success) {
            setStoryboards(prev => prev.filter(s => s.filename !== filename));
        } else {
            alert("Failed to delete storyboard from cloud.");
        }
    }
  }, []);

  const handleAddIdea = async () => {
    if (!newIdea.title.trim()) return;
    const idea: StoryIdea = {
      id: Date.now().toString(),
      title: newIdea.title,
      description: newIdea.description,
      tags: newIdea.tags.split(',').map(t => t.trim()).filter(t => t),
      createdAt: Date.now()
    };
    const success = await saveStoryIdea(idea);
    if (success) {
      setStoryIdeas(prev => [idea, ...prev]);
      setNewIdea({ title: "", description: "", tags: "" });
      setIsAddingIdea(false);
    } else {
        alert("Failed to save idea to cloud.");
    }
  };

  const handleDeleteIdea = async (id: string) => {
    if (confirm("Delete this story idea? This cannot be undone.")) {
      const success = await deleteStoryIdea(id);
      if (success) {
        setStoryIdeas(prev => prev.filter(i => i.id !== id));
      } else {
        alert("Failed to delete idea.");
      }
    }
  };

  useEffect(() => {
    const loadRecentlyWatched = async () => {
        const watched = JSON.parse(localStorage.getItem('lumina_recently_watched') || '[]');
        if (watched.length > 0) {
            setIsRecentlyWatchedLoading(true);
            const posters: TopMovie[] = [];
            // Get unique posters for the last 10 watched items
            for (const filename of watched.slice(0, 10)) {
                const movie = await tmdbService.getPosterByFilename(filename);
                if (movie && !posters.find(p => p.id === movie.id)) {
                    posters.push({ ...movie, title: formatMovieName(filename).split('|')[0].trim() });
                }
            }
            setRecentlyWatched(posters);
            setIsRecentlyWatchedLoading(false);
        }
    };
    loadRecentlyWatched();
  }, []);

  const handleUpdateNote = async (filename: string, noteId: string, text: string) => {
    // Update local state for the currently playing storyboard
    if (playingStoryboard && playingStoryboard.filename === filename) {
        const updatedNotes = playingStoryboard.notes.map(n => 
            n.id === noteId ? { ...n, text } : n
        );
        setPlayingStoryboard({ ...playingStoryboard, notes: updatedNotes });
    }

    // Update main storyboards state
    setStoryboards(prev => prev.map(sb => {
        if (sb.filename === filename) {
            const updatedNotes = sb.notes.map(n => 
                n.id === noteId ? { ...n, text } : n
            );
            return { ...sb, notes: updatedNotes };
        }
        return sb;
    }));

    // Sync to Supabase
    try {
        const noteToUpdate = (await loadFromCloud(`notes_${filename}`, 'filename', filename) as Note[])
            .find(n => n.id === noteId);
        
        if (noteToUpdate) {
            await saveToCloud(`notes_${filename}`, { ...noteToUpdate, text, filename });
        }
    } catch (e) {
        console.error("Failed to sync note update to cloud", e);
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    let currentMap: Record<string, string> = {};
    try {
      currentMap = JSON.parse(localStorage.getItem('lumina_folder_map') || '{}');
      setFolderMap(currentMap);
      const uniqueFolders = Array.from(new Set(Object.values(currentMap))) as string[];
      setFolders(uniqueFolders.sort());
    } catch (e) { console.error("Failed to load folders"); }

    // Load Activity Logs from Supabase
    const logs = await loadFromCloud('activity_logs');
    setActivityLogs(logs as ActivityLog[]);

    // Load Planner Entries from Supabase
    setIsPlannerLoading(true);
    const plans = await loadPlannerEntries();
    setPlannerEntries(plans);
    setIsPlannerLoading(false);

    // Load Story Ideas
    setIsIdeasLoading(true);
    const ideas = await loadStoryIdeas();
    setStoryIdeas(ideas);
    setIsIdeasLoading(false);

    // Load Now Playing from Supabase/TMDB
    const nowPlaying = await tmdbService.getNowPlayingMovies();
    setNowPlayingMovies(nowPlaying.results);
    
    // Load Storyboards from Supabase
    const loaded = await fetchAllStoryboards();
    
    // Merge with local folder map and meta
    const enriched = loaded.map((s: any) => {
        // Try to recover heatmap/duration from local storage cache if available since we don't sync it yet
        const metaStr = localStorage.getItem(`lumina_meta_${s.filename}`);
        const meta: MovieMeta | undefined = metaStr ? JSON.parse(metaStr) : undefined;
        
        return {
            ...s,
            folder: currentMap[s.filename],
            duration: meta?.duration || s.duration,
            heatmap: meta?.heatmap,
            lastModified: meta?.lastPlayed || s.lastModified || Date.now()
        };
    });
    
    setStoryboards(enriched.sort((a: any, b: any) => b.lastModified - a.lastModified));
  }, []);

  useEffect(() => { loadData(); }, [loadData, file]);

  const addPlannerEntryFromList = async (movie: TopMovie, date: number) => {
    const newEntry: PlannerEntry = {
        id: Date.now().toString(),
        title: movie.title,
        date: date,
        status: 'planned',
        platform: 'Streaming',
        posterPath: movie.poster_path,
        overview: movie.overview,
        rating: movie.rating,
        year: movie.year
    };
    const updated = [...plannerEntries, newEntry];
    setPlannerEntries(updated);
    await savePlannerEntry(newEntry);
  };

  const addPlannerEntry = async (date: number) => {
      if (!planTitle.trim()) return;
      const newEntry: PlannerEntry = {
          id: Date.now().toString(),
          title: planTitle,
          date: date,
          status: 'planned',
          platform: planPlatform
      };
      const updated = [...plannerEntries, newEntry];
      setPlannerEntries(updated);
      setPlanTitle("");
      setPlanPlatform("Theater");
      setIsAddingPlan(null);
      await savePlannerEntry(newEntry);
  };

  const updatePlannerStatus = async (id: string, status: 'planned' | 'watched' | 'skipped') => {
      const entry = plannerEntries.find(p => p.id === id);
      if (!entry) return;
      
      const updatedEntry = { ...entry, status };
      const updated = plannerEntries.map(p => p.id === id ? updatedEntry : p);
      setPlannerEntries(updated);
      await savePlannerEntry(updatedEntry);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const isVideo = droppedFile.type.startsWith('video/') || 
                     ['.mp4', '.mkv', '.mov', '.avi', '.webm'].some(ext => droppedFile.name.toLowerCase().endsWith(ext));
      
      if (isVideo) {
          setFile(droppedFile);
          addToRecentlyWatched(droppedFile.name);
      } else alert("Please upload a valid video file.");
    }
  }, [addToRecentlyWatched]);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const selected = e.target.files[0];
        const isVideo = selected.type.startsWith('video/') || 
                       ['.mp4', '.mkv', '.mov', '.avi', '.webm'].some(ext => selected.name.toLowerCase().endsWith(ext));
        
        if (isVideo) {
            setFile(selected);
            addToRecentlyWatched(selected.name);
        } else alert("Please upload a valid video file.");
    }
  };

  const getPlatformIcon = (platform?: string) => {
      switch(platform) {
          case 'Netflix': return <Tv size={10} />;
          case 'Streaming': return <Monitor size={10} />;
          case 'BluRay': return <Disc size={10} />;
          default: return <Ticket size={10} />;
      }
  };

  // Calendar Logic
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const calendarDays = useMemo(() => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    
    for (let i = 0; i < firstDay; i++) days.push(null);
    
    for (let i = 1; i <= daysInMonth; i++) {
        const currentDayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).setHours(0,0,0,0);
        const currentDayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).setHours(23,59,59,999);
        
        const dayLogs = activityLogs.filter(l => l.date >= currentDayStart && l.date <= currentDayEnd);
        const dayPlans = plannerEntries.filter(p => p.date >= currentDayStart && p.date <= currentDayEnd);
        const totalDuration = dayLogs.reduce((acc, l) => acc + l.durationPlayed, 0);
        const moviesWatched = Array.from(new Set(dayLogs.map(l => l.filename)));

        days.push({ 
            day: i, 
            logs: dayLogs,
            plans: dayPlans,
            duration: totalDuration,
            movies: moviesWatched,
            timestamp: currentDayStart
        });
    }

    // Pad to exactly 42 days (6 weeks) to maintain fixed calendar height
    while (days.length < 42) {
        days.push(null);
    }
    return days;
  }, [currentDate, activityLogs, plannerEntries]);

  // Analysis Logic
  const dailyActivity = useMemo(() => {
      const activity = [];
      const today = new Date();
      for(let i=13; i>=0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const start = new Date(d).setHours(0,0,0,0);
          const end = new Date(d).setHours(23,59,59,999);
          const logs = activityLogs.filter(l => l.date >= start && l.date <= end);
          const totalDuration = logs.reduce((acc, l) => acc + l.durationPlayed, 0);
          activity.push({ date: d.toLocaleDateString('en-US', {weekday:'short', day:'numeric'}), minutes: Math.round(totalDuration / 60) });
      }
      return activity;
  }, [activityLogs]);

  const watchPatterns = useMemo(() => {
      const hours = new Array(24).fill(0);
      activityLogs.forEach(log => {
          const hour = new Date(log.date).getHours();
          hours[hour] += log.durationPlayed;
      });
      const max = Math.max(...hours) || 1;
      return hours.map(val => (val / max) * 100);
  }, [activityLogs]);

  const selectedMovieData = useMemo(() => {
      if(!selectedAnalysisMovie) return null;
      const data = storyboards.find(s => s.filename === selectedAnalysisMovie);
      if (data && (!data.duration || data.duration === 0) && data.segments && data.segments.length > 0) {
          const maxEnd = Math.max(...data.segments.map(s => s.endTime));
          return { ...data, duration: maxEnd };
      }
      return data;
  }, [selectedAnalysisMovie, storyboards]);

  const movieGenreData = useMemo(() => {
      if(!selectedMovieData?.segments) return [];
      const distribution: Record<string, number> = {};
      selectedMovieData.segments.forEach(seg => {
          distribution[seg.type] = (distribution[seg.type] || 0) + (seg.endTime - seg.startTime);
      });
      return Object.entries(distribution).map(([key, val]) => ({ name: key, value: val }));
  }, [selectedMovieData]);

  const getSceneColor = (type: string) => {
    switch(type) {
      case 'action': return 'bg-red-500'; case 'comedy': return 'bg-yellow-500'; case 'drama': return 'bg-blue-500';
      case 'thriller': return 'bg-purple-500'; case 'twist': return 'bg-fuchsia-500'; case 'song': return 'bg-pink-500';
      case 'horror': return 'bg-green-500'; case 'romance': return 'bg-rose-500'; default: return 'bg-gray-400';
    }
  };
  const [discoverySearch, setDiscoverySearch] = useState("");
  const [apiMovies, setApiMovies] = useState<TopMovie[]>([]);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);

  useEffect(() => {
    const fetchApiMovies = async () => {
        setIsApiLoading(true);
        try {
            const response = !discoverySearch.trim() 
                ? await tmdbService.getTrendingMovies(apiPage)
                : await tmdbService.searchMovies(discoverySearch, apiPage);
            
            if (apiPage === 1) {
                setApiMovies(response.results);
            } else {
                setApiMovies(prev => [...prev, ...response.results]);
            }
            setApiTotalPages(response.totalPages);
        } catch (e) {
            console.error("API Fetch Error:", e);
        } finally {
            setIsApiLoading(false);
        }
    };

    const debounce = setTimeout(fetchApiMovies, 500);
    return () => clearTimeout(debounce);
  }, [discoverySearch, apiPage]);

  // Reset page when search changes
  useEffect(() => {
    setApiPage(1);
  }, [discoverySearch]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && apiPage < apiTotalPages && !isApiLoading) {
          setApiPage(prev => prev + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [apiPage, apiTotalPages, isApiLoading]);

  const filteredDiscoveryMovies = useMemo(() => {
    return apiMovies.filter(m => 
        m.title.toLowerCase().includes(discoverySearch.toLowerCase()) ||
        (m.year && m.year.toString().includes(discoverySearch))
    );
  }, [apiMovies, discoverySearch]);

  const totalFrames = storyboards.reduce((acc, s) => acc + s.notes.length, 0);


  return (
    <div className={`relative w-full bg-[#050505] text-white flex flex-col font-sans selection:bg-indigo-500/30 ${file || playingStoryboard ? 'h-screen overflow-hidden fixed inset-0' : 'min-h-screen overflow-x-hidden overflow-y-auto'} scroll-smooth`}>
      <DiagnosticPanel />
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-[#050505]">
        {/* Technical Grid Background */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent"></div>
      </div>

      <main className="flex-1 flex flex-col relative z-10">
        {file ? (
          <div className="absolute inset-0 bg-black">
            <VideoPlayer 
                file={file} 
                onClose={() => { setFile(null); loadData(); }} 
            />
          </div>
        ) : playingStoryboard ? (
            <StoryboardReview 
                storyboard={playingStoryboard}
                onUpdateNote={handleUpdateNote}
                onClose={() => { setPlayingStoryboard(null); loadData(); }}
            />
        ) : (
          <div className="flex-1 flex flex-col min-h-screen">
            <div className={`fixed top-0 left-0 w-full px-8 py-6 flex justify-between items-center z-[100] bg-[#050505]/90 border-b border-white/10 backdrop-blur-sm transition-all`}>
              <div className="flex items-center gap-12">
                <div className="flex flex-col cursor-pointer group" onClick={() => setActiveTab('home')}>
                   <h1 className="text-xl font-black tracking-tighter uppercase text-white leading-none">FILMDA_ARCHIVE</h1>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-none animate-none"/>
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">MIT_CSAIL // GOOGLE_DEEPMIND</span>
                   </div>
                </div>
                
                <div className="hidden lg:flex items-center gap-8">
                  {[
                      { id: 'home', label: 'CMD_CENTER' },
                      { id: 'movies', label: 'DATABASE' },
                      { id: 'calendar', label: 'LOGS' },
                      { id: 'ideas', label: 'CACHE' },
                      { id: 'analysis', label: 'METRICS' },
                      { id: 'insights', label: 'DEEP_LEARNING' },
                  ].map((tab) => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`text-[10px] font-mono font-bold uppercase tracking-[0.15em] transition-all hover:text-indigo-400 ${activeTab === tab.id ? 'text-indigo-500' : 'text-gray-500'}`}
                      >
                        {tab.label}
                      </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center bg-[#0a0a0a] border border-white/20 h-10 px-4 focus-within:border-indigo-500 transition-colors w-64">
                  <span className="text-gray-600 font-mono text-xs mr-2">{'>'}</span>
                  <input type="text" placeholder="SEARCH_ARCHIVE..." className="bg-transparent border-none text-[10px] font-mono w-full text-white placeholder:text-gray-700 focus:outline-none uppercase tracking-widest" />
                </div>
                <button 
                  onClick={() => setIsDragging(true)}
                  className="h-10 px-6 border border-white text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors flex items-center gap-3 active:scale-95"
                >
                  <Plus size={12} strokeWidth={4} />
                  Analyze_Input
                </button>
              </div>
            </div>

            <div className="flex-1 pb-12">
              {activeTab === 'home' && (
                <div className="animate-in fade-in duration-1000 pt-32 px-4 md:px-12 space-y-16 pb-32">
                  {/* HERO: Technical Overview Board */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 lg:grid-rows-2 gap-6 h-auto lg:h-[600px]">
                    {/* Main Module: System Status */}
                    <div className="lg:col-span-2 lg:row-span-2 relative rounded-none border border-white/5 bg-[#0a0a0a] overflow-hidden p-10 flex flex-col justify-between group hover:border-white/10 transition-colors">
                        <div className="absolute top-0 right-0 p-4 opacity-50">
                             <div className="grid grid-cols-3 gap-1">
                                 {Array.from({length: 9}).map((_, i) => (
                                     <div key={i} className={`w-1 h-1 rounded-full ${i === 4 ? 'bg-indigo-500' : 'bg-gray-800'}`} />
                                 ))}
                             </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">System State: Active</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none text-white mb-6">
                                Studio<br/>Command<br/>Interface
                            </h1>
                            <p className="text-gray-500 font-mono text-xs max-w-sm mb-8 leading-relaxed">
                                &gt; INITIALIZING DECONSTRUCTION ENGINE_ <br/>
                                &gt; WAITING FOR INPUT_
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <button 
                              onClick={() => setIsDragging(true)}
                              className="bg-white text-black px-8 py-4 rounded-sm font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 hover:bg-gray-200 transition-all border border-transparent"
                            >
                              <Upload size={16} strokeWidth={2} />
                              Initialize Upload
                            </button>
                            <button 
                              onClick={() => setActiveTab('calendar')}
                              className="px-8 py-4 rounded-sm font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 text-white border border-white/10 hover:bg-white/5 transition-all"
                            >
                              <BookOpen size={16} />
                              Access Vault
                            </button>
                        </div>
                    </div>

                    {/* Stat Module 1: Deconstruction Index */}
                    <div className="lg:col-span-2 bg-[#0a0a0a] rounded-none p-8 border border-white/5 flex flex-col justify-between hover:border-indigo-500/50 transition-colors">
                         <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-4 text-indigo-500">
                                    <Zap size={18} />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Analysis Index</span>
                                </div>
                                <div className="text-4xl font-mono font-bold text-white tabular-nums tracking-tighter">{storyboards.length.toString().padStart(3, '0')}</div>
                            </div>
                            <div className="h-full flex items-center">
                                <TrendingUp size={16} className="text-gray-700" />
                            </div>
                         </div>
                         <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                            <span>Latest Process: {storyboards[0] ? formatMovieName(storyboards[0].filename).substring(0, 15) + '...' : 'N/A'}</span>
                            <span className="text-indigo-400">v2.1</span>
                         </div>
                    </div>

                    {/* Stat Module 2: Concept Cache */}
                    <div className="lg:col-span-1 bg-[#0a0a0a] rounded-none p-8 border border-white/5 flex flex-col justify-between hover:border-white/20 transition-colors">
                         <div>
                            <div className="flex items-center gap-2 mb-4 text-gray-400">
                                <Flame size={18} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Concept Cache</span>
                            </div>
                            <div className="text-3xl font-mono font-bold text-white tabular-nums tracking-tighter">{storyIdeas.length.toString().padStart(2, '0')}</div>
                         </div>
                         <div className="mt-4 flex items-center gap-2 text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                            <span>Storage Optimized</span>
                         </div>
                    </div>

                    {/* Stat Module 3: Temporal Log */}
                    <div className="lg:col-span-1 bg-[#0a0a0a] rounded-none p-8 border border-white/5 flex flex-col justify-between hover:border-white/20 transition-colors">
                         <div>
                            <div className="flex items-center gap-2 mb-4 text-gray-400">
                                <Activity size={18} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Temporal Log</span>
                            </div>
                            <div className="text-3xl font-mono font-bold text-white tabular-nums tracking-tighter">
                                {Math.round(activityLogs.reduce((acc, l) => acc + l.durationPlayed, 0) / 60)}<span className="text-sm text-gray-600 ml-1">m</span>
                            </div>
                         </div>
                         <div className="mt-4 flex items-center gap-2 text-[8px] font-bold text-emerald-600 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Tracking
                         </div>
                    </div>
                  </div>

                  {/* HIGH-FREQUENCY ACTIVITY MONITOR */}
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-none p-10 shadow-sm relative overflow-hidden group">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b border-white/5 pb-8">
                          <div>
                              <div className="flex items-center gap-3 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Engagement Telemetry</h2>
                              </div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-5">Temporal Analysis of Study Patterns</p>
                          </div>
                          <div className="flex gap-4">
                               <div className="flex items-center gap-3 px-4 py-2 border border-white/10 rounded-sm bg-white/[0.02]">
                                    <Activity size={12} className="text-indigo-500" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Sensor: Active</span>
                               </div>
                          </div>
                      </div>
                      
                      {/* Technical Line Graph */}
                      <div className="h-64 relative w-full bg-black/20 border-l border-b border-white/10">
                          {/* Grid Lines */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                              {[0, 25, 50, 75, 100].map(p => (
                                  <div key={p} className="w-full h-px bg-white/[0.02]" />
                              ))}
                          </div>
                          <div className="absolute inset-0 flex justify-between pointer-events-none">
                              {[0, 20, 40, 60, 80, 100].map(p => (
                                  <div key={p} className="h-full w-px bg-white/[0.02]" />
                              ))}
                          </div>

                          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 100">
                              {/* The Sharp Line Path */}
                              <path 
                                  d={`M 0 ${100 - (dailyActivity[0].minutes / (Math.max(...dailyActivity.map(d => d.minutes)) || 1)) * 80 - 10} ${dailyActivity.map((day, i) => {
                                      const x = (i / (dailyActivity.length - 1)) * 1000;
                                      const maxMins = Math.max(...dailyActivity.map(d => d.minutes)) || 1;
                                      const y = 100 - (day.minutes / maxMins) * 80 - 10;
                                      return `L ${x} ${y}`;
                                  }).join(' ')}`}
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth="1.5"
                                  strokeLinecap="square"
                                  strokeLinejoin="bevel"
                                  className="transition-all duration-500"
                              />

                              {/* Technical Data Points */}
                              {dailyActivity.map((day, i) => {
                                  const x = (i / (dailyActivity.length - 1)) * 1000;
                                  const maxMins = Math.max(...dailyActivity.map(d => d.minutes)) || 1;
                                  const y = 100 - (day.minutes / maxMins) * 80 - 10;
                                  return (
                                      <g key={i} className="group/point">
                                          <circle 
                                              cx={x} 
                                              cy={y} 
                                              r="2" 
                                              fill="#0a0a0a" 
                                              stroke="#6366f1" 
                                              strokeWidth="1"
                                              className="cursor-crosshair transition-all duration-300 group-hover/point:r-3 group-hover/point:fill-white"
                                          />
                                          {/* Tooltip */}
                                          <foreignObject x={x - 40} y={y - 50} width="80" height="40" className="overflow-visible opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none">
                                              <div className="flex flex-col items-center bg-black border border-white/20 p-2 rounded-sm shadow-xl">
                                                  <span className="text-[8px] text-gray-400 font-mono mb-1">{new Date(day.date).toLocaleDateString(undefined, {weekday: 'short'})}</span>
                                                  <span className="text-[9px] text-white font-bold font-mono">{day.minutes}m</span>
                                              </div>
                                          </foreignObject>
                                      </g>
                                  );
                              })}
                          </svg>
                      </div>
                  </div>


                  {/* RECENT VAULT ACCESS */}
                  {storyboards.length > 0 && (
                    <div className="space-y-6">
                       <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Archived Sequence Capture</h2>
                            <button onClick={() => setActiveTab('movies')} className="text-[10px] font-bold uppercase text-indigo-400 flex items-center gap-2 group hover:text-white transition-colors">
                                ACCESS FULL ARCHIVE
                                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                       </div>
                       
                       <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                            {storyboards.map((sb) => (
                                <div 
                                  key={sb.filename}
                                  onClick={() => setPlayingStoryboard(sb)}
                                  className="flex-shrink-0 w-72 group cursor-pointer"
                                >
                                    <div className="relative aspect-video rounded-sm overflow-hidden border border-white/10 mb-3 transition-colors group-hover:border-indigo-500/50 bg-black">
                                        <img 
                                          src={sb.notes.find(n => n.thumbnail)?.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400&auto=format&fit=crop'} 
                                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0"
                                          alt={sb.filename}
                                        />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 border-t border-white/10 p-2 flex justify-between items-center">
                                            <span className="text-[8px] font-mono font-bold text-gray-400">SEQ_ID_{sb.scenes?.length || '00'}</span>
                                            <span className="text-[8px] font-mono font-bold text-indigo-400">{sb.notes?.length || 0} FRAMES</span>
                                        </div>
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-tight truncate text-gray-200 group-hover:text-indigo-400 transition-colors mb-1">{formatMovieName(sb.filename)}</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">LOGGED: {new Date(sb.lastModified).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                       </div>
                    </div>
                  )}

                  {/* GLOBAL DISCOVERY - TECHNICAL GRID */}
                  <div className="space-y-8 pb-24">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">External Database Interface</h2>
                            <div className="w-full md:w-auto flex items-center gap-3 bg-[#0a0a0a] border border-white/10 px-4 py-2.5 rounded-sm focus-within:border-indigo-500/50 transition-all">
                                <Search size={14} className="text-gray-500" />
                                <input 
                                    type="text" 
                                    value={discoverySearch}
                                    onChange={(e) => setDiscoverySearch(e.target.value)}
                                    placeholder="QUERY DATABASE..." 
                                    className="bg-transparent border-none text-[10px] font-mono focus:outline-none w-full md:w-64 uppercase tracking-widest text-white placeholder:text-gray-700"
                                />
                            </div>
                       </div>

                       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {apiMovies.map((movie, idx) => (
                                <div 
                                    key={movie.id}
                                    className={`relative rounded-sm overflow-hidden group border border-white/10 bg-[#0a0a0a] hover:border-white/30 transition-all cursor-pointer ${idx === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
                                >
                                    <div className="relative w-full h-full aspect-[2/3] overflow-hidden">
                                        <img 
                                            src={movie.poster_path} 
                                            className="w-full h-full object-cover transition-all grayscale group-hover:grayscale-0 opacity-80 group-hover:opacity-100"
                                            alt={movie.title}
                                        />
                                        <div className="absolute inset-0 ring-1 ring-inset ring-white/5 pointer-events-none" />
                                        
                                        {/* Technical Overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[#0a0a0a]/90 backdrop-blur-sm border-t border-white/5 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-yellow-500 font-mono text-[9px] font-bold"><Star size={10} fill="currentColor" className="inline mr-1" />{movie.rating}</span>
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase leading-tight tracking-wide text-white mb-3 line-clamp-2">{movie.title}</h4>
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); addPlannerEntryFromList(movie, new Date().setHours(0,0,0,0)); }}
                                              className="w-full py-2 bg-white text-black text-[9px] font-black uppercase rounded-sm hover:bg-indigo-500 hover:text-white transition-colors tracking-widest"
                                            >
                                                + Add to Schedule
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                       </div>
                  </div>

                </div>
              )}

              {activeTab === 'calendar' && (
                  <div className="w-full flex flex-col md:flex-row min-h-screen pt-32 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                      {/* Main Calendar Area */}
                      <div className="flex-1 p-4 md:p-8">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                              <div>
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Production Schedule</h2>
                                <p className="text-gray-500 font-bold text-[10px] md:text-[10px] mt-1 uppercase tracking-widest">Temporal Asset Allocation</p>
                              </div>
                              <div className="flex items-center gap-px bg-[#121212] border border-white/10 rounded-sm">
                                  <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="hover:bg-white/10 p-2 bg-transparent text-white border-r border-white/10"><ChevronLeft size={14}/></button>
                                  <span className="font-mono font-bold w-32 md:w-40 text-center uppercase tracking-widest text-[10px] text-gray-300">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                  <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="hover:bg-white/10 p-2 bg-transparent text-white border-l border-white/10"><ChevronRight size={14}/></button>
                              </div>
                          </div>
                          
                          {isPlannerLoading && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-black/80 backdrop-blur-md p-6 border border-white/10 flex flex-col items-center gap-4">
                                  <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Syncing Database...</p>
                              </div>
                          )}
                          
                          <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 shadow-2xl backdrop-blur-xl">
                              {['S','M','T','W','T','F','S'].map((d, idx) => (
                                  <div key={`${d}-${idx}`} className="bg-[#0a0a0a] py-3 text-[9px] font-black text-gray-600 text-center uppercase tracking-widest border-b border-white/5">{d}</div>
                              ))}
                              {calendarDays.map((day, i) => (
                                  <div 
                                    key={i} 
                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-indigo-500/10'); }}
                                    onDragLeave={(e) => { e.currentTarget.classList.remove('bg-indigo-500/10'); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('bg-indigo-500/10');
                                        const movieData = e.dataTransfer.getData('movie');
                                        if (movieData && day) {
                                            const movie = JSON.parse(movieData);
                                            addPlannerEntryFromList(movie, day.timestamp);
                                        }
                                    }}
                                    className={`bg-[#0e0e0e]/50 min-h-[100px] md:h-[180px] p-2 hover:bg-[#151515] transition-all relative group flex flex-col border-[0.5px] border-white/5 ${day && new Date().getDate() === day.day && new Date().getMonth() === currentDate.getMonth() ? 'bg-indigo-500/5' : ''}`}
                                  >
                                      {day ? (
                                          <>
                                              <div className="flex justify-between items-start mb-2">
                                                  <div className={`text-[10px] font-mono font-bold transition-colors ${new Date().getDate() === day.day && new Date().getMonth() === currentDate.getMonth() ? 'text-indigo-400' : 'text-gray-600'}`}>{day.day}</div>
                                                  <button onClick={() => setIsAddingPlan(day.timestamp)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-all bg-white/5 p-1 rounded-sm"><Plus size={12} /></button>
                                              </div>
                                                <div className="flex-1 relative mt-1">
                                                   {/* Stacked Posters - Technical Style */}
                                                   {day.plans.length === 0 && day.movies.length === 0 && (
                                                       <div className="absolute inset-0 border border-dashed border-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                           <span className="text-[8px] uppercase tracking-widest text-gray-700">Empty Slot</span>
                                                       </div>
                                                   )}
                                                   
                                                   {[...day.plans.map(p => ({...p, type: 'plan'})), ...day.movies.map(m => ({title: m, type: 'watched', posterPath: storyboards.find(s => s.filename === m)?.notes.find(n => n.thumbnail)?.thumbnail}))]
                                                    .slice(0, 4).reverse().map((item, idx, arr) => {
                                                       const reverseIdx = arr.length - 1 - idx;
                                                       return (
                                                           <div 
                                                               key={idx} 
                                                               className="absolute top-0 left-0 w-full transition-all duration-300"
                                                               style={{ 
                                                                   zIndex: idx, 
                                                                   transform: `translateY(${reverseIdx * 20}px)`,
                                                               }}
                                                           >
                                                               <div className={`relative h-16 md:h-24 bg-[#111] border ${item.type === 'watched' ? 'border-emerald-500/30' : 'border-white/10'} shadow-sm flex gap-2 p-1`}>
                                                                   <div className="w-10 h-full bg-black flex-shrink-0 relative overflow-hidden">
                                                                       {item.posterPath ? (
                                                                         <img src={item.posterPath} alt="" className="w-full h-full object-cover opacity-80" />
                                                                       ) : (
                                                                         <div className="w-full h-full flex items-center justify-center bg-white/5"><Film size={12} className="text-gray-700"/></div>
                                                                       )}
                                                                   </div>
                                                                   <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                        <span className="text-[8px] font-black uppercase text-gray-300 truncate leading-tight">{item.title}</span>
                                                                        <span className="text-[7px] font-mono text-gray-600 uppercase tracking-wider">{item.type}</span>
                                                                   </div>
                                                                   {item.type === 'plan' && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); deletePlannerEntry((item as any).id); setPlannerEntries(prev => prev.filter(p => p.id !== (item as any).id)); }}
                                                                            className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 p-1"
                                                                        >
                                                                            <Trash2 size={8} />
                                                                        </button>
                                                                   )}
                                                               </div>
                                                           </div>
                                                       );
                                                   })}
                                                </div>
                                              {isAddingPlan === day.timestamp && (
                                                  <div className="absolute inset-x-0 -top-20 z-50 bg-[#0a0a0a] p-4 flex flex-col justify-center border border-white/20 shadow-2xl">
                                                      <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Schedule Asset</h4>
                                                      <input autoFocus type="text" placeholder="ASSET TITLE..." className="bg-black/50 border border-white/10 p-2 text-[10px] text-white mb-2 focus:outline-none focus:border-indigo-500 font-mono" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
                                                      <select className="bg-black/50 border border-white/10 p-2 text-[10px] text-white mb-2 focus:outline-none appearance-none cursor-pointer font-mono" value={planPlatform} onChange={(e) => setPlanPlatform(e.target.value)}>
                                                          <option value="Theater">THEATER_RELEASE</option><option value="Netflix">NETFLIX_STREAM</option><option value="Streaming">VOD_SERVICE</option><option value="BluRay">PHYSICAL_MEDIA</option>
                                                      </select>
                                                      <div className="flex gap-2">
                                                          <button onClick={() => addPlannerEntry(day.timestamp)} className="flex-1 bg-white text-black hover:bg-gray-200 text-[9px] font-black uppercase py-2 transition-colors tracking-widest">Confirm</button>
                                                          <button onClick={() => setIsAddingPlan(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-500 text-[9px] font-black uppercase py-2 transition-colors tracking-widest">Cancel</button>
                                                      </div>
                                                  </div>
                                              )}
                                          </>
                                      ) : <div className="bg-[#050505]/40 h-full"></div>}
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Discovery Sidebar */}
                      <aside className="w-full md:w-[450px] border-t md:border-t-0 md:border-l border-white/5 bg-[#0a0a0a]/80 backdrop-blur-3xl flex flex-col min-h-[300px] md:h-auto">
                          <div className="p-4 md:p-8 border-b border-white/5">
                              <div className="flex items-center gap-3 mb-4 md:mb-8">
                                  <div className="w-10 h-10 rounded-none bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                      <TrendingUp size={20} className="text-indigo-400" />
                                  </div>
                                  <div>
                                      <h3 className="text-xs font-black tracking-[0.2em] uppercase text-white">Discovery Vault</h3>
                                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Global Masterpieces</p>
                                  </div>
                              </div>
                              
                              <div className="relative">
                                  <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                  <input 
                                    type="text" 
                                    placeholder="Search 1M+ movies..."
                                    value={discoverySearch}
                                    onChange={(e) => setDiscoverySearch(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-none py-3 pl-12 pr-4 text-xs font-bold text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-700 uppercase tracking-widest font-mono" 
                                  />
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                              {isApiLoading && apiMovies.length === 0 ? (
                                  <div className="py-20 flex flex-col items-center gap-4">
                                      <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Querying Cinematic Archive...</p>
                                  </div>
                              ) : (
                                <>
                                  {filteredDiscoveryMovies.map((movie) => (
                                    <div 
                                      key={movie.id}
                                      draggable
                                      onDragStart={(e) => {
                                          e.dataTransfer.setData('movie', JSON.stringify(movie));
                                          e.currentTarget.classList.add('opacity-50');
                                      }}
                                      onDragEnd={(e) => { e.currentTarget.classList.remove('opacity-50'); }}
                                      className="group bg-[#0a0a0a] border border-white/5 p-4 hover:border-indigo-500 hover:bg-[#0f0f0f] transition-all cursor-grab active:cursor-grabbing relative overflow-hidden flex gap-4 rounded-none"
                                    >
                                      
                                      {/* Poster Image */}
                                      <div className="relative w-20 h-28 flex-shrink-0 overflow-hidden bg-white/5 border border-white/10 group-hover:border-indigo-500 select-none">
                                          {movie.poster_path ? (
                                              <img src={movie.poster_path} alt={movie.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center">
                                                  <Film size={20} className="text-gray-800" />
                                              </div>
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>

                                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                          <div>
                                              <div className="flex items-center justify-between mb-1">
                                                  <div className="flex items-center gap-1.5 bg-yellow-500/10 px-1.5 py-0.5 rounded text-[9px] font-black text-yellow-500">
                                                      <Star size={8} fill="currentColor" /> {movie.rating}
                                                  </div>
                                                  <span className="text-[9px] font-black text-gray-600 tracking-widest">{movie.year}</span>
                                              </div>
                                              <h4 className="text-xs font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors truncate">{movie.title}</h4>
                                              <p className="text-[9px] text-gray-500 line-clamp-2 mt-1 leading-relaxed font-medium group-hover:text-gray-400 transition-colors">
                                                  {movie.overview || "No overview available."}
                                              </p>
                                          </div>
                                          
                                          <div className="flex items-center gap-2 mt-2">
                                              <div className="h-[1px] flex-1 bg-white/5" />
                                               <button 
                                                 onClick={() => addPlannerEntryFromList(movie, new Date().setHours(0,0,0,0))}
                                                 className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 group-hover:text-indigo-400 transition-colors bg-white/5 px-2 py-1 hover:bg-white/10"
                                               >
                                                   Quick Add
                                               </button>
                                          </div>
                                      </div>
                                    </div>
                                  ))}

                                  {apiPage < apiTotalPages && (
                                    <div className="flex justify-center py-6 mt-4 border-t border-white/5" ref={observerTarget}>
                                        <button 
                                          disabled={isApiLoading}
                                          onClick={() => setApiPage(p => p + 1)}
                                          className="flex items-center gap-2 px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-[#0a0a0a] border border-white/20 hover:bg-white hover:text-black transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isApiLoading ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : <RefreshCcw size={14} />}
                                            Load More
                                        </button>
                                    </div>
                                  )}

                                  {filteredDiscoveryMovies.length === 0 && !isApiLoading && (
                                      <div className="py-20 text-center">
                                          <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">No matching films found</p>
                                      </div>
                                  )}
                                </>
                              )}
                          </div>
                          <div className="p-8 border-t border-white/5 bg-indigo-500/5 text-center">
                              <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">Cinematic Archive</p>
                          </div>
                      </aside>
                  </div>
              )}

              {activeTab === 'analysis' && (
                <div className="w-full px-8 pt-32 animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-[0.2em] text-white">Studio Analytics</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Performance Telemetry</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-indigo-400">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"/> LIVE_DATA_FEED
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 mb-12">
                        <div className="bg-[#0a0a0a] p-8 flex flex-col justify-between h-32 group hover:bg-[#111] transition-colors">
                             <div className="flex justify-between items-start">
                                 <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Frames</span>
                                 <Layers size={16} className="text-gray-600 group-hover:text-white transition-colors"/>
                             </div>
                             <div className="text-4xl font-mono font-bold text-white tracking-tighter">{totalFrames}</div>
                        </div>
                        <div className="bg-[#0a0a0a] p-8 flex flex-col justify-between h-32 group hover:bg-[#111] transition-colors">
                             <div className="flex justify-between items-start">
                                 <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active Projects</span>
                                 <Film size={16} className="text-gray-600 group-hover:text-white transition-colors"/>
                             </div>
                             <div className="text-4xl font-mono font-bold text-white tracking-tighter">{storyboards.length}</div>
                        </div>
                        <div className="bg-[#0a0a0a] p-8 flex flex-col justify-between h-32 group hover:bg-[#111] transition-colors">
                             <div className="flex justify-between items-start">
                                 <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Analysis Time</span>
                                 <Clock size={16} className="text-gray-600 group-hover:text-white transition-colors"/>
                             </div>
                             <div className="text-4xl font-mono font-bold text-white tracking-tighter">{Math.round(activityLogs.reduce((acc, l) => acc + l.durationPlayed, 0) / 60)}<span className="text-sm text-gray-500 ml-1">MIN</span></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        <div className="bg-[#0a0a0a] border border-white/5 p-8">
                             <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                                 <Activity className="text-indigo-500" size={16} />
                                 <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">14-Day Activity Cycle</h3>
                             </div>
                            <div className="h-64 flex items-end gap-2">
                                {dailyActivity.map((day, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                                        <div className="w-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-all border-t border-indigo-500/50" style={{ height: `${Math.max(5, Math.min(100, (day.minutes / 120) * 100))}%` }}></div>
                                        <div className="text-[8px] font-mono text-gray-600 truncate w-full text-center group-hover:text-white transition-colors">{day.date.split(',')[0]}</div>
                                        <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 text-[9px] bg-white text-black px-1 py-0.5 font-bold">{day.minutes}m</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 p-8">
                             <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                                 <Clock className="text-indigo-500" size={16} />
                                 <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Temporal Distribution</h3>
                             </div>
                            <div className="h-64 flex items-end gap-1">
                                {watchPatterns.map((val, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                        <div className="w-full bg-white/5 group-hover:bg-white/20 transition-all" style={{ height: `${Math.max(2, val)}%` }}></div>
                                        {idx % 4 === 0 && <div className="text-[8px] font-mono text-gray-700 mt-2">{idx.toString().padStart(2,'0')}</div>}
                                    </div>
                                ))}
                            </div>
                            <div className="text-right text-[9px] text-gray-600 font-bold mt-4 uppercase tracking-widest">Hour (24H)</div>
                        </div>
                    </div>
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="w-full px-8 pt-32 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tight">Movie Insights</h2>
                            <p className="text-gray-500 font-bold text-sm mt-1">Deep analysis of your cinematic library.</p>
                        </div>
                        <div className="relative">
                            <select 
                                className="bg-[#050505] border border-white/20 text-white text-xs font-black py-2 px-4 focus:outline-none uppercase tracking-widest appearance-none pr-10 cursor-pointer hover:border-white/50 transition-all rounded-none" 
                                onChange={(e) => setSelectedAnalysisMovie(e.target.value)} 
                                value={selectedAnalysisMovie || ""}
                            >
                                <option value="" disabled>SELECT_TARGET...</option>
                                {storyboards.map(s => (
                                    <option key={s.filename} value={s.filename}>{formatMovieName(s.filename)}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"><ChevronDown size={14}/></div>
                        </div>
                    </div>

                    {selectedMovieData ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1 space-y-6">
                                <div className="bg-[#0a0a0a] border border-white/10 p-6">
                                    <div className="flex items-center gap-3 mb-6 font-black text-gray-400 uppercase text-xs tracking-widest"><FileVideo size={16}/> Metric Overview</div>
                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-4 border border-white/5 hover:border-white/20 transition-colors">
                                            <div className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-wider">Analysis Notes</div>
                                            <div className="text-3xl font-black text-white">{selectedMovieData.notes.length}</div>
                                        </div>
                                        <div className="bg-white/5 p-4 border border-white/5 hover:border-white/20 transition-colors">
                                            <div className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-wider">Identified Scenes</div>
                                            <div className="text-3xl font-black text-white">{selectedMovieData.segments?.length || 0}</div>
                                        </div>
                                        <div className="bg-white/5 p-4 border border-white/5 hover:border-white/20 transition-colors">
                                            <div className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-wider">Total Duration</div>
                                            <div className="text-3xl font-black text-white">{Math.floor((selectedMovieData.duration || 0) / 60)}m {Math.floor((selectedMovieData.duration || 0) % 60)}s</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-2 space-y-8">
                                <div className="bg-[#0a0a0a] border border-white/10 p-8">
                                    <div className="flex items-center gap-3 mb-6 font-black text-gray-400 uppercase text-xs tracking-widest"><Layers size={16}/> Structural Composition</div>
                                    <div className="space-y-6">
                                        {movieGenreData.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                                {movieGenreData.map((genre) => (
                                                    <div key={genre.name} className="space-y-3">
                                                        <div className="flex justify-between items-end">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${getSceneColor(genre.name).replace('bg-', 'bg-')}`} />
                                                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{genre.name}</span>
                                                            </div>
                                                            <div className="text-[10px] font-black text-indigo-400">{Math.round((genre.value / (selectedMovieData.duration || 1)) * 100)}%</div>
                                                        </div>
                                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                                                            <div 
                                                                className={`h-full ${getSceneColor(genre.name)} shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-1000`} 
                                                                style={{ width: `${(genre.value / (selectedMovieData.duration || 1)) * 100}%` }}
                                                            >
                                                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-12 text-center text-gray-600 font-bold text-sm italic border-2 border-dashed border-white/5 rounded-2xl">
                                                No scene segments mapped for this movie.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-[#0a0a0a] border border-white/10 p-8 relative overflow-hidden group">
                                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Intensity Temporal Distribution</h3>
                                        </div>
                                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-4">
                                            <span>X: Timeline (seconds)</span>
                                            <span className="w-px h-2 bg-white/10" />
                                            <span>Y: Rating Matrix</span>
                                        </div>
                                    </div>

                                    <div className="h-64 w-full bg-black/40 rounded border border-white/5 relative overflow-visible mt-4">
                                        {/* Professional Technical Waveform SVG */}
                                        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                            {selectedMovieData.segments && selectedMovieData.segments.length > 0 ? (
                                                <>
                                                    {/* Clean Line Path */}
                                                    <path 
                                                        d={`M 0 100 ${selectedMovieData.segments
                                                            .sort((a,b) => a.startTime - b.startTime)
                                                            .reduce((acc: any[], seg: any) => {
                                                                const lastEnd = acc.length > 0 ? acc[acc.length - 1].endTime : -1;
                                                                if (seg.startTime >= lastEnd) acc.push(seg);
                                                                return acc;
                                                            }, [])
                                                            .map((seg: any, i: number, arr: any[]) => {
                                                                const x = (seg.startTime / (selectedMovieData.duration || 1)) * 1000;
                                                                const y = 100 - (seg.rating || 10);
                                                                const endX = (seg.endTime / (selectedMovieData.duration || 1)) * 1000;
                                                                
                                                                if (i === 0) return `L 0 ${y} L ${x} ${y} L ${endX} ${y}`;
                                                                
                                                                const prev = arr[i-1];
                                                                const prevEndX = (prev.endTime / (selectedMovieData.duration || 1)) * 1000;
                                                                const prevY = 100 - (prev.rating || 10);
                                                                const cp1x = prevEndX + (x - prevEndX) / 2;
                                                                const cp2x = prevEndX + (x - prevEndX) / 2;
                                                                
                                                                return `C ${cp1x} ${prevY}, ${cp2x} ${y}, ${x} ${y} L ${endX} ${y}`;
                                                            }).join(' ')} L 1000 100`}
                                                        fill="none"
                                                        stroke="#4f46e5"
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        className="transition-all duration-300"
                                                    />
                                                </>
                                            ) : null}
                                        </svg>

                                        {/* Overlay Technical Regions */}
                                        <div className="absolute inset-0 flex">
                                            {selectedMovieData.segments?.map(seg => (
                                                <div 
                                                    key={seg.id}
                                                    className="h-full hover:bg-white/[0.02] transition-colors group flex items-end justify-center cursor-default z-10"
                                                    style={{ width: `${((seg.endTime - seg.startTime) / (selectedMovieData.duration || 1)) * 100}%` }}
                                                >
                                                    {/* Professional Label Overlay on Hover */}
                                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2 rounded-sm text-[9px] font-black whitespace-nowrap z-50 pointer-events-none transition-all shadow-xl uppercase">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <span>Type: {seg.type}</span>
                                                            <span className="text-gray-400">|</span>
                                                            <span className="text-indigo-600">Intensity: {seg.rating}</span>
                                                        </div>
                                                        <div className="text-[8px] font-bold text-gray-500">
                                                            Range: {Math.floor(seg.startTime / 60)}:{(seg.startTime % 60).toString().padStart(2, '0')} - {Math.floor(seg.endTime / 60)}:{(seg.endTime % 60).toString().padStart(2, '0')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {(!selectedMovieData.segments || selectedMovieData.segments.length === 0) && (
                                            <div className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-700 font-black uppercase tracking-[0.3em] bg-black/20">Segment Data Undefined</div>
                                        )}
                                    </div>
                                </div>

                                
                                {/* MIT-Style Technical Analysis Section */}
                                <div className="grid grid-cols-1 gap-6">
                                    {/* Cinematic Genome: Professional Schematic */}
                                    <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-8 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-12 border-b border-white/5 pb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                                <div>
                                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Structural Composition Analysis</h3>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Nucelotide Sequence Mapping v1.0.4</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Processing Mode</div>
                                                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">High Fidelity</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                            <div className="lg:col-span-12">
                                                <div className="bg-black/20 p-8 rounded-lg border border-white/5 font-mono text-lg font-bold flex flex-wrap gap-x-4 gap-y-3 relative group">
                                                    {(selectedMovieData.segments || [])
                                                        .sort((a,b) => a.startTime - b.startTime)
                                                        .map((seg, i) => {
                                                            const nuc = (() => {
                                                                const t = seg.type.toLowerCase();
                                                                if (t === 'action') return 'A';
                                                                if (t === 'comedy') return 'C';
                                                                if (t === 'suspense') return 'S';
                                                                if (t === 'drama') return 'G';
                                                                if (t === 'thriller') return 'T';
                                                                if (t === 'dialogue') return 'V';
                                                                if (t === 'romance') return 'R';
                                                                return 'X';
                                                            })();
                                                            return (
                                                                <span key={i} className="cursor-default relative group/nuc">
                                                                    <span className="text-gray-500 hover:text-white transition-colors duration-300">{nuc}</span>
                                                                    <div className="opacity-0 group-hover/nuc:opacity-100 absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded-sm text-[8px] font-black whitespace-nowrap z-50 transition-all pointer-events-none uppercase">
                                                                        {seg.type} | {Math.floor(seg.startTime/60)}:{(Math.floor(seg.startTime%60)).toString().padStart(2,'0')}
                                                                    </div>
                                                                </span>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                            
                                            <div className="lg:col-span-8 flex flex-col justify-center">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                                                    {[
                                                        { label: 'Adenine', value: 'Action', color: 'bg-gray-400' },
                                                        { label: 'Cytosine', value: 'Comedy', color: 'bg-gray-400' },
                                                        { label: 'Sugar', value: 'Suspense', color: 'bg-indigo-500' },
                                                        { label: 'Guanine', value: 'Drama', color: 'bg-gray-400' }
                                                    ].map(item => (
                                                        <div key={item.label} className="flex flex-col gap-1 border-l border-white/10 pl-4">
                                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{item.label}</span>
                                                            <span className="text-[11px] font-black text-white uppercase tracking-tight">{item.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="lg:col-span-4 h-64 bg-black/40 rounded-lg border border-white/5 relative flex items-center justify-center overflow-hidden [perspective:2000px]">
                                                {/* DNA Helix Container: More technical, slower, no glow */}
                                                <div className="w-32 h-full relative [transform-style:preserve-3d] animate-dna-slow-spin">
                                                    {Array.from({ length: 20 }).map((_, i) => {
                                                        const rotation = i * 28;
                                                        const yOffset = (i * 12) - 120;
                                                        const progress = i / 19;
                                                        const time = progress * (selectedMovieData.duration || 1);
                                                        const seg = selectedMovieData.segments?.find(s => time >= s.startTime && time <= s.endTime);
                                                        const isAccent = seg?.type === 'suspense' || seg?.type === 'action';
                                                        const color = isAccent ? '#6366f1' : '#1e1e1e';

                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
                                                                style={{ transform: `translate3d(-50%, -50%, 0) translateY(${yOffset}px) rotateY(${rotation}deg)` }}
                                                            >
                                                                <div className="w-16 h-[0.5px] bg-white/5 absolute -left-8 top-0" />
                                                                <div className="w-1.5 h-1.5 rounded-full absolute -left-9 -top-0.5" style={{ backgroundColor: color }} />
                                                                <div className="w-1.5 h-1.5 rounded-full absolute left-7 -top-0.5 bg-gray-800" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <style dangerouslySetInnerHTML={{ __html: `
                                                    @keyframes dnaSlowRotation {
                                                        from { transform: rotateY(0deg); }
                                                        to { transform: rotateY(360deg); }
                                                    }
                                                    .animate-dna-slow-spin {
                                                        animation: dnaSlowRotation 30s linear infinite;
                                                    }
                                                ` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Secondary Metrics Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-[#0a0a0a] border border-white/5 p-8">
                                            <div className="flex items-center gap-3 mb-8 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                                <Activity size={12} strokeWidth={3}/> Engagement Persistence
                                            </div>
                                            {selectedMovieData.heatmap && (
                                                <div className="h-24 w-full bg-black/40 rounded border border-white/5 overflow-hidden">
                                                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                                        <path 
                                                            d={`M 0 100 ${selectedMovieData.heatmap.map((val, i) => {
                                                                const x = (i / (selectedMovieData.heatmap!.length - 1)) * 1000;
                                                                const y = 100 - (val * 8);
                                                                return `L ${x} ${y}`;
                                                            }).join(' ')} L 1000 100`}
                                                            fill="none"
                                                            stroke="#4f46e5"
                                                            strokeWidth="1"
                                                        />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-[#0a0a0a] border border-white/5 p-8">
                                            <div className="flex items-center gap-3 mb-8 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                                <MonitorPlay size={12} strokeWidth={3}/> Event Distribution
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {['play', 'pause', 'seek', 'exit'].map(type => {
                                                    const count = activityLogs
                                                       .filter(l => l.filename === selectedMovieData.filename)
                                                       .reduce((acc, l) => acc + (l.interactions?.filter(i => i.type === type).length || 0), 0);
                                                    return (
                                                        <div key={type} className="flex flex-col border border-white/5 p-3 rounded bg-black/20">
                                                            <span className="text-[8px] font-black text-gray-600 uppercase mb-1">{type}</span>
                                                            <span className="text-xl font-bold text-white tabular-nums">{count}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 bg-[#121212]/50 border border-white/5 rounded-[2rem]">
                            <TrendingUp size={48} className="text-gray-800 mb-4" />
                            <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Select a movie from the top right to view insights</p>
                        </div>
                    )}
                </div>
              )}



              {activeTab === 'ideas' && (
                  <div className="w-full px-8 pt-24 pb-20 max-w-7xl mx-auto">
                      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                          <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Concept Repository</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Encrypted Local Storage // v2.4.0</p>
                          </div>
                          <button 
                            onClick={() => setIsAddingIdea(true)}
                            className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-sm font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95 border border-white"
                          >
                               <Plus size={14} strokeWidth={3} /> New Asset
                          </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
                          {storyIdeas.map(idea => (
                              <div key={idea.id} className="bg-[#0a0a0a] p-8 hover:bg-[#111] transition-all group relative">
                                  <div className="flex justify-between items-center mb-6">
                                      <div className="flex items-center gap-3">
                                          <div className="w-1.5 h-1.5 rounded-sm bg-indigo-500" />
                                          <span className="text-[9px] font-mono text-gray-600">{idea.id.split('-')[0]}</span>
                                      </div>
                                      <button 
                                        onClick={() => handleDeleteIdea(idea.id)}
                                        className="text-gray-700 hover:text-red-500 transition-colors p-1"
                                      >
                                          <X size={14} />
                                      </button>
                                  </div>
                                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 group-hover:text-indigo-400 transition-colors">{idea.title}</h3>
                                  <p className="text-gray-500 text-[11px] font-mono leading-relaxed mb-6 line-clamp-3">
                                      {idea.description}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                      {idea.tags.map(tag => (
                                          <span key={tag} className="text-[8px] font-black uppercase text-gray-400 bg-white/5 px-2 py-1 tracking-wider border border-white/5">
                                              {tag}
                                          </span>
                                      ))}
                                  </div>
                              </div>
                          ))}

                          {storyIdeas.length === 0 && !isIdeasLoading && (
                              <div className="col-span-full py-32 flex flex-col items-center justify-center bg-[#0a0a0a]">
                                  <div className="bg-white/5 w-16 h-16 flex items-center justify-center mb-6">
                                      <Lightbulb size={24} className="text-gray-700" />
                                  </div>
                                  <p className="text-gray-600 font-bold uppercase tracking-widest text-xs">Repository Empty</p>
                                  <button 
                                    onClick={() => setIsAddingIdea(true)}
                                    className="mt-6 text-indigo-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors"
                                  >
                                    [ Initialize First Concept ]
                                  </button>
                              </div>
                          )}
                      </div>

                      {/* Add Idea Modal: Technical Variant */}
                      {isAddingIdea && (
                          <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                              <div className="bg-black border border-white/20 w-full max-w-lg p-0 shadow-2xl">
                                  <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080808]">
                                      <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 bg-indigo-500 animate-pulse"/>
                                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">New Concept Entry</h3>
                                      </div>
                                      <div className="text-[9px] font-mono text-gray-500">SYS_ID: {Math.floor(Math.random()*10000)}</div>
                                  </div>
                                  
                                  <div className="p-8 space-y-6">
                                      <div className="space-y-2">
                                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Title Designation</label>
                                          <input 
                                            autoFocus
                                            type="text" 
                                            className="w-full bg-[#121212] border border-white/10 p-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                                            value={newIdea.title}
                                            onChange={(e) => setNewIdea({...newIdea, title: e.target.value})}
                                            placeholder="ENTER_TITLE..."
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Description Data</label>
                                          <textarea 
                                            rows={6}
                                            className="w-full bg-[#121212] border border-white/10 p-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                                            value={newIdea.description}
                                            onChange={(e) => setNewIdea({...newIdea, description: e.target.value})}
                                            placeholder="> Input narrative parameters..."
                                          />
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Tags (CSV)</label>
                                          <input 
                                            type="text" 
                                            className="w-full bg-[#121212] border border-white/10 p-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                                            value={newIdea.tags}
                                            onChange={(e) => setNewIdea({...newIdea, tags: e.target.value})}
                                            placeholder="SCI-FI, NOIR,..."
                                          />
                                      </div>
                                  </div>

                                  <div className="p-4 bg-[#080808] border-t border-white/10 flex gap-4">
                                      <button 
                                        onClick={handleAddIdea}
                                        className="flex-1 bg-white text-black py-3 font-black uppercase text-[10px] tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-all"
                                      >
                                          Commit Entry
                                      </button>
                                      <button 
                                        onClick={() => { setIsAddingIdea(false); setNewIdea({ title: "", description: "", tags: "" }); }}
                                        className="flex-1 bg-transparent border border-white/10 text-gray-400 py-3 font-black uppercase text-[10px] tracking-[0.2em] hover:bg-white/5 hover:text-white transition-all"
                                      >
                                          Abort
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              )}
              {activeTab === 'movies' && (
                  <div className="w-full px-8 pt-32 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                      <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
                        <div>
                             <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Media Library</h2>
                             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Stored Visual Assets</p>
                        </div>
                        <div className="flex gap-px bg-[#121212] border border-white/10 rounded-sm">
                            <button className="p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border-r border-white/10"><CalendarIcon size={14} /></button>
                            <button className="p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"><Star size={14} /></button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                          {storyboards.map(movie => {
                              const poster = movie.notes.find(n => n.thumbnail)?.thumbnail;
                              return (
                                  <div key={movie.filename} onClick={() => setPlayingStoryboard(movie)} className="group relative bg-[#0a0a0a] border border-white/10 hover:border-indigo-500/50 transition-all cursor-pointer">
                                      <div className="aspect-[2/3] bg-black relative overflow-hidden">
                                          {poster ? (
                                             <img src={poster} alt={movie.filename} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0 transition-all duration-500" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-[#111] text-gray-800">
                                                  <Clapperboard size={32} />
                                              </div>
                                          )}
                                          
                                          {/* Technical Overlay */}
                                          <div className="absolute inset-0 bg-[#0a0a0a]/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4">
                                              <div className="flex justify-between items-start">
                                                  <div className="px-1.5 py-0.5 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest">
                                                      OPEN
                                                  </div>
                                              </div>
                                              <div>
                                                  <p className="text-[8px] font-mono text-indigo-400 mb-1">ID: {(movie.id || movie.filename || 'UNKNOWN').substring(0,8)}</p>
                                                  <div className="h-px w-full bg-indigo-500/30 mb-2" />
                                                  <div className="flex items-center gap-1.5 text-white text-[9px] font-bold uppercase tracking-wider">
                                                       <MonitorPlay size={10} /> ACCESS
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="p-4 border-t border-white/5 bg-[#050505]">
                                          <h3 className="font-bold text-white text-[10px] truncate mb-1 uppercase tracking-widest" title={movie.filename}>
                                            {formatMovieName(movie.filename)}
                                          </h3>
                                          <div className="flex items-center justify-between text-[8px] text-gray-600 font-mono">
                                              <span>{new Date(movie.lastModified).getFullYear()}</span>
                                              <span>{movie.notes.length} SEGS</span>
                                          </div>
                                      </div>
                                  </div>
                              )
                          })}
                          {storyboards.length === 0 && (
                            <div className="col-span-full py-20 text-center text-gray-500 flex flex-col items-center">
                                <Clapperboard size={32} className="mx-auto mb-4 opacity-20" />
                                <p className="font-mono text-xs uppercase tracking-widest mb-6">Database Empty</p>
                                
                                <div className="bg-[#0a0a0a] p-6 border border-white/5 max-w-md w-full">
                                    <h3 className="text-white font-black uppercase text-xs tracking-widest mb-2">Data Sync Required</h3>
                                    <p className="text-[10px] text-gray-400 mb-4 font-mono">Legacy local assets detected in disconnected storage sector.</p>
                                    <button 
                                        onClick={handleMigration} 
                                        disabled={isMigrating}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 font-black uppercase text-[9px] tracking-[0.2em] transition-all w-full text-center"
                                    >
                                        {isMigrating ? "PROCESSING..." : "INITIATE CLOUD MIGRATION"}
                                    </button>
                                </div>
                            </div>
                          )}
                      </div>
                  </div>
              )}
            </div>
            
            {/* Premium Upload Modal Overlay */}
            {isDragging && (
                <div 
                   className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-500"
                   onDragOver={handleDragOver}
                   onDrop={handleDrop}
                >
                    <button 
                       onClick={() => setIsDragging(false)}
                       className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white text-gray-400 hover:text-black transition-all border border-white/10"
                    >
                        <XCircle size={32} strokeWidth={1} />
                    </button>

                    <div className="max-w-2xl w-full text-center space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">Initialize Studio</h2>
                            <p className="text-gray-400 font-medium text-lg">Select or drop your cinematic footage to begin professional analysis.</p>
                        </div>

                        <div className="relative group p-1">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            <div 
                                className="relative bg-black rounded-[2.4rem] border border-white/10 p-16 md:p-24 flex flex-col items-center justify-center gap-8 transition-all cursor-pointer hover:bg-white/[0.02]"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-[0_0_50px_rgba(99,102,241,0.5)] animate-pulse">
                                    <Upload size={40} strokeWidth={3} />
                                </div>
                                
                                <div className="space-y-2">
                                    <p className="text-2xl font-black uppercase tracking-tight">Drop Footage Here</p>
                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Standard & High-Res Formats Supported</p>
                                </div>

                                <div className="relative">
                                    <input 
                                        type="file" 
                                        accept="video/*,.mkv,.mp4,.mov,.avi" 
                                        ref={fileInputRef}
                                        onChange={(e) => { handleFileSelect(e); setIsDragging(false); }}
                                        className="hidden" 
                                    />
                                    <button className="bg-white text-black px-12 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">
                                        Browse Files
                                    </button>
                                </div>
                            </div>
                        </div>

                        <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em]">Encrypted Cloud Processing Enabled</p>
                    </div>
                </div>
            )}

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 flex items-center justify-around shadow-2xl z-[100]">
                {[
                    { id: 'home', icon: <MonitorPlay size={18} />, label: 'Home' },
                    { id: 'movies', icon: <Film size={18} />, label: 'Library' },
                    { id: 'calendar', icon: <CalendarIcon size={18} />, label: 'Journal' },
                    { id: 'analysis', icon: <BarChart3 size={18} />, label: 'Stats' },
                    { id: 'insights', icon: <TrendingUp size={18} />, label: 'Analytics' },
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-lg scale-105' : 'text-gray-500'}`}
                    >
                        {tab.icon}
                        <span className="text-[7px] font-black uppercase mt-1 tracking-tighter">{tab.label}</span>
                    </button>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
