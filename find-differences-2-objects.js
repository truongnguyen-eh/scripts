import fs from 'fs';
import path from 'path';

const file1 = process.argv[2];
const file2 = process.argv[3];

export const compareObjects = (obj1, obj2, path = '') => {
  const differences = [];

  // Helper to add differences
  const addDiff = (type, keyPath, value1, value2) => {
    differences.push({
      type,
      path: keyPath,
      oldValue: value1,
      newValue: value2,
    });
  };

  // Helper to check if value is an object
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  // Helper to check if arrays are equal (with order sensitivity)
  const areArraysEqual = (arr1, arr2) => {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((item, index) => deepEqual(item, arr2[index]));
  };

  // Deep equality check
  const deepEqual = (val1, val2) => {
    if (Array.isArray(val1) && Array.isArray(val2)) {
      return areArraysEqual(val1, val2);
    } else if (isObject(val1) && isObject(val2)) {
      return compareObjects(val1, val2).length === 0;
    }
    return val1 === val2;
  }

  // Compare each key in obj1
  for (const key in obj1) {
    const fullPath = path ? `${path}.${key}` : key;

    if (!(key in obj2)) {
      addDiff('removed', fullPath, obj1[key], undefined);
    } else if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      if (!areArraysEqual(obj1[key], obj2[key])) {
        addDiff('modified', fullPath, obj1[key], obj2[key]);
      }
    } else if (isObject(obj1[key]) && isObject(obj2[key])) {
      const nestedDiffs = compareObjects(obj1[key], obj2[key], fullPath);
      differences.push(...nestedDiffs);
    } else if (obj1[key] !== obj2[key]) {
      addDiff('modified', fullPath, obj1[key], obj2[key]);
    }
  }

  // Check for keys in obj2 that are not in obj1
  for (const key in obj2) {
    const fullPath = path ? `${path}.${key}` : key;
    if (!(key in obj1)) {
      addDiff('added', fullPath, undefined, obj2[key]);
    }
  }

  return differences;
}

// Visualize differences
function logDifferences(diffArray) {
  diffArray.forEach((diff) => {
    const { type, path, oldValue, newValue } = diff;
    switch (type) {
      case 'added':
        console.log(`%cAdded: ${path}`, 'color: green;', `\nNew Value:\n`, newValue);
        break;
      case 'removed':
        console.log(`%cRemoved: ${path}`, 'color: red;', `\nOld Value:\n`, oldValue);
        break;
      case 'modified':
        console.log(`%cModified: ${path}`, 'color: orange;', `\nOld Value:\n`, oldValue, `\nNew Value:`, newValue);
        break;
    }
  });
}

const main = () => {
  // Read file 1
  const file1Path = path.resolve(file1);
  const file1Data = fs.readFileSync(file1Path, 'utf8');
  const file1Json = JSON.parse(file1Data);

  // Read file 2
  const file2Path = path.resolve(file2);
  const file2Data = fs.readFileSync(file2Path, 'utf8');
  const file2Json = JSON.parse(file2Data);

  const differences = compareObjects(file1Json, file2Json);
  logDifferences(differences);
}

main();
