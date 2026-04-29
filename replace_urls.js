const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace backtick string: `http://localhost:4000/api/...`
  // with: `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/...`
  content = content.replace(/`http:\/\/localhost:4000\/api/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api");

  // Replace normal string: "http://localhost:4000/api/..."
  // with: `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/...`
  content = content.replace(/"http:\/\/localhost:4000\/api([^"]*)"/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api$1`");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});
console.log('Done replacing URLs');
