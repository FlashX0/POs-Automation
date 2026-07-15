const fs = require('fs');

const fileContent = fs.readFileSync('api/app.ts', 'utf-8');

function extractBlock(startMarker, endMarker) {
  const startIndex = fileContent.indexOf(startMarker);
  const endIndex = fileContent.indexOf(endMarker, startIndex);
  if (startIndex === -1 || endIndex === -1) return '';
  return fileContent.substring(startIndex, endIndex + endMarker.length);
}

// I can't run commonjs easily because "type": "module" in package.json.
