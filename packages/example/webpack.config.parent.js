const {getConfig} = require('./webpack.config.utils');
module.exports = {
  ...getConfig('parent', 8081)
};
