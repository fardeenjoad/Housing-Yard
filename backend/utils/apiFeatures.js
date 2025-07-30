export class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  //  Search by title (or any custom field)
  search(searchField) {
    if (this.queryString.q) {
      const keyword = this.queryString.q.trim();
      this.query = this.query.find({
        [searchField]: { $regex: keyword, $options: "i" },
      });
    }
    return this;
  }

  //  Filtering (city/state/country + price + status etc.)
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = [
      "q",
      "page",
      "sort",
      "limit",
      "fields",
      "minPrice",
      "maxPrice",
      "city",
      "state",
      "country"
    ];
    excludedFields.forEach((key) => delete queryObj[key]);

    // Location-based filters
    if (this.queryString.city) {
      queryObj["location.city"] = {
        $regex: this.queryString.city,
        $options: "i",
      };
    }
    if (this.queryString.state) {
      queryObj["location.state"] = {
        $regex: this.queryString.state,
        $options: "i",
      };
    }
    if (this.queryString.country) {
      queryObj["location.country"] = {
        $regex: this.queryString.country,
        $options: "i",
      };
    }

    // Price filter
    if (this.queryString.minPrice || this.queryString.maxPrice) {
      queryObj.price = {};
      if (this.queryString.minPrice) {
        queryObj.price.$gte = Number(this.queryString.minPrice);
      }
      if (this.queryString.maxPrice) {
        queryObj.price.$lte = Number(this.queryString.maxPrice);
      }
    }

    this.query = this.query.find(queryObj);
    return this;
  }

  //  Sorting
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt"); // default sort
    }
    return this;
  }

  //  Field limiting
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v"); // default hide
    }
    return this;
  }

  // Pagination
  paginate(perPage = 10) {
    const page = Number(this.queryString.page) || 1;
    const limit = Number(this.queryString.limit) || perPage;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}