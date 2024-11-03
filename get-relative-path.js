/*
Assume that you are working on a project, and you want to get access a file/dir of another project:
- Current project example: /Users/username/project/src
- Access project example: /Users/username/project/assets/images
Output will be: ../assets/images

How to use this script?
`node get-relative-path.js /Users/username/project/src /Users/username/project/assets/images`
*/

import path from 'path';

// Function to get the relative path between two directories
function getRelativePath(dir1, dir2) {
  return path.relative(dir1, dir2);
}

// Example usage
const dir1 = process.argv[2];
const dir2 = process.argv[3];

const relativePath = getRelativePath(dir1, dir2);
console.log(relativePath);
