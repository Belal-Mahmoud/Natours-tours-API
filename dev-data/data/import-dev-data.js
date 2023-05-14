// This code is to upload the "tours-simple.json" file to the DB.
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tour = require(`${__dirname}/../../models/tourModel`);

dotenv.config({ path: `${__dirname}/../../config.env` });

const port = process.env.port;
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => console.log('DB Connection Successful!'));

// Read JSON file.
const tours = JSON.parse(
  fs.readFileSync(`${__dirname}/tours-simple.json`, 'UTF-8')
);

// Import data into DB.
const importData = async () => {
  try {
    await Tour.create(tours);
    console.log('Data Successfully loaded!');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// Delete data from DB.
const deleteData = async () => {
  try {
    await Tour.deleteMany();
    console.log('Data Successfully deleted!');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

console.log(process.argv); // This is the argument variables that are running the app.

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
