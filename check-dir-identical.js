/*
This script aims to check if content of 2 directories are identical, which can be beneficial when comparing output of 2 builds
How to use this script?
- `node check-dir-identical.js path/to/dir1 path/to/dir2`
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Function to get all files in a directory recursively
function getAllFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (let item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// Function to generate a hash for file content
function getFileHash(filePath) {
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

// Main function to compare files between two directories
function compareDirectories(dir1, dir2) {
  const dir1Files = getAllFiles(dir1).map(file => path.relative(dir1, file));
  const dir2Files = getAllFiles(dir2).map(file => path.relative(dir2, file));

  const allFiles = new Set([...dir1Files, ...dir2Files]);
  let identical = true;

  for (let file of allFiles) {
    const filePath1 = path.join(dir1, file);
    const filePath2 = path.join(dir2, file);

    if (!fs.existsSync(filePath1)) {
      console.log(`File missing in ${dir1}: ${file}`);
      identical = false;
    } else if (!fs.existsSync(filePath2)) {
      console.log(`File missing in ${dir2}: ${file}`);
      identical = false;
    } else {
      const hash1 = getFileHash(filePath1);
      const hash2 = getFileHash(filePath2);

      if (hash1 !== hash2) {
        console.log(`File content mismatch: ${file}`);
        identical = false;
      }
    }
  }

  if (identical) {
    console.log('All files between the two directories are identical.');
  } else {
    console.log('Differences were found between the two directories.');
  }
}

const dir1 = process.argv[2];
const dir2 = process.argv[3];

compareDirectories(dir1, dir2);
