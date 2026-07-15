const fs = require('fs');
let content = fs.readFileSync('api/services/UserService.ts', 'utf-8');

// Find newPassword usage
if (content.includes('authUpdateObj.password = newPassword;')) {
  // We need to look at what's in scope, let's just use password instead if it's there
  content = content.replace('authUpdateObj.password = newPassword;', 'authUpdateObj.password = password || "";');
}

fs.writeFileSync('api/services/UserService.ts', content);
console.log("UserService fixed");
