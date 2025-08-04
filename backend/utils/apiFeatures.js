// utils/advancedApiFeatures.js - FIXED VERSION
export class AdvancedApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString || {};
    this.page = parseInt(queryString.page) || 1;
    this.limit = parseInt(queryString.limit) || 20;
    this.isAggregated = false;
    this.aggregationPipeline = [];
  }

  // Advanced text search with fuzzy matching and relevance scoring
  advancedSearch() {
    const { q, search } = this.queryString;
    const searchTerm = q || search;

    if (searchTerm && searchTerm.trim() !== '') {
      // Convert to aggregation pipeline
      this.convertToAggregation();
      
      // Add search match stage
      this.aggregationPipeline.push({
        $match: {
          $or: [
            { $text: { $search: searchTerm } },
            { title: { $regex: searchTerm, $options: "i" } },
            { description: { $regex: searchTerm, $options: "i" } },
            { "location.city": { $regex: searchTerm, $options: "i" } },
            { "location.area": { $regex: searchTerm, $options: "i" } },
            { "location.address": { $regex: searchTerm, $options: "i" } },
          ]
        }
      });

      // Add scoring
      this.aggregationPipeline.push({
        $addFields: {
          score: {
            $add: [
              { $multiply: [{ $ifNull: [{ $meta: "textScore" }, 0] }, 1] },
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: "$title",
                      regex: searchTerm,
                      options: "i",
                    },
                  },
                  5,
                  0,
                ],
              },
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: "$location.city",
                      regex: searchTerm,
                      options: "i",
                    },
                  },
                  3,
                  0,
                ],
              },
            ],
          },
        },
      });
    }
    return this;
  }

  // Smart location search
  locationSearch() {
    const { city, area, state, pincode, locality } = this.queryString;

    if (city || area || state || pincode || locality) {
      const locationFilters = {};

      if (city) {
        locationFilters["location.city"] = { $regex: city, $options: "i" };
      }
      if (area) {
        locationFilters["location.area"] = { $regex: area, $options: "i" };
      }
      if (state) {
        locationFilters["location.state"] = { $regex: state, $options: "i" };
      }
      if (pincode) {
        locationFilters["location.pincode"] = { $regex: pincode, $options: "i" };
      }
      if (locality) {
        locationFilters.$or = [
          { "location.area": { $regex: locality, $options: "i" } },
          { "location.address": { $regex: locality, $options: "i" } },
        ];
      }

      this.addFilter(locationFilters);
    }
    return this;
  }

  // Advanced price filtering
  priceFilter() {
    const { minPrice, maxPrice, priceRange, budget } = this.queryString;

    if (minPrice || maxPrice || priceRange || budget) {
      const priceQuery = {};

      if (minPrice) priceQuery.$gte = parseInt(minPrice);
      if (maxPrice) priceQuery.$lte = parseInt(maxPrice);

      // Predefined price ranges
      if (priceRange) {
        const ranges = {
          1: { $gte: 0, $lte: 2500000 },
          2: { $gte: 2500000, $lte: 5000000 },
          3: { $gte: 5000000, $lte: 10000000 },
          4: { $gte: 10000000, $lte: 20000000 },
          5: { $gte: 20000000 },
        };
        Object.assign(priceQuery, ranges[priceRange]);
      }

      // Budget calculation
      if (budget) {
        const maxPrice = (parseInt(budget) * 12 * 20) / 0.8;
        priceQuery.$lte = maxPrice;
      }

      if (Object.keys(priceQuery).length > 0) {
        this.addFilter({ price: priceQuery });
      }
    }
    return this;
  }

  // Enhanced property filters
  propertyFilters() {
    const {
      bedrooms,
      bathrooms,
      minArea,
      maxArea,
      propertyType,
      furnishing,
      parking,
      age,
      facing,
      amenities,
    } = this.queryString;

    const filters = {};

    // Bedrooms filter
    if (bedrooms) {
      if (bedrooms.includes(",")) {
        filters.bedrooms = { $in: bedrooms.split(",").map(Number) };
      } else {
        filters.bedrooms = parseInt(bedrooms);
      }
    }

    // Other filters
    if (bathrooms) filters.bathrooms = { $gte: parseInt(bathrooms) };

    if (minArea || maxArea) {
      filters.areaSqft = {};
      if (minArea) filters.areaSqft.$gte = parseInt(minArea);
      if (maxArea) filters.areaSqft.$lte = parseInt(maxArea);
    }

    if (propertyType) {
      // Handle multiple property types
      if (propertyType.includes(",")) {
        filters.propertyType = { $in: propertyType.split(",") };
      } else {
        filters.propertyType = propertyType;
      }
    }

    if (furnishing) filters.furnishing = furnishing;
    if (parking) filters.parking = { $gte: parseInt(parking) };

    if (age) {
      const ageRanges = {
        new: { $lte: 1 },
        recent: { $gte: 1, $lte: 5 },
        established: { $gte: 5, $lte: 10 },
        old: { $gte: 10 },
      };
      filters.ageInYears = ageRanges[age];
    }

    if (facing) {
      filters.facing = { $in: facing.split(",") };
    }

    if (amenities) {
      const amenityList = amenities.split(",");
      filters.amenities = { $all: amenityList };
    }

    if (Object.keys(filters).length > 0) {
      this.addFilter(filters);
    }
    return this;
  }

  // Geospatial search
  geoSearch() {
    const { lat, lng, radius, metro, landmark } = this.queryString;

    if (lat && lng && radius) {
      const radiusInKm = parseFloat(radius);
      const radiusInRadians = radiusInKm / 6378.1;

      const geoFilter = {
        "location.coordinates": {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              radiusInRadians,
            ],
          },
        },
      };
      this.addFilter(geoFilter);
    }

    if (metro) {
      const metroFilter = {
        nearbyMetro: { $elemMatch: { station: metro, distance: { $lte: 2 } } },
      };
      this.addFilter(metroFilter);
    }

    if (landmark) {
      const landmarkFilter = {
        nearbyLandmarks: {
          $elemMatch: { name: { $regex: landmark, $options: "i" } },
        },
      };
      this.addFilter(landmarkFilter);
    }

    return this;
  }

  // Smart sorting
  advancedSort() {
    const { sortBy, sortOrder } = this.queryString;
    
    const sortOptions = {
      price_low: { price: 1 },
      price_high: { price: -1 },
      area_large: { areaSqft: -1 },
      area_small: { areaSqft: 1 },
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      relevance: { score: -1, createdAt: -1 },
      popular: { viewCount: -1, createdAt: -1 },
    };

    let sortCriteria = { createdAt: -1 }; // default

    if (sortBy && sortOptions[sortBy]) {
      sortCriteria = sortOptions[sortBy];
    }

    // If we have a search score, prioritize it
    if (this.isAggregated && this.aggregationPipeline.some(stage => stage.$addFields && stage.$addFields.score)) {
      sortCriteria = { score: -1, ...sortCriteria };
    }

    if (this.isAggregated) {
      this.aggregationPipeline.push({ $sort: sortCriteria });
    } else {
      this.query = this.query.sort(sortCriteria);
    }

    return this;
  }

  // Enhanced pagination
  advancedPaginate() {
    const skip = (this.page - 1) * this.limit;

    if (this.isAggregated) {
      this.aggregationPipeline.push({ $skip: skip });
      this.aggregationPipeline.push({ $limit: this.limit });
    } else {
      this.query = this.query.skip(skip).limit(this.limit);
    }
    return this;
  }

  // Helper method to add filters
  addFilter(filter) {
    if (this.isAggregated) {
      this.aggregationPipeline.push({ $match: filter });
    } else {
      this.query = this.query.find(filter);
    }
  }

  // Convert query to aggregation pipeline
  convertToAggregation() {
    if (!this.isAggregated) {
      this.isAggregated = true;
      
      // Start with base match from the original query
      const baseConditions = this.query.getQuery();
      if (Object.keys(baseConditions).length > 0) {
        this.aggregationPipeline.push({ $match: baseConditions });
      }
      
      // Convert to aggregation
      this.query = this.query.model.aggregate([]);
    }
  }

  // Apply all filters in sequence
  applyFilters() {
    return this.advancedSearch()
      .locationSearch()
      .priceFilter()
      .propertyFilters()
      .geoSearch()
      .advancedSort()
      .advancedPaginate();
  }

  // Get the final query
  getQuery() {
    if (this.isAggregated) {
      // Rebuild the aggregation with all pipeline stages
      this.query = this.query.model.aggregate(this.aggregationPipeline);
      return this.query;
    }
    return this.query;
  }

  // Get pipeline for debugging
  pipeline() {
    return this.aggregationPipeline;
  }

  // Execute the query
  async execute() {
    if (this.isAggregated) {
      return await this.query.model.aggregate(this.aggregationPipeline);
    }
    return await this.query.exec();
  }
}