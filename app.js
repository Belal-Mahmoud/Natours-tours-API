const path = require('path');
const express = require('express'); // This here is a function.
const cors = require('cors');
const morgan = require('morgan'); // Is a 3rd party middleware module & its very popular & makes development life easier.
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp'); // Stands for HTTP parameter pollution.
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const baseURL = '/api/v1';

const app = express(); // The function upon calling will add a bunch of methods to our app variable here.
app.use(cors());

// 1) GLOBAL Middlewares.

// Set security HTTP headers.
app.use(helmet()); // We are calling the function here cause it gonna call the function that's gonna be sitting here until it's call.

// Development logging.
if (process.env.NODE_ENV === 'development') {
  console.log(process.env.NODE_ENV);
  app.use(morgan('dev')); // Log to the terminal request log info.
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
app.use(express.json({ limit: '10kb' })); // This is a middleware which is a function that can modify incoming request data, we limit it to 10kilo bytes.
app.use(express.urlencoded({ extended: true, limit: '10kb'})); // MW: To basically parse data coming from a URL encoded form.
app.use(cookieParser()); // MW: Which parses cookies attached to the client request object.

//Data snitization against NoSQL query injection.
app.use(mongoSanitize()); // It's to look at the request body, request query string, and req.params and will filter out all of the dollar sign and dots "Remove mongoDB injections".

//Data snitization against XSS.
app.use(xss()); // This will then clean any user input from malicious HTML code "To not inject HTML mailcious code with JS attached to it".

// Prevent parameter pollution: manages problems that comes from the URL duplicated params like having 2sorts.
app.use(
  hpp({
    // To make certain params to be duplicated.
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
app.use(express.static(`${__dirname}/public`)); // This is to get access to the file that are setting in our FS that we want to access. So, now we have access to all the files inside "Public" folder.

// Test midlleware.
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers);

  next();
});

// The following is a middleware that will execute the "Mounting Router" which is using "tourRouter" router instead of using "app.use" router.
app.use(`${baseURL}/tours`, tourRouter);
app.use(`${baseURL}/users`, userRouter);
app.use(`${baseURL}/reviews`, reviewRouter);

app.all('*', (req, res, next) => {
  // This MW is working for all 'CRUD' operators that we have built, and '*' is to work with any URL that is passed, and this is to handle a response to any URL that passed in the server in case that the URL is not one of the above "exist on the server".

  next(new AppError(`Can't find ${req.originalUrl} in this server!!!`, 404)); // Whenever 'next' function receives an argument, no matter what it is, Express will automatically know that there was an error. So, it assume that whatever we pass into 'next' is gonna be an error. And will skip all other MWs in the stack and go straight to "Error handling MW".
});

// Error handling MW.
app.use(globalErrorHandler); // errController.

module.exports = app;
