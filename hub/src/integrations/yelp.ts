/**
 * JD Agent - Yelp Fusion API Integration
 *
 * Search for businesses and get details including ratings, reviews, and categories.
 * Used for enriching acquisition leads with Yelp business data.
 */

// ============================================
// Types
// ============================================

export interface YelpBusiness {
  id: string;
  alias: string;
  name: string;
  image_url?: string;
  is_closed: boolean;
  url: string;
  review_count: number;
  categories: Array<{
    alias: string;
    title: string;
  }>;
  rating: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  transactions: string[];
  price?: string;
  location: {
    address1?: string;
    address2?: string;
    address3?: string;
    city: string;
    zip_code: string;
    country: string;
    state: string;
    display_address: string[];
  };
  phone: string;
  display_phone: string;
  distance?: number;
}

export interface YelpBusinessDetails extends YelpBusiness {
  photos?: string[];
  hours?: Array<{
    open: Array<{
      is_overnight: boolean;
      start: string;
      end: string;
      day: number;
    }>;
    hours_type: string;
    is_open_now: boolean;
  }>;
  special_hours?: Array<{
    date: string;
    is_closed?: boolean;
    start?: string;
    end?: string;
    is_overnight?: boolean;
  }>;
}

export interface YelpReview {
  id: string;
  url: string;
  text: string;
  rating: number;
  time_created: string;
  user: {
    id: string;
    profile_url: string;
    image_url?: string;
    name: string;
  };
}

export interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
  region?: {
    center: {
      longitude: number;
      latitude: number;
    };
  };
}

export interface YelpEnrichmentResult {
  found: boolean;
  yelpId?: string;
  name?: string;
  rating?: number;
  reviewCount?: number;
  price?: string;
  categories?: string[];
  phone?: string;
  address?: string;
  yelpUrl?: string;
  isClosed?: boolean;
  topReviews?: Array<{
    author: string;
    rating: number;
    text: string;
    date: string;
  }>;
}

// ============================================
// Yelp Fusion API Client
// ============================================

class YelpIntegration {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.yelp.com/v3';

  constructor() {
    this.apiKey = process.env.YELP_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async fetch(endpoint: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Yelp API key not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yelp API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Search for businesses by name and location
   */
  async searchBusinesses(
    term: string,
    location: string = 'Utah',
    limit: number = 5
  ): Promise<YelpBusiness[]> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return [];
    }

    try {
      const params = new URLSearchParams({
        term,
        location,
        limit: limit.toString(),
      });

      const data: YelpSearchResponse = await this.fetch(`/businesses/search?${params}`);
      return data.businesses || [];
    } catch (error) {
      console.error('[Yelp] Search error:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a business
   */
  async getBusinessDetails(businessId: string): Promise<YelpBusinessDetails | null> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return null;
    }

    try {
      return await this.fetch(`/businesses/${businessId}`);
    } catch (error) {
      console.error('[Yelp] Get business details error:', error);
      return null;
    }
  }

  /**
   * Get reviews for a business
   */
  async getReviews(businessId: string): Promise<YelpReview[]> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return [];
    }

    try {
      const data = await this.fetch(`/businesses/${businessId}/reviews`);
      return data.reviews || [];
    } catch (error) {
      console.error('[Yelp] Get reviews error:', error);
      return [];
    }
  }

  /**
   * Search and enrich a business in one call
   * Returns structured data ready for database update
   */
  async enrichBusiness(
    businessName: string,
    location: string = 'Utah'
  ): Promise<YelpEnrichmentResult> {
    const result: YelpEnrichmentResult = { found: false };

    // Search for the business
    const searchResults = await this.searchBusinesses(businessName, location, 3);
    if (searchResults.length === 0) {
      console.log(`[Yelp] No results for "${businessName}"`);
      return result;
    }

    // Find the best match (first result or exact name match)
    const business = searchResults.find(
      (b) => b.name.toLowerCase() === businessName.toLowerCase()
    ) || searchResults[0];

    // Get reviews
    const reviews = await this.getReviews(business.id);

    // Build enrichment result
    result.found = true;
    result.yelpId = business.id;
    result.name = business.name;
    result.rating = business.rating;
    result.reviewCount = business.review_count;
    result.price = business.price;
    result.categories = business.categories.map((c) => c.title);
    result.phone = business.display_phone || business.phone;
    result.address = business.location.display_address.join(', ');
    result.yelpUrl = business.url;
    result.isClosed = business.is_closed;

    // Add top reviews
    if (reviews.length > 0) {
      result.topReviews = reviews.slice(0, 3).map((review) => ({
        author: review.user.name,
        rating: review.rating,
        text: review.text,
        date: review.time_created,
      }));
    }

    return result;
  }

  /**
   * Search for businesses by phone number
   */
  async searchByPhone(phone: string): Promise<YelpBusiness | null> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return null;
    }

    try {
      // Format phone to +1XXXXXXXXXX format
      const formattedPhone = phone.replace(/\D/g, '');
      const fullPhone = formattedPhone.length === 10 ? `+1${formattedPhone}` : `+${formattedPhone}`;

      const data = await this.fetch(`/businesses/search/phone?phone=${fullPhone}`);
      return data.businesses?.[0] || null;
    } catch (error) {
      console.error('[Yelp] Phone search error:', error);
      return null;
    }
  }

  /**
   * Get business categories
   */
  async getCategories(locale: string = 'en_US'): Promise<Array<{ alias: string; title: string }>> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return [];
    }

    try {
      const data = await this.fetch(`/categories?locale=${locale}`);
      return data.categories || [];
    } catch (error) {
      console.error('[Yelp] Get categories error:', error);
      return [];
    }
  }
}

export const yelpIntegration = new YelpIntegration();
