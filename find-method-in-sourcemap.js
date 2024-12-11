const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

// Function to find the source of a method in a source map
async function findMethodSource(mapFilePath, methodName) {
  if (!fs.existsSync(mapFilePath)) {
    console.error('Source map file not found:', mapFilePath);
    return;
  }

  // Read and parse the source map
  const rawSourceMap = JSON.parse(fs.readFileSync(mapFilePath, 'utf8'));
  const consumer = await new SourceMapConsumer(rawSourceMap);

  // Find the index of the method in the "names" array
  const nameIndex = rawSourceMap.names.indexOf(methodName);
  if (nameIndex === -1) {
    console.error(`Method "${methodName}" not found in the source map "names".`);
    return;
  }

  // Iterate over mappings to find the method
  let found = false;
  consumer.eachMapping((mapping) => {
    if (mapping.name === methodName) {
      const sourceFile = rawSourceMap.sources[mapping.source];
      console.log(`Method "${methodName}" is defined in:`);
      console.log(`File: ${sourceFile}`);
      console.log(`Line: ${mapping.originalLine}`);
      console.log(`Column: ${mapping.originalColumn}`);
      console.log('');
      found = true;
    }
  });

  if (!found) {
    console.log(`No direct mapping found for method "${methodName}".`);
  }

  consumer.destroy(); // Clean up resources
}

// Command-line arguments for map file and method name
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node findMethodInSourceMap.js <source-map-file> <method-name>');
  process.exit(1);
}

const mapFilePath = path.resolve(args[0]);
const methodName = args[1];

// Execute the function
findMethodSource(mapFilePath, methodName)
  .catch((err) => console.error('Error:', err));
