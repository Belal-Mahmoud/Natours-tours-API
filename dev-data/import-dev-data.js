// This code is to upload the "tours-simple.json" file to the DB.
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tour = require(`${__dirname}/../../models/tourModel`);
const User = require(`${__dirname}/../../models/userModel`);
const Review = require(`${__dirname}/../../models/reviewModel`);

dotenv.config({ path: `${__dirname}/../../config.env` });

const port = process.env.port; //3000
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
const tours = JSON.parse(fs.readFileSync(`${__dirname}/tours.json`, 'UTF-8'));
const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'UTF-8'));
const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'UTF-8')
);

// Import data into DB.
const importData = async () => {
  try {
    await Tour.create(tours);
    await User.create(users, { validateBeforeSave: false });
    await Review.create(reviews, { validateBeforeSave: false });
    console.log('Data Successfully loaded!');
  } catch (err) {
    console.log(err);
  }
  process.exit(); // An agressive way of stopping an application.
};

// Delete data from DB.
const deleteData = async () => {
  try {
    await Tour.deleteMany();
    await User.deleteMany();
    await Review.deleteMany();
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
