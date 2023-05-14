// We use this in 'async' functions instead of using 'try & catch'.
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
