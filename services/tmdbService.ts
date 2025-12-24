import { TopMovie } from '../movieData';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_TOKEN = import.meta.env.VITE_TMDB_API_TOKEN;

const headers = {
  accept: 'application/json',
  Authorization: `Bearer ${TMDB_TOKEN}`
};

interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  poster_path: string;
  overview: string;
  job?: string; // For credits
}

interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string;
}

const mapTMDBToTopMovie = (m: TMDBMovie): TopMovie => ({
  id: `tmdb-${m.id}`,
  title: m.title,
  year: m.release_date ? new Date(m.release_date).getFullYear() : 0,
  rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
  poster_path: m.poster_path ? `${TMDB_IMAGE_BASE_URL}${m.poster_path}` : undefined,
  overview: m.overview,
  category: 'search'
});

export const tmdbService = {
  async searchMovies(query: string, page: number = 1): Promise<{ results: TopMovie[], totalPages: number }> {
    if (!query) return this.getTrendingMovies(page);
    
    try {
      const response = await fetch(`${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=${page}`, { headers });
      const data = await response.json();
      return {
        results: (data.results || []).map(mapTMDBToTopMovie),
        totalPages: data.total_pages || 1
      };
    } catch (error) {
      console.error('TMDB Search Error:', error);
      return { results: [], totalPages: 0 };
    }
  },

  async getTrendingMovies(page: number = 1): Promise<{ results: TopMovie[], totalPages: number }> {
    try {
      const response = await fetch(`${TMDB_BASE_URL}/trending/movie/day?language=en-US&page=${page}`, { headers });
      const data = await response.json();
      return {
        results: (data.results || []).map(mapTMDBToTopMovie),
        totalPages: data.total_pages || 1
      };
    } catch (error) {
      console.error('TMDB Trending Error:', error);
      return { results: [], totalPages: 0 };
    }
  },

  async getNowPlayingMovies(page: number = 1): Promise<{ results: TopMovie[], totalPages: number }> {
    try {
      const response = await fetch(`${TMDB_BASE_URL}/movie/now_playing?language=en-US&page=${page}`, { headers });
      const data = await response.json();
      return {
        results: (data.results || []).map(mapTMDBToTopMovie),
        totalPages: data.total_pages || 1
      };
    } catch (error) {
      console.error('TMDB Now Playing Error:', error);
      return { results: [], totalPages: 0 };
    }
  },

  async searchPerson(query: string): Promise<TMDBPerson[]> {
    try {
      const response = await fetch(`${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`, { headers });
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('TMDB Person Search Error:', error);
      return [];
    }
  },

  async getPersonFilmography(personId: number): Promise<TopMovie[]> {
    try {
      const response = await fetch(`${TMDB_BASE_URL}/person/${personId}/movie_credits?language=en-US`, { headers });
      const data = await response.json();
      
      const directedMovies = (data.crew || [])
        .filter((m: TMDBMovie) => m.job === 'Director')
        .sort((a: TMDBMovie, b: TMDBMovie) => {
          const dateA = a.release_date || '0';
          const dateB = b.release_date || '0';
          return dateB.localeCompare(dateA);
        });

      return directedMovies.map(mapTMDBToTopMovie);
    } catch (error) {
      console.error('TMDB Credits Error:', error);
      return [];
    }
  },

  async getPosterByFilename(filename: string): Promise<TopMovie | null> {
    // Clean filename: remove extension, common scene tags, and replace dots/underscores with spaces
    let cleanName = filename.replace(/\.[^/.]+$/, "") // remove extension
        .replace(/(\.|\_)/g, " ") // replace . or _ with space
        .replace(/\b(1080p|720p|4k|2160p|x264|x265|bluray|web-dl|hdtv|internal|dual-audio|hevc|multi|aac|dts)\b/gi, "") // remove tags
        .replace(/\b(19|20)\d{2}\b/g, "") // remove year (e.g. 2024)
        .replace(/\s+/g, " ") // collapse spaces
        .trim();

    const search = await this.searchMovies(cleanName);
    return search.results[0] || null;
  }
};
