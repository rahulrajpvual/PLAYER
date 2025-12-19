import React, { useState, useMemo } from 'react';
import { X, Clock, Layers, Calendar, Image as ImageIcon, Map, Shield, Edit2, Check, X as CloseIcon, Type, BarChart3, List, ChevronRight, Hash, Star, TrendingUp, Search, BookOpen } from 'lucide-react';
import { StoredStoryboard, Note, SceneType } from '../types';

interface StoryboardReviewProps {
  storyboard: StoredStoryboard;
  onUpdateNote: (filename: string, noteId: string, text: string) => void;
  onClose: () => void;
}

const formatTimecode = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const formatMovieName = (filename: string): string => {
    try {
      const name = filename.replace(/\.[^/.]+$/, "");
      const match = name.match(/^(.*?)(?:[\.\s\(]?)((?:19|20)\d{2})(?:[\.\s\)]|$)/);
      if (match) {
        const title = match[1].replace(/\./g, " ").replace(/_/g, " ").trim();
        const year = match[2];
        if (title) return `${title} | ${year}`;
      }
      return name.replace(/\./g, " ").replace(/_/g, " ");
    } catch (e) { return filename; }
};

const StoryboardReview: React.FC<StoryboardReviewProps> = ({ storyboard, onUpdateNote, onClose }) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'analysis'>('journal');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditText(note.text);
  };

  const handleSave = (noteId: string) => {
    onUpdateNote(storyboard.filename, noteId, editText);
    setEditingNoteId(null);
  };

  const filteredNotes = useMemo(() => {
      return storyboard.notes.filter(n => 
          n.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
          n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  }, [storyboard.notes, searchQuery]);

  const tagStats = useMemo(() => {
    const stats: Record<string, number> = {};
    storyboard.notes.forEach(n => {
        n.tags.forEach(t => {
            stats[t] = (stats[t] || 0) + 1;
        });
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [storyboard.notes]);

  const sceneStats = useMemo(() => {
      const stats: Record<string, number> = {};
      storyboard.segments?.forEach(s => {
          stats[s.type] = (stats[s.type] || 0) + 1;
      });
      return Object.entries(stats).sort((a,b) => b[1] - a[1]);
  }, [storyboard.segments]);

  return (
    <div className="fixed inset-0 bg-[#050505] text-white z-[100] flex animate-in fade-in duration-500 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* --- Left Sidebar: Contents --- */}
      <aside className="w-80 border-r border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col hidden lg:flex z-50">
        <div className="p-8 border-b border-white/5">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <List size={16} className="text-indigo-400" />
                </div>
                <span className="text-xs font-black tracking-[0.2em] uppercase text-gray-400">Contents</span>
            </div>
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
            {filteredNotes.map((note, idx) => (
                <button 
                    key={note.id}
                    onClick={() => {
                        setActiveTab('journal');
                        document.getElementById(`entry-${note.id}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full group p-3 rounded-xl hover:bg-white/5 transition-all text-left border border-transparent hover:border-white/5"
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">#{storyboard.notes.length - idx}</span>
                        <span className="text-[10px] font-bold text-gray-600 tracking-tighter">{formatTimecode(note.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium line-clamp-2 leading-relaxed group-hover:text-white transition-colors">
                        {note.text || "Unlabeled capture..."}
                    </p>
                </button>
            ))}
            {filteredNotes.length === 0 && (
                <div className="p-8 text-center text-gray-600 text-[10px] font-black tracking-widest uppercase">No results found</div>
            )}
        </nav>

        <div className="p-6 border-t border-white/5 bg-indigo-500/5">
            <div className="flex items-center gap-3 text-indigo-400 mb-2">
                <Shield size={12} />
                <span className="text-[10px] font-black tracking-widest uppercase">Verified Reel</span>
            </div>
            <p className="text-[9px] text-gray-500 font-bold leading-relaxed">
                Metadata synced with cinematic analysis engine v2.4.0
            </p>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col relative">
          
          {/* Background Decals */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
          </div>

          {/* Header */}
          <header className="w-full p-8 border-b border-white/5 flex items-center justify-between backdrop-blur-3xl bg-black/40 z-50">
            <div className="flex items-center gap-8">
              <button 
                onClick={onClose}
                className="p-4 bg-white/5 hover:bg-white text-white hover:text-black rounded-full transition-all active:scale-90 group border border-white/10"
              >
                <CloseIcon size={24} strokeWidth={3} />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className="bg-indigo-600 px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase">Cinematic Archive</span>
                    <span className="text-gray-500 font-bold text-[10px] tracking-widest uppercase">Ref: {storyboard.filename.slice(0, 8)}</span>
                </div>
                <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">{formatMovieName(storyboard.filename)}</h1>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                <button 
                    onClick={() => setActiveTab('journal')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'journal' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'text-gray-500 hover:text-white'}`}
                >
                    <BookOpen size={16} /> Journal
                </button>
                <button 
                    onClick={() => setActiveTab('analysis')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'text-gray-500 hover:text-white'}`}
                >
                    <BarChart3 size={16} /> Analysis
                </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 scroll-smooth">
              <div className="max-w-4xl mx-auto py-20 px-6">
                
                {activeTab === 'journal' ? (
                    /* --- Journal View --- */
                    <section className="relative space-y-32">
                        <div className="absolute left-[-40px] top-0 bottom-0 w-[1px] bg-white/10 hidden lg:block"></div>
                        
                        {storyboard.notes.map((note: Note, index) => (
                        <div key={note.id} id={`entry-${note.id}`} className="relative group/entry scroll-mt-32">
                            {/* Marker */}
                            <div className="absolute left-[-48px] top-4 w-4 h-4 rounded-full bg-[#111] border-2 border-indigo-500 z-10 hidden lg:block shadow-[0_0_15px_rgba(99,102,241,0.3)]"></div>
                            
                            <div className="flex items-center gap-4 mb-8">
                                <h3 className="font-black text-indigo-400 text-xs tracking-widest uppercase">Log Entry #{storyboard.notes.length - index}</h3>
                                <div className="h-[1px] flex-1 bg-white/5"></div>
                                <div className="bg-white/5 px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-black text-white/60 tracking-widest uppercase flex items-center gap-2">
                                    <Clock size={12} className="text-indigo-500" />
                                    {formatTimecode(note.timestamp)}
                                </div>
                            </div>

                            <div className="grid lg:grid-cols-[1.5fr,1fr] gap-12">
                                <div className="bg-[#111] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl group transition-all duration-700 hover:border-indigo-500/40 relative">
                                    <div className="aspect-video bg-black relative">
                                        {note.thumbnail ? (
                                        <img src={note.thumbnail} alt={`Frame at ${note.timestamp}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                        ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-900"><ImageIcon size={64}/></div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col py-2">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Type size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Observation</span>
                                    </div>
                                    
                                    {editingNoteId === note.id ? (
                                        <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
                                            <textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                autoFocus
                                                className="flex-1 bg-indigo-500/5 border border-indigo-500/30 rounded-2xl p-6 text-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-serif leading-relaxed italic"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSave(note.id)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"><Check size={16} /> Save</button>
                                                <button onClick={() => setEditingNoteId(null)} className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-black uppercase text-xs">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div onClick={() => startEditing(note)} className="group/text flex-1 flex flex-col group cursor-pointer">
                                            <p className="text-2xl font-serif text-gray-300 leading-relaxed italic mb-8 group-hover/text:text-white transition-colors capitalize">
                                                "{note.text || 'Untitled cinematic capture...'}"
                                            </p>
                                            <div className="mt-auto flex items-center justify-between">
                                                <div className="flex flex-wrap gap-2">
                                                    {note.tags?.map(tag => (
                                                        <span key={tag} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase text-indigo-400">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <Edit2 size={12} className="opacity-0 group-hover/text:opacity-100 transition-opacity text-indigo-400" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        ))}
                    </section>
                ) : (
                    /* --- Analysis View --- */
                    <section className="space-y-16 animate-in slide-in-from-bottom-4 duration-700">
                        {/* Heatmap Spotlight */}
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-8 font-black text-gray-400 uppercase text-xs tracking-[0.3em]">
                                <Map size={16} className="text-indigo-500" /> Engagement Spotlight
                            </div>
                            <div className="bg-[#111]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-12 shadow-2xl relative group overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5"></div>
                                <div className="h-56 flex items-end gap-[2px] relative z-10">
                                    {storyboard.heatmap?.map((val, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex-1 transition-all rounded-t-lg ${val === 0 ? 'bg-white/5' : 'bg-indigo-500 hover:bg-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]'}`} 
                                        style={{ height: `${Math.max(6, Math.min(100, val * 10))}%` }}
                                    />
                                    ))}
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500 mt-10 font-black tracking-widest uppercase relative z-10 border-t border-white/5 pt-8">
                                    <span className="flex items-center gap-3"><Clock size={12} /> Opening Sequence</span>
                                    <span className="text-indigo-400">Peak Viewer Retention</span>
                                    <span className="flex items-center gap-3">Closing Credits <Clock size={12} /></span>
                                </div>
                            </div>
                        </div>

                        {/* Distribution Grid */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Scene Tags Distribution */}
                            <div className="bg-[#111]/60 border border-white/5 rounded-[2rem] p-10 flex flex-col">
                                <div className="flex items-center gap-3 mb-8">
                                    <Hash size={16} className="text-indigo-500" />
                                    <h4 className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Analysis Tags Distribution</h4>
                                </div>
                                <div className="space-y-6 flex-1">
                                    {tagStats.slice(0, 6).map(([tag, count]) => (
                                        <div key={tag} className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                                                <span className="text-gray-300">{tag}</span>
                                                <span className="text-indigo-400">{count} Captures</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-indigo-500 rounded-full" 
                                                    style={{ width: `${(count / storyboard.notes.length) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {tagStats.length === 0 && <div className="text-center py-12 text-gray-600 font-bold uppercase text-[10px] tracking-widest">No tags captured</div>}
                                </div>
                            </div>

                            {/* Scene Type Intensity */}
                            <div className="bg-[#111]/60 border border-white/5 rounded-[2rem] p-10 flex flex-col">
                                <div className="flex items-center gap-3 mb-8">
                                    <Star size={16} className="text-indigo-500" />
                                    <h4 className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Scene Dynamics</h4>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {sceneStats.map(([type, count]) => (
                                        <div key={type} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                                <span className="text-xs font-black uppercase tracking-widest text-gray-200">{type}</span>
                                            </div>
                                            <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">{count} Segments</span>
                                        </div>
                                    ))}
                                    {sceneStats.length === 0 && <div className="text-center py-12 text-gray-600 font-bold uppercase text-[10px] tracking-widest">No scenes logged</div>}
                                </div>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Duration', value: `${Math.floor((storyboard.duration || 0)/60)}m`, icon: <Clock /> },
                                { label: 'Avg Density', value: `${(storyboard.notes.length / (storyboard.duration || 1) * 60).toFixed(1)} n/m`, icon: <TrendingUp /> },
                                { label: 'Capture Score', value: `${Math.min(100, storyboard.notes.length * 5)}`, icon: <Star /> },
                                { label: 'Review Count', value: '1', icon: <Hash /> }
                            ].map((stat, i) => (
                                <div key={i} className="bg-white/5 border border-white/5 p-6 rounded-[1.5rem] flex flex-col items-center text-center group hover:border-indigo-500/30 transition-all">
                                    <div className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform">{stat.icon}</div>
                                    <div className="text-2xl font-black tracking-tighter mb-1">{stat.value}</div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
              </div>
          </main>
      </div>

      {/* --- Global Utility: Close --- */}
      <footer className="fixed bottom-8 right-8 z-[60] flex items-center gap-4">
          <div className="bg-black/80 backdrop-blur-3xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl">
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Sync</span>
              </div>
              <div className="h-4 w-[1px] bg-white/10" />
              <button 
                onClick={onClose}
                className="text-[10px] font-black uppercase tracking-widest text-white hover:text-indigo-400 transition-colors"
              >
                Exit Reel
              </button>
          </div>
      </footer>
    </div>
  );
};

export default StoryboardReview;
