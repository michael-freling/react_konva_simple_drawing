const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        // https://github.com/konvajs/react-konva/issues/102#issuecomment-308000612
        config.plugins.push(new webpack.IgnorePlugin({
            resourceRegExp: /canvas|jsdom/,
            contextRegExp: /konva/,
        }))
        return config;
    }
}

module.exports = nextConfig
