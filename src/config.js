"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Created by kizer on 17/07/2017.
 */
const nconf = require("nconf");
nconf
    .argv()
    .env()
    .file({ file: __dirname + '/cfg.json' });
exports.default = nconf;
//# sourceMappingURL=config.js.map