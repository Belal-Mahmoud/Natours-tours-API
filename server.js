const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Uncaught Exeption: All bugs that occur in our synchronous code but are not handled anywhere.
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1); // It's not optional like "unhandledRejection", because the entire node process is in a so-called unclean state, and to fix that the process need to terminate and then to be restarted.
});

dotenv.config({ path: `${__dirname}/config.env` }); // This command is to read our variables from the file and save them into Node.JS env. And to work on "app.js" file we have to do it before requiring the app.

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
    // We are closing the server to give it time to finish all the requests that are still pending or being handled at the time, and only after that, the server is then killed.
    process.exit(1); // To shut down our application. 0 stands for a success, and 1 stands for uncaught exeption.
  });
}); // The app crash will be automatically restarted in our production app on a web server.
