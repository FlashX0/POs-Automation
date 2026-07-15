const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

function getBalancedBlock(startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = content[i-1];
    if ((char === '"' || char === "'" || char === '\`') && prevChar !== '\\') {
      if (inString && stringChar === char) {
        inString = false;
      } else if (!inString) {
        inString = true;
        stringChar = char;
      }
    }
    
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i + 1;
        }
      }
    }
  }
  return -1;
}

const searchStart = 'app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {';
let startIdx = content.indexOf(searchStart, 3000);
if (startIdx !== -1) {
  const bodyStart = content.indexOf('{', startIdx);
  const blockEnd = getBalancedBlock(bodyStart);
  if (blockEnd !== -1) {
    let nextBracketSemi = content.indexOf('});', blockEnd - 2);
    if (nextBracketSemi !== -1 && nextBracketSemi <= blockEnd) {
      content = content.substring(0, startIdx) + content.substring(nextBracketSemi + 3);
      fs.writeFileSync('api/app.ts', content);
      console.log("DELETED OCR 2");
    }
  }
}
