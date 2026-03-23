const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');

const code = fs.readFileSync('src/pages/ContactDetail.jsx', 'utf8');

try {
  acorn.Parser.extend(jsx()).parse(code, { ecmaVersion: 2020, sourceType: 'module' });
  console.log("Syntax OK!");
} catch (e) {
  console.log("Syntax Error:", e.message, "at line", e.loc.line, "col", e.loc.column);
}
