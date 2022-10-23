const {getConfig} = require('./webpack.config.utils');
module.exports = {
  ...getConfig('child', 8080)
};
