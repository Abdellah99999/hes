// Runtime preload for audit runner (zero application code modification)
const path = require('path');
const backendDir = path.resolve(__dirname, '../../../backend');
const cookieParserPath = require.resolve('cookie-parser', { paths: [backendDir] });
const cp = require(cookieParserPath);
if (cp && !cp.default) {
  cp.default = cp;
}
