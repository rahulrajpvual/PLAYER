
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Interface Adapters ---

// Helper: Convert Data URI to Blob
const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

const uploadImage = async (dataURI: string, filename: string): Promise<string | null> => {
    try {
        const blob = dataURItoBlob(dataURI);
        const path = `thumbnails/${filename}/${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
            .from('media')
            .upload(path, blob, { contentType: blob.type, upsert: true });
            
        if (error) {
            console.error("Storage Upload Error", error);
            return null;
        }
        
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
        return publicUrl;
    } catch (e) {
        console.error("Upload Exception", e);
        return null;
    }
};

export const saveToCloud = async (collection: string, data: any) => {
  try {
    // collection mapping, same as before
    let table = collection;
    
    if (collection.startsWith('notes_')) table = 'notes';
    else if (collection.startsWith('segments_')) table = 'scene_segments';
    
    const payload = { ...data };
    
    // Extract filename if missing
    if (collection.includes('_') && !payload.filename) {
         if (collection.startsWith('notes_')) payload.filename = collection.replace('notes_', '');
         if (collection.startsWith('segments_')) payload.filename = collection.replace('segments_', '');
    }

    // --- Image Upload Logic ---
    // If payload has a thumbnail and it's a Data URL (starts with data:image), upload it
    if (payload.thumbnail && payload.thumbnail.startsWith('data:image')) {
        const publicUrl = await uploadImage(payload.thumbnail, payload.filename || 'unknown');
        if (publicUrl) {
            payload.thumbnail = publicUrl;
        } else {
            // If upload fails, maybe strip it to avoid DB error if text too long? 
            // Or keep it and hope for the best (likely fail).
            // Let's warn.
            console.warn("Failed to upload image, attempting to save base64 (might fail)");
        }
    }

    // Adapt payload for DB
    const dbPayload: any = {};
    if (table === 'scene_segments') {
        dbPayload.id = payload.id;
        dbPayload.filename = payload.filename;
        dbPayload.start_time = payload.startTime;
        dbPayload.end_time = payload.endTime;
        dbPayload.type = payload.type;
        dbPayload.rating = payload.rating;
        dbPayload.description = payload.description;
    } else if (table === 'activity_logs') {
        dbPayload.id = payload.id;
        dbPayload.filename = payload.filename;
        dbPayload.date = payload.date;
        dbPayload.duration_played = payload.durationPlayed;
    } else {
        // notes
        Object.assign(dbPayload, payload);
    }
    
    const { error } = await supabase.from(table).upsert(dbPayload);
    
    if (error) {
        console.error("Supabase Save Error", error, payload);
        return false;
    }
    return true;
  } catch (e) {
    console.error("Supabase Save Exception", e);
    return false;
  }
};

export const loadFromCloud = async (collection: string, queryField?: string, queryValue?: string) => {
  try {
    let table = collection;
    let filenameFilter = queryValue;

    // Handle extraction if not passed explicitly but embedded in collection name
    if (collection.startsWith('notes_')) {
        table = 'notes';
        filenameFilter = collection.replace('notes_', '');
    } else if (collection.startsWith('segments_')) {
        table = 'scene_segments';
        filenameFilter = collection.replace('segments_', '');
    }

    let query = supabase.from(table).select('*');
    
    if (filenameFilter && (table === 'notes' || table === 'scene_segments')) {
        query = query.eq('filename', filenameFilter);
    } else if (queryField && queryValue) {
        // Fallback for generic usage
        // Map camelCase fields to snake_case if needed
        let dbField = queryField;
        if(queryField === 'durationPlayed') dbField = 'duration_played';
        query = query.eq(dbField, queryValue);
    }

    const { data, error } = await query;
    
    if (error) {
        console.error("Supabase Load Error", error);
        return [];
    }
    
    // Transform back to JS CamelCase
    if (table === 'scene_segments') {
        return data.map((item: any) => ({
            id: item.id,
            filename: item.filename,
            startTime: item.start_time,
            endTime: item.end_time,
            type: item.type,
            rating: item.rating,
            description: item.description
        }));
    } else if (table === 'activity_logs') {
        return data.map((item: any) => ({
             id: item.id,
             filename: item.filename,
             date: item.date,
             durationPlayed: item.duration_played
        }));
    } else if (table === 'planner_entries') {
        return data.map((item: any) => ({
            id: item.id,
            movieId: item.movie_id,
            title: item.title,
            year: item.year,
            rating: item.rating,
            posterPath: item.poster_path,
            overview: item.overview,
            status: item.status,
            platform: item.platform,
            date: Number(item.date)
        }));
    }

    return data || [];
  } catch (e) {
    console.error("Supabase Load Exception", e);
    return [];
  }
};

export const fetchAllStoryboards = async (): Promise<any[]> => {
    try {
        const { data: notes, error: notesError } = await supabase.from('notes').select('*');
        const { data: segments, error: segmentsError } = await supabase.from('scene_segments').select('*');
        
        if (notesError || segmentsError) {
            console.error("Error fetching storyboards", notesError, segmentsError);
            return [];
        }
        
        // Group by filename
        const map: Record<string, any> = {};
        
        notes?.forEach((n: any) => {
            if (!map[n.filename]) {
                map[n.filename] = { 
                    filename: n.filename, 
                    notes: [], 
                    segments: [], 
                    lastModified: 0,
                    folder: undefined, // Folder map is still local for now?
                    duration: 0, 
                    heatmap: undefined 
                };
            }
            map[n.filename].notes.push(n);
            if (n.timestamp > map[n.filename].lastModified) map[n.filename].lastModified = n.timestamp;
            // Map db fields to Note interface if needed, but 'loadFromCloud' does it? 
            // We should duplicate the mapping logic or reuse it.
            // Note: 'n' here is raw DB shape.
            // DB: text, tags, thumbnail, drawing, timestamp, id
            // JS Note: Same.
        });

        segments?.forEach((s: any) => {
             if (!map[s.filename]) {
                map[s.filename] = { 
                    filename: s.filename, 
                    notes: [], 
                    segments: [], 
                    lastModified: 0,
                    duration: 0
                };
            }
            const seg = {
                id: s.id,
                startTime: s.start_time,
                endTime: s.end_time,
                type: s.type,
                rating: s.rating,
                description: s.description
            };
            map[s.filename].segments.push(seg);
            // Updating lastModified based on segment creation isn't easy as we don't store created_at in JS object usually, 
            // but DB has created_at. We can use that if we fetched it.
        });
        
        return Object.values(map);
    } catch(e) {
        console.error("Fetch All Storyboards Exception", e);
        return [];
    }
};

export const deleteStoryboard = async (filename: string) => {
    try {
        const { error: notesError } = await supabase.from('notes').delete().eq('filename', filename);
        const { error: segmentsError } = await supabase.from('scene_segments').delete().eq('filename', filename);
        
        if (notesError || segmentsError) {
            console.error("Error deleting storyboard", notesError, segmentsError);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Delete Storyboard Exception", e);
        return false;
    }
};

export const savePlannerEntry = async (entry: any) => {
    try {
        const dbPayload = {
            id: entry.id,
            movie_id: entry.movieId || entry.id,
            title: entry.title,
            year: entry.year,
            rating: entry.rating,
            poster_path: entry.poster_path || entry.posterPath,
            overview: entry.overview,
            status: entry.status,
            platform: entry.platform,
            date: entry.date
        };
        
        const { error } = await supabase.from('planner_entries').upsert(dbPayload);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Save Planner Entry Error", e);
        return false;
    }
};

export const deletePlannerEntry = async (id: string) => {
    try {
        const { error } = await supabase.from('planner_entries').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Delete Planner Entry Error", e);
        return false;
    }
};

export const loadPlannerEntries = async () => {
    try {
        const { data, error } = await supabase.from('planner_entries').select('*');
        if (error) throw error;
        return data.map((item: any) => ({
            id: item.id,
            movieId: item.movie_id,
            title: item.title,
            year: item.year,
            rating: item.rating,
            posterPath: item.poster_path,
            overview: item.overview,
            status: item.status,
            platform: item.platform,
            date: Number(item.date)
        }));
    } catch (e) {
        console.error("Load Planner Entries Error", e);
        return [];
    }
};

export const saveStoryIdea = async (idea: any) => {
    try {
        const dbPayload = {
            id: idea.id,
            title: idea.title,
            description: idea.description,
            tags: idea.tags,
            created_at: idea.createdAt
        };
        const { error } = await supabase.from('story_ideas').upsert(dbPayload);
        
        if (error) {
            // Quietly fallback
            const localIdeas = JSON.parse(localStorage.getItem('lumina_story_ideas_fallback') || '[]');
            const updated = [idea, ...localIdeas.filter((i: any) => i.id !== idea.id)];
            localStorage.setItem('lumina_story_ideas_fallback', JSON.stringify(updated));
            return true;
        }
        return true;
    } catch (e) {
        console.error("Save Story Idea Error", e);
        return false;
    }
};

export const deleteStoryIdea = async (id: string) => {
    try {
        const { error } = await supabase.from('story_ideas').delete().eq('id', id);
        
        // Always try to delete from local as well in case we're in fallback mode
        const localIdeas = JSON.parse(localStorage.getItem('lumina_story_ideas_fallback') || '[]');
        localStorage.setItem('lumina_story_ideas_fallback', JSON.stringify(localIdeas.filter((i: any) => i.id !== id)));

        if (error) {
            return true; 
        }
        return true;
    } catch (e) {
        console.error("Delete Story Idea Error", e);
        return false;
    }
};

export const loadStoryIdeas = async () => {
    try {
        const { data, error } = await supabase.from('story_ideas').select('*').order('created_at', { ascending: false });
        
        const localIdeas = JSON.parse(localStorage.getItem('lumina_story_ideas_fallback') || '[]');

        if (error) {
            // Silently fallback to local mode if table is missing (common with new setups)
            return localIdeas;
        }

        const dbIdeas = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            tags: item.tags || [],
            createdAt: Number(item.created_at)
        }));

        // Merge local and DB (DB takes priority)
        const combined = [...dbIdeas];
        localIdeas.forEach((li: any) => {
            if (!combined.find(ci => ci.id === li.id)) combined.push(li);
        });

        return combined;
    } catch (e) {
        console.error("Load Story Ideas Error", e);
        return JSON.parse(localStorage.getItem('lumina_story_ideas_fallback') || '[]');
    }
};
