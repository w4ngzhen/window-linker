const path = require('path');
module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    // 直接处理ts编译出的commonjs代码
    main: path.resolve(__dirname, '..', 'dist', 'es6', 'index.js')
  },
  output: {
    path: path.resolve(__dirname, '..', 'dist', 'umd'),
    filename: 'window-linker.umd.js',
    library: {
      name: 'WindowLinker',
      type: 'umd',
    }
  }
};
