// utils/searchHelpers.js
import { Property } from "../models/Property.js";

// Price range helper
export const getPriceRanges = () => {
  return [
    { id: '1', label: 'Under 25 Lakh', min: 0, max: 2500000 },
    { id: '2', label: '25L - 50L', min: 2500000, max: 5000000 },
    { id: '3', label: '50L - 1 Cr', min: 5000000, max: 10000000 },
    { id: '4', label: '1 Cr - 2 Cr', min: 10000000, max: 20000000 },
    { id: '5', label: '2 Cr - 5 Cr', min: 20000000, max: 50000000 },
    { id: '6', label: 'Above 5 Cr', min: 50000000, max: 999999999 }
  ];
};

// Area ranges helper
export const getAreaRanges = () => {
  return [
    { id: '1', label: 'Under 500 sq.ft', min: 0, max: 500 },
    { id: '2', label: '500 - 1000 sq.ft', min: 500, max: 1000 },
    { id: '3', label: '1000 - 1500 sq.ft', min: 1000, max: 1500 },
    { id: '4', label: '1500 - 2000 sq.ft', min: 1500, max: 2000 },
    { id: '5', label: '2000 - 3000 sq.ft', min: 2000, max: 3000 },
    { id: '6', label: 'Above 3000 sq.ft', min: 3000, max: 999999 }
  ];
};

// EMI Calculator
export const calculateEMI = (principal, rate, tenure) => {
  const monthlyRate = rate / (12 * 100);
  const months = tenure * 12;
  
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
              (Math.pow(1 + monthlyRate, months) - 1);
  
  return Math.round(emi);
};

// Reverse EMI calculation (budget to price)
export const calculateMaxPrice = (emi, rate = 8.5, tenure = 20, downPayment = 20) => {
  const monthlyRate = rate / (12 * 100);
  const months = tenure * 12;
  
  const loanAmount = (emi * (Math.pow(1 + monthlyRate, months) - 1)) / 
                     (monthlyRate * Math.pow(1 + monthlyRate, months));
  
  const totalPrice = loanAmount / (1 - downPayment/100);
  
  return Math.round(totalPrice);
};

// Search query builder
export const buildSearchQuery = (params) => {
  const query = {};
  
  // Basic filters
  if (params.city) query['location.city'] = { $regex: params.city, $options: 'i' };
  if (params.area) query['location.area'] = { $regex: params.area, $options: 'i' };
  if (params.propertyType) query.propertyType = params.propertyType;
  if (params.bedrooms) query.bedrooms = parseInt(params.bedrooms);
  if (params.furnishing) query.furnishing = params.furnishing;
  
  // Price range
  if (params.minPrice || params.maxPrice) {
    query.price = {};
    if (params.minPrice) query.price.$gte = parseInt(params.minPrice);
    if (params.maxPrice) query.price.$lte = parseInt(params.maxPrice);
  }
  
  // Area range
  if (params.minArea || params.maxArea) {
    query.areaSqft = {};
    if (params.minArea) query.areaSqft.$gte = parseInt(params.minArea);
    if (params.maxArea) query.areaSqft.$lte = parseInt(params.maxArea);
  }
  
  // Amenities (all must be present)
  if (params.amenities) {
    const amenityList = Array.isArray(params.amenities) ? 
                        params.amenities : params.amenities.split(',');
    query.amenities = { $all: amenityList };
  }
  
  return query;
};

// Sort options
export const getSortOptions = () => {
  return {
    'relevance': { score: -1, createdAt: -1 },
    'price_low': { price: 1 },
    'price_high': { price: -1 },
    'area_large': { areaSqft: -1 },
    'area_small': { areaSqft: 1 },
    'newest': { createdAt: -1 },
    'oldest': { createdAt: 1 },
    'popular': { viewCount: -1, createdAt: -1 },
    'featured': { isFeatured: -1, priority: -1, createdAt: -1 }
  };
};

// Location suggestions based on popularity
export const getPopularLocations = async (limit = 20) => {
  const locations = await Property.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: {
          city: '$location.city',
          area: '$location.area'
        },
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        city: '$_id.city',
        area: '$_id.area',
        propertyCount: '$count',
        priceRange: {
          avg: { $round: '$avgPrice' },
          min: '$minPrice',
          max: '$maxPrice'
        }
      }
    }
  ]);
  
  return locations;
};

// Get trending searches
export const getTrendingSearches = async () => {
  // This would typically come from search analytics
  // For now, returning popular combinations
  const trending = await Property.aggregate([
    { $match: { status: 'active', viewCount: { $gte: 10 } } },
    {
      $group: {
        _id: {
          city: '$location.city',
          propertyType: '$propertyType',
          bedrooms: '$bedrooms'
        },
        searchCount: { $sum: '$viewCount' },
        avgPrice: { $avg: '$price' }
      }
    },
    { $sort: { searchCount: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        searchTerm: {
          $concat: [
            { $toString: '$_id.bedrooms' }, 
            ' BHK ', 
            '$_id.propertyType', 
            ' in ', 
            '$_id.city'
          ]
        },
        popularity: '$searchCount',
        avgPrice: { $round: '$avgPrice' }
      }
    }
  ]);
  
  return trending;
};

// Price prediction based on location and property type
export const getPricePrediction = async (city, propertyType, bedrooms, areaSqft) => {
  const similar = await Property.aggregate([
    {
      $match: {
        status: 'active',
        'location.city': { $regex: city, $options: 'i' },
        propertyType,
        bedrooms,
        areaSqft: { $gte: areaSqft * 0.8, $lte: areaSqft * 1.2 }
      }
    },
    {
      $group: {
        _id: null,
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        count: { $sum: 1 },
        avgPricePerSqft: { $avg: { $divide: ['$price', '$areaSqft'] } }
      }
    }
  ]);
  
  if (similar.length === 0) {
    return {
      prediction: null,
      confidence: 'low',
      message: 'Not enough data for prediction'
    };
  }
  
  const data = similar[0];
  const confidence = data.count >= 10 ? 'high' : data.count >= 5 ? 'medium' : 'low';
  
  return {
    prediction: {
      estimatedPrice: Math.round(data.avgPrice),
      priceRange: {
        min: Math.round(data.minPrice),
        max: Math.round(data.maxPrice)
      },
      pricePerSqft: Math.round(data.avgPricePerSqft),
      estimatedForArea: Math.round(data.avgPricePerSqft * areaSqft)
    },
    confidence,
    sampleSize: data.count,
    message: `Based on ${data.count} similar properties`
  };
};

// Search analytics helper
export const trackSearchQuery = async (query, userId = null, results = 0) => {
  // This would typically save to a search analytics collection
  // For now, just log the search
  console.log('Search Query:', {
    query,
    userId,
    results,
    timestamp: new Date()
  });
  
  // You can implement proper search analytics tracking here
  // Example: SavedSearchAnalytics.create({ query, userId, results, timestamp: new Date() });
};

// Auto-suggest locations
export const getLocationSuggestions = async (query, limit = 8) => {
  if (!query || query.length < 2) return [];
  
  const suggestions = await Property.aggregate([
    {
      $match: {
        status: 'active',
        $or: [
          { 'location.city': { $regex: `^${query}`, $options: 'i' } },
          { 'location.area': { $regex: `^${query}`, $options: 'i' } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        cities: { $addToSet: '$location.city' },
        areas: { $addToSet: '$location.area' }
      }
    },
    {
      $project: {
        suggestions: {
          $slice: [
            {
              $filter: {
                input: { $concatArrays: ['$cities', '$areas'] },
                cond: { $regexMatch: { input: '$$this', regex: query, options: 'i' } }
              }
            },
            limit
          ]
        }
      }
    }
  ]);
  
  return suggestions[0]?.suggestions || [];
};

// Property recommendations based on user behavior
export const getPersonalizedRecommendations = async (userId, limit = 10) => {
  // This would use user's search history, viewed properties, etc.
  // For now, returning popular properties
  
  const recommendations = await Property.find({
    status: 'active'
  })
  .sort({ viewCount: -1, createdAt: -1 })
  .limit(limit)
  .select('title price location bedrooms images propertyType')
  .lean();
  
  return recommendations;
};