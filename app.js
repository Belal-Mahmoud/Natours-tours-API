const express = require('express');
const morgan = require('morgan'); // Is a 3rd party middleware module & its very popular & makes development life easier.
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');

const app = express();

// 1) GLOBAL Middlewares.

// Set security HTTP headers.
app.use(helmet());

// Development logging.
if (process.env.NODE_ENV === 'development') {
  console.log(process.env.NODE_ENV);
  app.use(morgan('dev'));
}

// Limit requests from the same IP.
const limiter = rateLimit({
  // Define how many requests per IP we are going to allow in a certain amount of time 100req/hour.
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

//Data snitization against NoSQL query injection.
app.use(mongoSanitize());

//Data snitization against XSS.
app.use(xss());

// Prevent parameter pollution: manages problems that comes from the URL duplicated params like having 2sorts.
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'dificulty',
      'price',
    ],
  })
);

// Serving static files.
app.use(express.static(`${__dirname}/public`));

// Test midlleware.
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers);

  next();
});

app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} in this server!!!`, 404));
});

// Error handling MW.
app.use(globalErrorHandler);

module.exports = app;
