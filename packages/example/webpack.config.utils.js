const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  getConfig: (name, port) => {
    return {
      mode: 'development',
      entry: {
        main: path.resolve(__dirname, `src/${name}/index.js`)
      },
      output: {
        path: path.resolve(__dirname, `dist/${name}`),
        filename: `${name}-app.js`
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: path.resolve(__dirname, `public/${name}.html`),
          inject: "body"
        })
      ],
      devServer: {
        port
      }
    };
  }


};
