import React, { useState, useCallback, useEffect, useMemo } from 'react';
import VideoPlayer from './components/VideoPlayer';
import StoryboardReview from './components/StoryboardReview';
import { loadFromCloud, fetchAllStoryboards, saveToCloud, loadPlannerEntries, savePlannerEntry, deletePlannerEntry } from './services/firebase';
import { TopMovie } from './movieData';
import { 
  Upload, Film, FileVideo, Layers, Shield, Zap, Clock, Trash2, Layout, 
  PlayCircle, FolderPlus, Folder, ChevronRight, ChevronDown, MoreVertical, 
  Search, BookOpen, BarChart3, TrendingUp, Star, Calendar as CalendarIcon, 
  MonitorPlay, Clapperboard, RefreshCcw, LogOut, ChevronLeft, Plus, CheckCircle2, XCircle,
  Activity, Tv, Monitor, Disc, Database, Ticket, Play
} from 'lucide-react';
import { Note, SceneSegment, ActivityLog, MovieMeta, PlannerEntry, StoredStoryboard } from './types';
import { tmdbService } from './services/tmdbService';
import { Globe, BookOpen as BookIcon } from 'lucide-react';

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

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const observerTarget = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'storyboards' | 'analysis' | 'calendar' | 'movies' | 'insights'>('home');
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
      if (droppedFile.type.startsWith('video/')) {
          setFile(droppedFile);
          addToRecentlyWatched(droppedFile.name);
      } else alert("Please upload a valid video file.");
    }
  }, [addToRecentlyWatched]);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && e.target.files[0].type.startsWith('video/')) {
        const selected = e.target.files[0];
        setFile(selected);
        addToRecentlyWatched(selected.name);
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
      return storyboards.find(s => s.filename === selectedAnalysisMovie);
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
    <div className="relative min-h-screen w-full bg-[#050505] text-white flex flex-col overflow-hidden font-sans selection:bg-indigo-500/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[20%] w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-blob"></div>
        <div className="absolute top-[20%] right-[20%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[30%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      <main className="flex-1 flex flex-col relative z-10">
        {file ? (
          <div className="absolute inset-0 bg-black animate-in fade-in duration-700">
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
          <div className="flex-1 flex flex-col h-screen">
            <div className={`fixed top-0 left-0 w-full p-4 md:px-12 md:py-4 flex justify-between items-center z-[100] transition-all duration-700 ${isScrolled ? 'nav-blur py-3' : 'bg-gradient-to-b from-black/60 to-transparent py-8'}`}>
              <div className="flex items-center gap-14">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('home')}>
                  <FilmdaLogoText />
                </div>
                
                <div className="hidden lg:flex items-center gap-6">
                  {[
                      { id: 'home', label: 'Home' },
                      { id: 'movies', label: 'Library' },
                      { id: 'calendar', label: 'Journal' },
                      { id: 'analysis', label: 'Stats' },
                      { id: 'insights', label: 'Analytics' },
                  ].map((tab) => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`text-sm font-bold tracking-tight transition-all hover:text-white ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}
                      >
                        {tab.label}
                      </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center bg-black/40 border border-white/10 rounded-full px-4 py-1.5 focus-within:border-white/30 transition-all">
                  <Search size={16} className="text-gray-500" />
                  <input type="text" placeholder="Titles, genres..." className="bg-transparent border-none text-sm px-3 focus:outline-none w-40 text-white placeholder:text-gray-600 font-medium" />
                </div>
                <button 
                  onClick={() => setIsDragging(true)}
                  className="bg-white text-black px-5 py-2 rounded-md text-xs font-black uppercase tracking-wider hover:bg-white/90 transition-all flex items-center gap-2"
                >
                  <Plus size={16} strokeWidth={3} />
                  Analyze
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-12">
              {activeTab === 'home' && (
                <div className="animate-in fade-in duration-1000">
                  <div className="relative h-[90vh] w-full group overflow-hidden">
                    <div className="absolute inset-0">
                      <img 
                        src={nowPlayingMovies[0]?.poster_path || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000&auto=format&fit=crop"} 
                        alt="Hero Backdrop"
                        className="w-full h-full object-cover brightness-[0.5] transition-transform duration-[20s] group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/20 to-transparent" />
                      <div className="absolute inset-0 netflix-gradient" />
                    </div>

                    <div className="absolute bottom-[15%] left-4 md:left-12 max-w-3xl space-y-6 animate-slide-up">
                      <div className="flex items-center gap-3">
                        <span className="bg-red-600 text-white text-[10px] font-[1000] px-3 py-1 rounded-sm tracking-[0.2em] uppercase">Cinematic Intelligence</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="currentColor" className="text-yellow-500" />)}
                        </div>
                      </div>
                      
                      <h1 className="text-7xl md:text-[9rem] font-[1000] tracking-[-0.06em] uppercase leading-[0.85] text-white">
                        FRAME <br/> BY <span className="text-indigo-600">FRAME</span>
                      </h1>
                      
                      <p className="text-xl text-gray-300 font-bold leading-relaxed max-w-lg tracking-tight">
                        The ultimate analytical suite for professional filmmakers and cinema enthusiasts. Decode the language of cinema.
                      </p>

                      <div className="flex items-center gap-5 pt-6">
                        <button 
                          onClick={() => setIsDragging(true)}
                          className="bg-white text-black px-12 py-5 rounded-md font-black uppercase tracking-widest flex items-center gap-3 hover:bg-white/90 transition-all scale-100 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                        >
                          <PlayCircle size={28} fill="currentColor" />
                          Initialize Session
                        </button>
                        <button 
                          onClick={() => setActiveTab('calendar')}
                          className="bg-white/10 backdrop-blur-3xl text-white border border-white/20 px-10 py-5 rounded-md font-black uppercase tracking-widest flex items-center gap-3 hover:bg-white/20 transition-all"
                        >
                          <BookOpen size={24} />
                          Journal
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Scrolling Rows */}
                  <div className="relative z-20 -mt-40 space-y-16 pb-32">
                    {/* Row 0: Now Playing / IMDB Style */}
                    <div className="pl-4 md:pl-12 space-y-6">
                      <div className="flex items-end gap-3">
                        <h3 className="text-2xl font-[1000] tracking-tighter text-white uppercase italic">
                          Now Streaming
                        </h3>
                        <span className="text-indigo-500 font-black text-xs uppercase tracking-widest mb-1 pb-px border-b border-indigo-500/30">Latest Releases</span>
                      </div>
                      <div className="flex gap-5 overflow-x-auto pb-10 no-scrollbar pr-12">
                        {nowPlayingMovies.map((movie, idx) => (
                          <div 
                            key={movie.id}
                            className="netflix-card flex-shrink-0 w-48 md:w-60 aspect-[2/3] bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.6)] group"
                          >
                            {idx < 10 && (
                                <div className="absolute top-0 right-0 z-10 w-12 h-16 bg-red-600/90 backdrop-blur-md flex flex-col items-center justify-center font-[1050] text-white italic clip-path-banner">
                                    <span className="text-[10px] leading-tight opacity-70">TOP</span>
                                    <span className="text-2xl leading-none">{idx + 1}</span>
                                </div>
                            )}
                            <img 
                              src={movie.poster_path} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              alt={movie.title}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-yellow-500 font-black text-xs flex items-center gap-1"><Star size={12} fill="currentColor" /> {movie.rating}</span>
                                <span className="bg-white/10 text-[8px] font-black px-2 py-0.5 rounded-full uppercase text-gray-300">4K Ultra HD</span>
                              </div>
                              <span className="font-[1000] text-base uppercase leading-tight line-clamp-2 tracking-tight">{movie.title}</span>
                              <div className="flex gap-2 mt-4">
                                <button className="flex-1 bg-white text-black text-[10px] font-black uppercase py-2.5 rounded-lg hover:bg-gray-200 transition-colors">Details</button>
                                <button className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-lg hover:bg-white/20 transition-all"><Plus size={16} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Row 1: Recently Watched (Dynamic TMDB) */}
                    {recentlyWatched.length > 0 && (
                        <div className="pl-4 md:pl-12 space-y-6">
                            <div className="flex items-end gap-3">
                                <h3 className="text-2xl font-[1000] tracking-tighter text-white uppercase italic">
                                    Recently Watched
                                </h3>
                                <span className="text-pink-500 font-black text-xs uppercase tracking-widest mb-1 pb-px border-b border-pink-500/30">Continue Analysis</span>
                            </div>
                            <div className="flex gap-5 overflow-x-auto pb-10 no-scrollbar pr-12">
                                {recentlyWatched.map((movie) => (
                                    <div 
                                        key={movie.id}
                                        className="netflix-card flex-shrink-0 w-44 md:w-56 aspect-[2/3] bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.6)] group cursor-pointer"
                                    >
                                        {movie.poster_path ? (
                                            <img 
                                                src={movie.poster_path} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                alt={movie.title}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-gray-900 to-black">
                                                <Clapperboard size={48} className="text-gray-800 mb-4" />
                                                <span className="text-[10px] font-black uppercase text-gray-500">{movie.title}</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-yellow-500 font-black text-xs flex items-center gap-1"><Star size={12} fill="currentColor" /> {movie.rating}</span>
                                                <span className="bg-white/10 text-[8px] font-black px-2 py-0.5 rounded-full uppercase text-gray-300">WATCHED</span>
                                            </div>
                                            <span className="font-[1000] text-sm uppercase leading-tight line-clamp-2 tracking-tight">{movie.title}</span>
                                            <div className="flex gap-2 mt-4">
                                                <button className="flex-1 bg-white text-black text-[10px] font-black uppercase py-2.5 rounded-lg hover:bg-gray-200 transition-colors">Play</button>
                                                <button className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-lg hover:bg-white/20 transition-all"><BarChart3 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Row 2: Recent Analysis */}
                    {storyboards.length > 0 && (
                      <div className="pl-4 md:pl-12 space-y-6">
                        <h3 className="text-2xl font-black tracking-tighter text-white flex items-center gap-3 uppercase italic">
                          Analysis Vault
                          <span className="w-12 h-px bg-white/20"></span>
                        </h3>
                        <div className="flex gap-6 overflow-x-auto pb-10 no-scrollbar pr-12">
                          {storyboards.slice(0, 10).map((sb) => (
                            <div 
                              key={sb.filename}
                              onClick={() => setPlayingStoryboard(sb)}
                              className="netflix-card flex-shrink-0 w-72 md:w-96 h-40 md:h-56 bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                            >
                              <img 
                                src={sb.notes.find(n => n.thumbnail)?.thumbnail || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400&auto=format&fit=crop'} 
                                className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-all duration-700"
                                alt={sb.filename}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-6">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="bg-indigo-600 text-[9px] font-black px-2 py-0.5 rounded-sm tracking-widest uppercase">{sb.scenes?.length || 0} Cuts</span>
                                  <span className="bg-white/10 backdrop-blur-md text-[9px] font-black px-2 py-0.5 rounded-sm tracking-widest uppercase">{sb.notes?.length || 0} Frames</span>
                                </div>
                                <span className="font-black text-lg md:text-xl truncate uppercase tracking-tight">{formatMovieName(sb.filename)}</span>
                                <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-8 h-8 bg-white rounded-full text-black flex items-center justify-center shadow-xl"><Play size={12} fill="currentColor" className="ml-0.5" /></div>
                                  <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">Open Analysis</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Row 2: Global Classics */}
                    <div className="pl-4 md:pl-12 space-y-6">
                      <h3 className="text-2xl font-black tracking-tighter text-white flex items-center gap-3 uppercase italic">
                        Cinephile Archives
                        <span className="w-12 h-px bg-white/20"></span>
                      </h3>
                      <div className="flex gap-5 overflow-x-auto pb-10 no-scrollbar pr-12">
                        {apiMovies.filter(m => !nowPlayingMovies.find(nm => nm.id === m.id)).map((movie) => (
                          <div 
                            key={movie.id}
                            className="netflix-card flex-shrink-0 w-44 md:w-56 aspect-[2/3] bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                          >
                            <img 
                              src={movie.poster_path} 
                              className="w-full h-full object-cover hover:scale-110 transition-transform duration-[10s]"
                              alt={movie.title}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-all flex flex-col items-center justify-center p-5 text-center">
                              <div className="w-14 h-14 rounded-full border-2 border-white/30 flex items-center justify-center mb-4 transition-transform group-hover:rotate-12">
                                <Plus size={24} className="text-white" />
                              </div>
                              <span className="font-black text-xs uppercase leading-tight line-clamp-2 mb-2">{movie.title}</span>
                              <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full">Coming Soon</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feature Highlight Call to Action */}
                    <div className="mx-4 md:mx-12 rounded-[2rem] bg-indigo-600 overflow-hidden relative group">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                        <div className="relative p-12 md:p-20 flex flex-col md:flex-row items-center justify-between gap-12">
                          <div className="space-y-6 max-w-xl text-center md:text-left">
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">Ready to <br/> Analyze?</h2>
                            <p className="text-xl text-indigo-100 font-medium">Drop your footage below to get started with frame-by-frame annotation and automated scene detection.</p>
                            <button 
                              onClick={() => setIsDragging(true)}
                              className="bg-black text-white px-10 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl active:scale-95"
                            >
                              Initialize Studio
                            </button>
                          </div>
                          <div className="relative w-full max-w-md aspect-video rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(255,255,255,0.2)] bg-black/20 backdrop-blur-3xl border border-white/10 p-4">
                             <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                               <Upload size={48} className="text-white/40 animate-bounce" />
                             </div>
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                  <div className="w-full flex flex-col md:flex-row h-full md:h-[calc(100vh-100px)] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                      {/* Main Calendar Area */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32 md:pb-20">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                              <div>
                                <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight">Cine-Planner</h2>
                                <p className="text-gray-500 font-bold text-[10px] md:text-sm mt-0.5 md:mt-1">Orchestrate your cinematic journey.</p>
                              </div>
                              <div className="flex items-center gap-2 md:gap-4 bg-[#121212] border border-white/10 rounded-full px-3 py-1.5 md:px-4 md:py-2">
                                  <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="hover:bg-white/10 p-1 rounded-full bg-transparent border-none text-white"><ChevronLeft size={16}/></button>
                                  <span className="font-bold w-32 md:w-40 text-center uppercase tracking-widest text-[10px] md:text-xs">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                  <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="hover:bg-white/10 p-1 rounded-full bg-transparent border-none text-white"><ChevronRight size={16}/></button>
                              </div>
                          </div>
                          
                          {isPlannerLoading && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-black/50 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
                                  <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                  <p className="text-xs font-black text-white uppercase tracking-widest">Syncing with Supabase...</p>
                              </div>
                          )}
                          
                          <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-xl">
                              {['S','M','T','W','T','F','S'].map((d, idx) => (
                                  <div key={`${d}-${idx}`} className="bg-[#0a0a0a] py-3 text-[10px] md:text-xs font-black text-gray-600 text-center uppercase tracking-[0.2em]">{d}</div>
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
                                    className={`bg-[#0e0e0e]/50 min-h-[80px] md:h-[160px] p-1 md:p-4 hover:bg-[#151515] transition-all relative group flex flex-col border-[0.5px] border-white/5 ${day && new Date().getDate() === day.day && new Date().getMonth() === currentDate.getMonth() ? 'bg-indigo-500/5' : ''}`}
                                  >
                                      {day ? (
                                          <>
                                              <div className="flex justify-between items-start mb-4">
                                                  <div className={`text-[10px] md:text-sm font-black transition-colors ${new Date().getDate() === day.day && new Date().getMonth() === currentDate.getMonth() ? 'text-indigo-400 scale-125' : 'text-gray-500'}`}>{day.day}</div>
                                                  <button onClick={() => setIsAddingPlan(day.timestamp)} className="md:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-all bg-white/5 p-1 rounded-md hover:scale-110"><Plus size={14} /></button>
                                              </div>
                                                <div className="flex-1 relative flex items-center justify-center min-h-[40px] md:min-h-[100px] mt-1 md:mt-2 group-hover:scale-105 transition-transform duration-500">
                                                   {/* Stacked Posters */}
                                                   {day.plans.length === 0 && day.movies.length === 0 && (
                                                       <div className="absolute inset-x-4 inset-y-8 rounded-xl border border-dashed border-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                           <Film size={16} className="text-gray-700" />
                                                       </div>
                                                   )}
                                                   
                                                   {/* We combine plans and watched movies into one visual stack? 
                                                       Let's focus on plans as posters, and movies as small badges or posters too. */}
                                                   {[...day.plans.map(p => ({...p, type: 'plan'})), ...day.movies.map(m => ({title: m, type: 'watched', posterPath: storyboards.find(s => s.filename === m)?.notes.find(n => n.thumbnail)?.thumbnail}))]
                                                    .slice(0, 4).reverse().map((item, idx, arr) => {
                                                       const reverseIdx = arr.length - 1 - idx;
                                                       return (
                                                           <div 
                                                               key={idx} 
                                                               className="absolute transition-all duration-500 ease-out"
                                                               style={{ 
                                                                   zIndex: idx, 
                                                                   transform: `translateY(${reverseIdx * -12}px) scale(${1 - reverseIdx * 0.08})`,
                                                                   opacity: 1 - (reverseIdx * 0.2),
                                                                   filter: `blur(${reverseIdx * 0.5}px)`
                                                               }}
                                                           >
                                                               <div className={`relative w-12 h-16 md:w-20 md:h-28 rounded-lg md:rounded-xl overflow-hidden shadow-2xl border ${item.type === 'watched' ? 'border-green-500/50 grayscale-[0.5]' : 'border-white/10'}`}>
                                                                   {item.posterPath ? (
                                                                       <img src={item.posterPath} alt="" className="w-full h-full object-cover" />
                                                                   ) : (
                                                                       <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                                                                           <Film size={20} className="text-gray-700" />
                                                                       </div>
                                                                   )}
                                                                   {/* Small status indicator in the corner */}
                                                                   <div className="absolute top-1 right-1">
                                                                       {item.type === 'watched' ? (
                                                                           <div className="p-0.5 bg-green-500 rounded-full shadow-lg">
                                                                               <CheckCircle2 size={8} className="text-black" />
                                                                           </div>
                                                                       ) : (
                                                                           <div className="p-0.5 bg-indigo-500 rounded-full shadow-lg">
                                                                               <Plus size={8} className="text-white" />
                                                                           </div>
                                                                       )}
                                                                   </div>
                                                                   
                                                                   {/* Overlay on hover of the WHOLE cell */}
                                                                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                                                                        <span className="text-[8px] font-black uppercase leading-tight line-clamp-2">{item.title}</span>
                                                                        {item.type === 'plan' && (
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); deletePlannerEntry((item as any).id); setPlannerEntries(prev => prev.filter(p => p.id !== (item as any).id)); }}
                                                                                className="mt-2 p-1 text-red-400 hover:text-red-300 transition-colors"
                                                                            >
                                                                                <Trash2 size={10} />
                                                                            </button>
                                                                        )}
                                                                   </div>
                                                               </div>
                                                           </div>
                                                       );
                                                   })}
                                                   
                                                   {day.plans.length + day.movies.length > 4 && (
                                                       <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-xl z-[50] border border-white/20">
                                                           +{day.plans.length + day.movies.length - 4}
                                                       </div>
                                                   )}
                                               </div>
                                              {isAddingPlan === day.timestamp && (
                                                  <div className="absolute inset-x-2 top-2 bottom-2 bg-[#1a1a1a] z-50 p-4 flex flex-col justify-center animate-in slide-in-from-top-4 duration-300 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                                                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">New Entry</h4>
                                                      <input autoFocus type="text" placeholder="Movie title..." className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white mb-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
                                                      <select className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs text-white mb-4 focus:outline-none appearance-none cursor-pointer font-bold" value={planPlatform} onChange={(e) => setPlanPlatform(e.target.value)}>
                                                          <option value="Theater">Theater</option><option value="Netflix">Netflix</option><option value="Streaming">Streaming</option><option value="BluRay">BluRay</option>
                                                      </select>
                                                      <div className="flex gap-2">
                                                          <button onClick={() => addPlannerEntry(day.timestamp)} className="flex-1 bg-white text-black hover:bg-gray-200 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all active:scale-95 tracking-widest">Add</button>
                                                          <button onClick={() => setIsAddingPlan(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-500 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all tracking-widest">Exit</button>
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
                                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
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
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-700" 
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
                                      className="group bg-white/5 border border-white/5 rounded-[1.5rem] p-4 hover:bg-[#111] hover:border-indigo-500/30 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden flex gap-4"
                                    >
                                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                      
                                      {/* Poster Image */}
                                      <div className="relative w-20 h-28 flex-shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/10 group-hover:border-indigo-500/30 transition-all">
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
                                                 className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 group-hover:text-indigo-400 transition-colors bg-white/5 px-2 py-1 rounded hover:bg-white/10"
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
                                          className="flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
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
                <div className="w-full px-8 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <h2 className="text-3xl font-black mb-8 uppercase tracking-tight">Studio Analytics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 flex items-center gap-4 shadow-xl"><div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400"><Layers size={24}/></div><div><div className="text-2xl font-black text-white">{totalFrames}</div><div className="text-xs text-gray-500 font-bold uppercase">Total Frames Logged</div></div></div>
                        <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 flex items-center gap-4 shadow-xl"><div className="p-3 bg-green-500/20 rounded-xl text-green-400"><Film size={24}/></div><div><div className="text-2xl font-black text-white">{storyboards.length}</div><div className="text-xs text-gray-500 font-bold uppercase">Active Projects</div></div></div>
                        <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 flex items-center gap-4 shadow-xl"><div className="p-3 bg-pink-500/20 rounded-xl text-pink-400"><Clock size={24}/></div><div><div className="text-2xl font-black text-white">{Math.round(activityLogs.reduce((acc, l) => acc + l.durationPlayed, 0) / 60)}m</div><div className="text-xs text-gray-500 font-bold uppercase">Total Study Time</div></div></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl">
                             <div className="flex items-center gap-3 mb-6"><Activity className="text-gray-400" size={20} /><h3 className="text-xl font-black text-gray-200 uppercase tracking-wide">14-Day Activity (Minutes)</h3></div>
                            <div className="h-64 flex items-end gap-2 border-b border-white/10 pb-4">
                                {dailyActivity.map((day, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                                        <div className="w-full bg-indigo-600/40 hover:bg-indigo-500 rounded-t-sm transition-all" style={{ height: `${Math.max(5, Math.min(100, (day.minutes / 120) * 100))}%` }}></div>
                                        <div className="text-[10px] font-bold text-gray-600 truncate w-full text-center">{day.date.split(',')[0]}</div>
                                        <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 text-[10px] bg-white text-black px-1 rounded font-bold">{day.minutes}m</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl">
                             <div className="flex items-center gap-3 mb-6"><Clock className="text-gray-400" size={20} /><h3 className="text-xl font-black text-gray-200 uppercase tracking-wide">Study Habits (Time of Day)</h3></div>
                            <div className="h-64 flex items-end gap-1 pb-4">
                                {watchPatterns.map((val, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                        <div className="w-full bg-white/10 hover:bg-white/30 rounded-t-sm transition-all" style={{ height: `${Math.max(2, val)}%` }}></div>
                                        {idx % 3 === 0 && <div className="text-[9px] font-bold text-gray-600 mt-1">{idx}:00</div>}
                                    </div>
                                ))}
                            </div>
                            <div className="text-center text-xs text-gray-500 font-bold mt-2">Hour of Day (0-24)</div>
                        </div>
                    </div>
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="w-full px-8 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tight">Movie Insights</h2>
                            <p className="text-gray-500 font-bold text-sm mt-1">Deep analysis of your cinematic library.</p>
                        </div>
                        <div className="relative">
                            <select 
                                className="bg-[#121212] border border-white/10 text-white text-xs font-black py-2 px-4 rounded-full focus:outline-none uppercase tracking-widest appearance-none pr-10 cursor-pointer hover:border-white/20 transition-all" 
                                onChange={(e) => setSelectedAnalysisMovie(e.target.value)} 
                                value={selectedAnalysisMovie || ""}
                            >
                                <option value="" disabled>Select Movie for Analysis</option>
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
                                <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-xl">
                                    <div className="flex items-center gap-3 mb-6 font-black text-gray-400 uppercase text-xs tracking-widest"><FileVideo size={16}/> Overview</div>
                                    <div className="space-y-4">
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-wider">Analysis Notes</div>
                                            <div className="text-3xl font-black text-white">{selectedMovieData.notes.length}</div>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-wider">Identified Scenes</div>
                                            <div className="text-3xl font-black text-white">{selectedMovieData.segments?.length || 0}</div>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-wider">Total Duration</div>
                                            <div className="text-3xl font-black text-white">{Math.floor((selectedMovieData.duration || 0) / 60)}m {Math.floor((selectedMovieData.duration || 0) % 60)}s</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-2 space-y-8">
                                <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl">
                                    <div className="flex items-center gap-3 mb-6 font-black text-gray-400 uppercase text-xs tracking-widest"><Layers size={16}/> Structural Composition</div>
                                    <div className="space-y-6">
                                        {movieGenreData.length > 0 ? (
                                            <div className="space-y-5">
                                                {movieGenreData.map((genre) => (
                                                    <div key={genre.name} className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <div className="text-[10px] font-black uppercase text-gray-300 tracking-wider font-mono">{genre.name}</div>
                                                            <div className="text-[10px] font-black text-gray-500">{Math.round((genre.value / (selectedMovieData.duration || 1)) * 100)}%</div>
                                                        </div>
                                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full ${getSceneColor(genre.name)} shadow-[0_0_10px_rgba(255,255,255,0.1)]`} 
                                                                style={{ width: `${(genre.value / (selectedMovieData.duration || 1)) * 100}%` }}
                                                            ></div>
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

                                {selectedMovieData.heatmap && (
                                    <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl">
                                        <div className="flex items-center gap-3 mb-6 font-black text-gray-400 uppercase text-xs tracking-widest"><Activity size={16}/> Attention Heatmap</div>
                                        <div className="h-32 flex items-end gap-[1px]">
                                            {selectedMovieData.heatmap.map((val, i) => (
                                                <div 
                                                    key={i} 
                                                    className={`flex-1 transition-all rounded-t-sm ${val === 0 ? 'bg-white/5' : 'bg-indigo-500 hover:bg-indigo-400'}`} 
                                                    style={{ height: `${Math.max(4, Math.min(100, val * 10))}%` }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex justify-between text-[9px] text-gray-600 mt-4 font-black tracking-widest uppercase">
                                            <span>Start</span>
                                            <span className="text-indigo-500/50">Engagement Intensity</span>
                                            <span>End</span>
                                        </div>
                                    </div>
                                )}
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



              {activeTab === 'movies' && (
                  <div className="w-full px-8 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20">
                      <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-black uppercase tracking-tight">Media Library</h2>
                        <div className="flex gap-2"><button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><CalendarIcon size={18} /></button><button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"><Star size={18} /></button></div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                          {storyboards.map(movie => {
                              const poster = movie.notes.find(n => n.thumbnail)?.thumbnail;
                              return (
                                  <div key={movie.filename} onClick={() => setPlayingStoryboard(movie)} className="group relative bg-[#121212] rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all hover:shadow-2xl hover:-translate-y-1 cursor-pointer">
                                      <div className="aspect-[2/3] bg-black relative">
                                          {poster ? <img src={poster} alt={movie.filename} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> : <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-700"><Clapperboard size={40} /></div>}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30"><MonitorPlay size={24} fill="white" /></div></div>
                                      </div>
                                      <div className="p-4">
                                          <h3 className="font-black text-white truncate mb-1 uppercase tracking-wide" title={movie.filename}>
                                            {formatMovieName(movie.filename)}
                                          </h3>
                                          <div className="flex items-center justify-between text-xs text-gray-500 font-bold"><span>{new Date(movie.lastModified).getFullYear()}</span><div className="flex items-center gap-1"><Layers size={12} /> {movie.notes.length}</div></div>
                                      </div>
                                  </div>
                              )
                          })}
                          {storyboards.length === 0 && (
                            <div className="col-span-full py-20 text-center text-gray-500 flex flex-col items-center">
                                <Clapperboard size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-medium mb-6">No movies in library.</p>
                                
                                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 max-w-md w-full">
                                    <h3 className="text-white font-bold mb-2">Missing your data?</h3>
                                    <p className="text-sm text-gray-400 mb-4">You switched to Cloud Storage. Your previous work is saved locally on this device.</p>
                                    <button 
                                        onClick={handleMigration} 
                                        disabled={isMigrating}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 mx-auto shadow-lg shadow-indigo-500/20"
                                    >
                                        {isMigrating ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Migrating...</> : <><Database size={14} /> Migrate Local Data to Cloud</>}
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
                       className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all transform hover:rotate-90"
                    >
                        <XCircle size={32} />
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
                                        accept="video/*" 
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
