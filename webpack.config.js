const path = require("path");
const FileManagerPlugin = require("filemanager-webpack-plugin");

module.exports = (env) => {
    const outputPath = path.resolve(__dirname, env.production ? "dist" : "build");
    const exampleOutputPath = path.resolve(__dirname, "example");
    const outputFileName = `kvapi-client${env.production ? ".min" : ""}.js`;
    const outputMapFileName = outputFileName + ".map";
    return {
        entry: "./src/index.ts",
        mode: env.production ? "production" : "development",
        target: "web",
        devtool: "source-map",
        optimization: {
            minimize: !!env.production,
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: "ts-loader",
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: [".ts", ".js"],
        },
        output: {
            filename: outputFileName,
            path: outputPath,
            library: {
                name: "KvapiClient",
                type: "umd",
            },
        },
        watchOptions: {
            ignored: ["**/node_modules", "**/build", "**/dist"],
        },
        plugins: [
            new FileManagerPlugin({
                events: {
                    onEnd: {
                        copy: [
                            {
                                source: path.resolve(outputPath, outputFileName),
                                destination: path.resolve(exampleOutputPath, "kvapi-client.js"),
                            },
                            {
                                source: path.resolve(outputPath, outputMapFileName),
                                destination: path.resolve(exampleOutputPath, outputMapFileName),
                            },
                            {
                                source: path.resolve(__dirname, "build", "**", "*.d.ts"),
                                destination: path.resolve(__dirname, "dist"),
                            },
                            {
                                source: path.resolve(__dirname, "build", "**", "*.d.ts.map"),
                                destination: path.resolve(__dirname, "dist"),
                            },
                        ],
                    },
                },
            }),
        ],
    };
};