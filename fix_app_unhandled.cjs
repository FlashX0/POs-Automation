const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

code = code.replace(
/try \{\s*UserService\.seedAllRequiredUsers\(\);\s*\} catch \(err\) \{\s*console\.error\("Failed background seedAllRequiredUsers:", err\);\s*\}/g,
`UserService.seedAllRequiredUsers().catch(err => console.error("Failed background seedAllRequiredUsers:", err));`
);

fs.writeFileSync('api/app.ts', code);
