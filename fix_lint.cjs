const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

// Replace knownProjects with defaultProjects
content = content.replace(/\$\{JSON\.stringify\(knownProjects\)\}/g, '${JSON.stringify(defaultProjects)}');

// Fix openaiContent types
content = content.replace(
  'const openaiContent = parts.map(p => {',
  'const openaiContent: any = parts.map(p => {'
);

fs.writeFileSync('api/app.ts', content);
console.log("Lint fixes applied");
