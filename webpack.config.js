const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/index.ts',
  output: {
    filename: 'chat.js',
    path: path.resolve(__dirname, 'wwwroot/js'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  devtool: 'source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'wwwroot'),
    },
    compress: true,
    port: 5000,
    proxy: {
      '/chatHub': {
        target: 'http://localhost:5067',
        ws: true, // 支援WebSocket
      },
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      signalR: '@microsoft/signalr'
    })
  ]
};