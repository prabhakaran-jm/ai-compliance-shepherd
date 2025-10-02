const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
  entry: {
    main: './src/client/main.ts',
    dashboard: './src/client/dashboard.ts',
    chat: './src/client/chat.ts',
    reports: './src/client/reports.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist/public'),
    filename: isDevelopment ? '[name].js' : '[name].[contenthash].js',
    clean: true,
    publicPath: '/'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src/client')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
        options: {
          configFile: 'tsconfig.client.json'
        }
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/client/templates/index.html',
      filename: 'index.html',
      chunks: ['main', 'dashboard'],
      title: 'AI Compliance Shepherd'
    }),
    new HtmlWebpackPlugin({
      template: './src/client/templates/chat.html',
      filename: 'chat.html',
      chunks: ['main', 'chat'],
      title: 'AI Compliance Chat'
    }),
    new HtmlWebpackPlugin({
      template: './src/client/templates/reports.html',
      filename: 'reports.html',
      chunks: ['main', 'reports'],
      title: 'Compliance Reports'
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/client/assets',
          to: 'assets',
          noErrorOnMissing: true
        }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/public')
    },
    compress: true,
    port: 3001,
    hot: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    },
    historyApiFallback: {
      rewrites: [
        { from: /^\/chat/, to: '/chat.html' },
        { from: /^\/reports/, to: '/reports.html' },
        { from: /./, to: '/index.html' }
      ]
    }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map'
};
