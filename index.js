"use strict";

var through = require("through2");
var ngAnnotate = require("ng-annotate-patched");
var applySourceMap = require("vinyl-sourcemaps-apply");
var { merge } = require("@generates/merger");
var BufferStreams = require("bufferstreams");
var PluginError = require("plugin-error");

var PLUGIN_NAME = "gulp-ng-annotate-patched";

// Function which handle logic for both stream and buffer modes.
function transform(file, input, opts) {
  var res = ngAnnotate(input.toString(), opts);
  if (res.errors) {
    var filename = "";
    if (file.path) {
      filename = file.relative + ": ";
    }
    throw new PluginError(PLUGIN_NAME, filename + res.errors.join("\n"));
  }

  if (opts.map && file.sourceMap) {
    var sourceMap = JSON.parse(res.map);
    sourceMap.file = file.relative;
    applySourceMap(file, sourceMap);
  }

  return Buffer.from(res.src);
}

module.exports = function (options) {
  options = options || {};
  if (!options.remove) {
    options = merge({add: true}, options);
  };

  return through.obj(function (file, enc, done) {
    // When null just pass through.
    if (file.isNull()) {
      this.push(file);
      return done();
    }

    var opts = merge({map: !!file.sourceMap}, options);
    if (opts.map) {
      if (typeof opts.map === "boolean") {
        opts.map = {};
      }
      if (file.path) {
        opts.map.inFile = file.relative;
      }
    }

    // Buffer input.
    if (file.isBuffer()) {
      try {
        file.contents = transform(file, file.contents, opts);
      } catch (e) {
        this.emit("error", e);
        return done();
      }
    // Dealing with stream input.
    } else {
      file.contents = file.contents.pipe(new BufferStreams(function(err, buf, cb) {
        if (err) return cb(new PluginError(PLUGIN_NAME, err));
        try {
          var transformed = transform(file, buf, opts)
        } catch (e) {
          return cb(e);
        }
        cb(null, transformed);
      }));
    }

    this.push(file);
    done();
  });
};
