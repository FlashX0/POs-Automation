const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

// Wrap line 528
content = content.replace(
  '// Run immediate background seed\nUserService.seedAllRequiredUsers();',
  '// Run immediate background seed\ntry {\n  UserService.seedAllRequiredUsers();\n} catch (err) {\n  console.error("Failed background seedAllRequiredUsers:", err);\n}'
);

fs.writeFileSync('api/app.ts', content);
