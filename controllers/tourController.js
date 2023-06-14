const Tour = require('./../models/tourModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,peice';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
// Do NOT update passwords with this:
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  // Aggregation pipeline: Is some thing that we passes documents on a collection throw, in order to calculate or collect general data like: (avg, max, min, etc...). Each object is a stage.
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: '$difficulty',
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 }, // 1 is for ascending.
    },
  ]);

  res.status(200).json({
    status: 'Success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $match: {
        // To select specific documents.
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        // The data that we want to display.
        _id: { $month: '$startDates' }, // Is to group by the 'startDates'.
        numTourStarts: { $sum: 1 }, // To count the number of the tours.
        tours: { $push: '$name' }, // To make an array of the tour's names.
      },
    },
    {
      $addFields: {
        // To add new attribute.
        month: '$_id',
      },
    },
    {
      $project: { _id: 0 }, // To hide specific attribute.
    },
    {
      $sort: { numTourStarts: -1, month: 1 }, // -1 is to sort decending. If there is more than 1 'numTourStarts' has the same value they will be sorted according to the 'month'.
    },
    {
      $limit: 12, // To specify the number of the documents per page.
    },
  ]);

  res.status(200).json({
    status: 'Success',
    data: {
      plan,
    },
  });
});

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const radius = unit === 'mi' ? distance / 3963.2 : distanc / 6378.1;

  if (!lat || !lng)
    next(
      new AppError(
        'Plase provide latitude & longitude in the format lat,lng.',
        400
      )
    );

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'Success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng)
    next(
      new AppError(
        'Plase provide latitude & longitude in the format lat,lng.',
        400
      )
    );

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        // Has to be the 1st stage, and using indexes.
        near: {
          // GeoJSON
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance', // The name of the field that will be created & where all the calculated distances will be stored.
        distanceMultiplier: multiplier, // To converte the result from meters to KM or MI.
      },
    },
    {
      $project: {
        // Used to select speceific fields.
        name: 1,
        distance: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'Success',
    data: {
      data: distances,
    },
  });
});
