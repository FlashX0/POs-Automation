const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `          clonedElement.style.backgroundColor = "#ffffff";
          clonedElement.style.boxSizing = "border-box";
          clonedElement.style.border = "3px solid #000000";`;

const replacement = `          clonedElement.style.backgroundColor = "#ffffff";
          clonedElement.style.boxSizing = "border-box";
          clonedElement.style.border = "3px solid #000000";
          clonedElement.style.color = "#000000";
          
          // Force all elements inside the cloned table/sheet to be light mode (white bg, black text)
          const allDescendants = clonedElement.querySelectorAll('*');
          allDescendants.forEach(el => {
             const htmlEl = el as HTMLElement;
             if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH' || htmlEl.tagName === 'TR' || htmlEl.tagName === 'DIV' || htmlEl.tagName === 'SPAN') {
                const bg = window.getComputedStyle(htmlEl).backgroundColor;
                // If it's a dark color, make it white
                if (bg && (bg.includes('rgba(15') || bg.includes('rgb(15') || htmlEl.className.includes('bg-slate-') || htmlEl.className.includes('bg-gray-'))) {
                  htmlEl.style.backgroundColor = '#ffffff';
                }
                htmlEl.style.color = '#000000';
                htmlEl.style.borderColor = '#d1d5db'; // light gray border
             }
          });`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/App.tsx', code);
