const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Dark backgrounds to semantic background
    content = content.replace(/bg-\[#0B0F19\](\/[0-9]+)?/g, 'bg-background');
    content = content.replace(/bg-\[#090e1a\]/g, 'bg-background');
    content = content.replace(/bg-\[#0f1422\]/g, 'bg-background');
    content = content.replace(/bg-black\/40/g, 'bg-secondary/40');
    
    // Translucent white text to semantic foreground muted
    // Using regex to catch text-white/50 etc but avoid text-white alone
    content = content.replace(/text-white\/[0-9]+/g, 'text-muted-foreground');
    // Pure white text to semantic foreground
    content = content.replace(/text-white(?!(\/|\[|-|[a-zA-Z]))/g, 'text-foreground');
    
    // Translucent borders to semantic border
    content = content.replace(/border-white\/[0-9]+/g, 'border-border');
    content = content.replace(/ring-white\/[0-9]+/g, 'ring-border');
    
    // Translucent white backgrounds to dark translucent (for light mode visibility)
    // Matches bg-white/[0.03], bg-white/5, etc.
    content = content.replace(/bg-white\/\[.*?\]/g, 'bg-black/5');
    content = content.replace(/bg-white\/[0-9]+/g, 'bg-black/5'); 

    // Specific zinc text overrides
    content = content.replace(/text-zinc-[3456]00/g, 'text-muted-foreground');
    
    // Gradients
    content = content.replace(/from-zinc-[89]00 to-zinc-[89]00/g, 'from-white to-slate-50');
    content = content.replace(/from-white to-white\/[0-9]+/g, 'from-foreground to-foreground/80');

    fs.writeFileSync(filePath, content);
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            replaceInFile(fullPath);
        }
    }
}

// Ensure the app directory exists before processing
if (fs.existsSync(path.join(__dirname, 'app'))) {
    processDirectory(path.join(__dirname, 'app'));
}
if (fs.existsSync(path.join(__dirname, 'components'))) {
    processDirectory(path.join(__dirname, 'components'));
}
console.log("Theme migration complete!");
