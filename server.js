const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Uncaught Exeption: All bugs that occur in our synchronous code but are not handled anywhere.
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: `${__dirname}/config.env` });

const app = require('./app');
const port = process.env.port;
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    // Options we need to specify in order to deal with some deprecation warnings.
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => console.log('DB Connection Successful!'));

const server = app.listen(port, () => {
  console.log(`App is running on port: ${port}`);
});

// Globally handle unhandled rejected promises.
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
