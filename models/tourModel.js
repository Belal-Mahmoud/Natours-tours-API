const mongoose = require('mongoose');
const slugify = require('slugify'); // Slug is a string that we can put in the URL, usually based on a string;
const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    // 1st obj is the schema definition.
    name: {
      type: String,
      required: [true, 'A tour must have a name.'],
      unique: true,
      trim: true,
      maxlength: [
        40,
        'A tour name must have less or equal than 40 characters.',
      ],
      minlength: [
        10,
        'A tour name must have more or equal than 10 characters.',
      ],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'], // This function from 'validator' package.
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration.'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size.'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty.'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult.',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // 4.66666666667 => 46.6666666667 => 47 => 4.7 & Setter runs every time its field recieves value.
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price.'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // This only works on CREATE & SAVE!
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price.',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summary.'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a cover image.'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false, // To hide sensitive data from the users.
    },
    startDates: [Date], // JS able to recieve it as string then convert it to Date.
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON: MongoDB uses to specify geospatial data, and has at least type & coordinates. We could remove it and put it the locations as the 1st location with index 0.
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number], // Latidute & Longitude.
      description: String,
      address: String,
    },
    locations: [
      // We are creating embeded documents using an array of objects.
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number], // Latidute & Longitude.
        description: String,
        address: String,
        day: Number,
      },
    ],
    //guides: Array, // Used for embeding users to tours
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // The name of the model.,
      },
    ],
  },
  {
    // 2nd obj is the schema options.
    toJSON: { virtuals: true }, // When the data outputted as JSON we want virtuals to be true "to be part of the output".
    toObject: { virtuals: true }, // When the data outputted as OBJECT we want virtuals to be true "to be part of the output".
  }
);
tourSchema.index({ price: 1, ratingsAverage: -1 }); // Compound index.
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' }); // We did it in order to do "tours-within" Route, And this tell MongoDB that location here should be indexed to a 2D sphere.

tourSchema.virtual('durationWeeks').get(function () {
  // To create attributes that not stored in the DB, we have used regular function to have access to 'this' keyword "It's not exist in the arrow function". We can not use 'virtual' property in query
  return this.duration / 7;
});

// Virtual Populate.
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', // The name of the field that stores the id.
  localField: '_id', // The name of the id property.
});

// DOCUMENT MIDDLEWARE: runs before .save() & .create(). So, it is not gonna run before "insertMany()".
tourSchema.pre('save' /* 'save' is hook. */, function (next) {
  // console.log(this); // "This" keyword gives us access to the current document that is being processed.
  this.slug = slugify(this.name, { lower: true });
  next();
});

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this /*.find()*/.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });

  next();
});

tourSchema.post(/^find/, function (doc, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds`);
  next();
});

// AGGREGATION MIDDLEWARE:
// We have ignore it to use "$geoNear" as the 1st stage, till handle it later.
// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); //Pipeline is an array, so we have used 'unshift' to add an element at the beginning of the array.
//   console.log(this.pipeline()); // "This" keyword gives us access to the aggregation.
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
