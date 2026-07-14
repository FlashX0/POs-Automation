const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const search = `    const imagePart = {
        type: "image_url",
        image_url: {
          url: \`data:\${mimeType};base64,\${fileBuffer.toString("base64")}\`
        }
      };
      // 
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType,
      }
    };`;

const replace = `    const imagePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType,
      }
    };`;

code = code.replace(search, replace);
fs.writeFileSync('api/app.ts', code);
