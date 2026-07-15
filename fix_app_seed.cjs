const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

code = code.replace(
/try \{\s*await UserService\.seedAllRequiredUsers\(\);\s*\} catch \(err\) \{\s*console\.error\("Error in seedAllRequiredUsers:", err\);\s*\}/g,
`UserService.seedAllRequiredUsers().catch(err => console.error("Error in seedAllRequiredUsers:", err));`
);

fs.writeFileSync('api/app.ts', code);
