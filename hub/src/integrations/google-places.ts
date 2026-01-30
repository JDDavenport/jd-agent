/**
 * JD Agent - Google Places Integration
 *
 * Search for businesses and get details including ratings, reviews, and contact info.
 * Used for enriching acquisition leads with Google business data.
 */

// ============================================
// Types
// ============================================

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: PlaceReview[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  business_status?: string;
  types?: string[];
  url?: string; // Google Maps URL
  price_level?: number;
}

export interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

export interface GooglePlacesEnrichmentResult {
  found: boolean;
  placeId?: string;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  googleMapsUrl?: string;
  topReviews?: Array<{
    author: string;
    rating: number;
    text: string;
    date: string;
  }>;
}

// ============================================
// Google Places API Client
// ============================================

class GooglePlacesIntegration {
  private apiKey: string | undefined;
  private baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for a business by name and location
   */
  async searchBusiness(
    businessName: string,
    location: string = 'Utah'
  ): Promise<PlaceSearchResult | null> {
    if (!this.apiKey) {
      console.warn('[GooglePlaces] API key not configured');
      return null;
    }

    try {
      const query = encodeURIComponent(`${businessName} ${location}`);
      const url = `${this.baseUrl}/textsearch/json?query=${query}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.log(`[GooglePlaces] No results for "${businessName}": ${data.status}`);
        return null;
      }

      // Return the first (most relevant) result
      return data.results[0] as PlaceSearchResult;
    } catch (error) {
      console.error('[GooglePlaces] Search error:', error);
      return null;
    }
  }

  /**
   * Get detailed information about a place
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    if (!this.apiKey) {
      console.warn('[GooglePlaces] API key not configured');
      return null;
    }

    try {
      const fields = [
        'place_id',
        'name',
        'formatted_address',
        'formatted_phone_number',
        'international_phone_number',
        'website',
        'rating',
        'user_ratings_total',
        'reviews',
        'opening_hours',
        'business_status',
        'types',
        'url',
        'price_level',
      ].join(',');

      const url = `${this.baseUrl}/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.result) {
        console.log(`[GooglePlaces] Failed to get details for ${placeId}: ${data.status}`);
        return null;
      }

      return data.result as PlaceDetails;
    } catch (error) {
      console.error('[GooglePlaces] Details error:', error);
      return null;
    }
  }

  /**
   * Search and enrich a business in one call
   * Returns structured data ready for database update
   */
  async enrichBusiness(
    businessName: string,
    location: string = 'Utah'
  ): Promise<GooglePlacesEnrichmentResult> {
    const result: GooglePlacesEnrichmentResult = { found: false };

    // First, search for the business
    const searchResult = await this.searchBusiness(businessName, location);
    if (!searchResult) {
      return result;
    }

    // Then get detailed information
    const details = await this.getPlaceDetails(searchResult.place_id);
    if (!details) {
      // Return basic info from search if details fail
      return {
        found: true,
        placeId: searchResult.place_id,
        name: searchResult.name,
        address: searchResult.formatted_address,
        rating: searchResult.rating,
        reviewCount: searchResult.user_ratings_total,
        businessStatus: searchResult.business_status,
      };
    }

    // Build enrichment result
    result.found = true;
    result.placeId = details.place_id;
    result.name = details.name;
    result.address = details.formatted_address;
    result.phone = details.formatted_phone_number || details.international_phone_number;
    result.website = details.website;
    result.rating = details.rating;
    result.reviewCount = details.user_ratings_total;
    result.businessStatus = details.business_status;
    result.googleMapsUrl = details.url;

    // Extract top reviews
    if (details.reviews && details.reviews.length > 0) {
      result.topReviews = details.reviews.slice(0, 5).map((review) => ({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        date: review.relative_time_description,
      }));
    }

    return result;
  }

  /**
   * Get nearby businesses of a specific type
   */
  async searchNearby(
    lat: number,
    lng: number,
    type: string,
    radius: number = 5000
  ): Promise<PlaceSearchResult[]> {
    if (!this.apiKey) {
      console.warn('[GooglePlaces] API key not configured');
      return [];
    }

    try {
      const url = `${this.baseUrl}/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results) {
        return [];
      }

      return data.results as PlaceSearchResult[];
    } catch (error) {
      console.error('[GooglePlaces] Nearby search error:', error);
      return [];
    }
  }
}

export const googlePlacesIntegration = new GooglePlacesIntegration();
