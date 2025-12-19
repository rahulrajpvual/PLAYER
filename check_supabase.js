
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing ENV variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking Supabase Data...");
  
  const { count: notesCount, error: notesError } = await supabase.from('notes').select('*', { count: 'exact', head: true });
  if (notesError) console.error("Notes Error:", notesError);
  else console.log(`Notes Count: ${notesCount}`);

  const { count: segmentsCount, error: segmentsError } = await supabase.from('scene_segments').select('*', { count: 'exact', head: true });
  if (segmentsError) console.error("Segments Error:", segmentsError);
  else console.log(`Segments Count: ${segmentsCount}`);
  
  const { data, error } = await supabase.from('notes').select('filename').limit(5);
  if (data) console.log("Sample filenames:", data.map(d => d.filename));
}

check();
