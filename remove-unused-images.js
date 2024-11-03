/*
  This script aims to remove unused images inside a project by checking if any usage of file's basename exist
  How to use the script?
    `node remove-unused-images.js path/to/project`
  - Important note: It won’t detect dynamic imports or URLs generated at runtime. Extra check after running script is needed.
*/

import fs from 'fs';
import path from 'path';

// Configuration
const projectDir = process.argv[2] || './src'; // Change to the root of your frontend project
const ignoreDirs=[
  'node_modules/',
  'build/',
  'dist/'
]
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
const fileExtensionsToCheck = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.md', '.res', '.re'];
const deleteUnusedImages = true; // Set to true to enable deletion

// Utility to get all files of specified extensions in a directory recursively
function getAllFiles(dir, extensions) {
  for (const ignoreDir of ignoreDirs) {
    if (dir.includes(ignoreDir)) {
      return [];
    }
  }

  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (let item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(item.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Check if an image is used in any of the source files
function isImageUsed(imagePath, sourceFiles) {
  const imageFileName = path.basename(imagePath);

  for (let file of sourceFiles) {
    const fileContent = fs.readFileSync(file, 'utf-8');
    if (fileContent.includes(imageFileName)) {
      return true;
    }
  }

  return false;
}

// Main function to find and optionally delete unused images
function findAndRemoveUnusedImages() {
  // Step 1: Get all image files
  const imageFiles = getAllFiles(projectDir, imageExtensions);

  // Step 2: Get all source files where images might be referenced
  const sourceFiles = getAllFiles(projectDir, fileExtensionsToCheck);

  const unusedImages = [];

  // Step 3: Check each image for usage
  for (let image of imageFiles) {
    if (!isImageUsed(image, sourceFiles)) {
      unusedImages.push(image);
      console.log(`Unused image found: ${image}`);

      if (deleteUnusedImages) {
        fs.unlinkSync(image);
        console.log(`Deleted: ${image}`);
      }
    }
  }

  // Summary
  if (unusedImages.length > 0) {
    console.log(`\nTotal unused images found: ${unusedImages.length}`);
  } else {
    console.log('\nNo unused images found.');
  }
}

// Run the script
findAndRemoveUnusedImages();
