/*
This script aims to generate Knip config file to remove unused static code inside HR web app project:
- Ignore performing code removal for files that have been modified last 2 weeks (To prevent removing unused code but still being actively developed)
- Ignore performing code removal for files that are being dynamically imported (To prevent False Positive from Knip)
How to use this script?
- Generate file `generate-knip-config.mjs` at root of HR web app
- Copy content of this file to `generate-knip-config.mjs`
- Run `node generate-knip-config.mjs`
*/

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const walk = dir => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = `${dir}/${file}`;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(walk(file));
    } else {
      /* Is a file */
      results.push(file);
    }
  });
  return results;
};

function listFiles(dir, regex = /\.*/) {
  return walk(dir).filter(f => regex.test(f));
}

// Step 1: Get list of modified files last 2 weeks
const getModifiedFiles = () =>
  new Promise((resolve, reject) => {
    exec(
      'git log --since="2 weeks ago" --pretty=format: --name-only',
      (error, stdout, stderr) => {
        if (error) {
          reject(Error(`Error getting modified files: ${stderr}`));
        } else {
          // Split the output by newlines and filter out empty lines
          const files = stdout.split('\n').filter(file => file.trim() !== '');
          // Remove duplicates
          const uniqueFiles = [...new Set(files)];
          resolve(uniqueFiles);
        }
      }
    );
  });

// Step 2: Get list of files that contain dynamic imports
const toAbsoluteImport = (importPath, filePath, projectRoot) => {
  // If the importPath is relative (starts with .), resolve it to an absolute path
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(filePath), importPath);
  }
  // For non-relative paths, assume it's an absolute path from the project root
  return path.resolve(projectRoot, importPath);
};

const extractDynamicImports = (filePath, projectRoot, dynamicImportRegex) => {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const dynamicImports = [];
  let match;

  while ((match = dynamicImportRegex.exec(fileContent)) !== null) {
    // The second capture group is the module path in the import
    const importPath = match[2];
    const absoluteImportPath = toAbsoluteImport(
      importPath,
      filePath,
      projectRoot
    );
    // Todo: Example: apps/hr-web-app/src/modules/ats/components/SalaryBenchmarkTool/VerifyFormModal
    // -> apps/hr-web-app/src/modules/ats/components/SalaryBenchmarkTool/VerifyFormModal.tsx
    // We need to check if [file].{ts,js} exist -> If not -> Move to index.{ts,js}
    dynamicImports.push(absoluteImportPath);
  }

  return dynamicImports;
};

const scanFilesForDynamicImports = () => {
  const projectRoot = path.resolve(__dirname);
  const allDynamicImports = [];
  const dynamicImportRegex =
    /import\(\s*(\/\*.*?\*\/\s*)?['"`](.*?)['"`]\s*\)/gs;
  const filesContainDynamicImports = listFiles(
    `${projectRoot}/apps/hr-web-app/src/modules`,
    /.*\.(js|jsx|ts|tsx)$/
  );

  filesContainDynamicImports.forEach(filePath => {
    allDynamicImports.push(
      ...extractDynamicImports(filePath, projectRoot, dynamicImportRegex)
    );
  });

  return allDynamicImports;
};

// Step 3: Generate Knip config file
const generateKnipConfigFile = async () => {
  const ignoreFiles = [
    ...new Set([
      ...(await getModifiedFiles()),
      ...scanFilesForDynamicImports(),
      'apps/hr-web-app/src/modules/adminContract/components/AdminContract/translations.js', // getTranslations is removed wrongly by Knip
      'apps/hr-web-app/src/modules/emailTemplates/components/RevisionContentInput/__mocks__/index.tsx',
      'apps/hr-web-app/src/modules/emailTemplates/components/RevisionSubjectInput/__mocks__/index.tsx',
      'apps/hr-web-app/src/modules/financialServices/components/HomeLoans/__mocks__/LoanMarketScript.ts',
      'apps/hr-web-app/src/modules/spa/beta/components/Navigation/menuItems/__mocks__/index.ts'
    ]),
  ];

  const baseConfig = {
    workspaces: {
      '.': {
        entry: 'ci-scripts/**/*.{js,sh}',
        project: 'ci-scripts/**/*.{js,sh}',
      },
      'apps/hr-web-app': {
        entry: [
          'src/index.tsx',
          'src/keypay/index.ts',
          'src/agnosticEvents/index.js',
          'src/agnosticEvents/keypay.js',
          '**__mocks__/**/*.js',
        ],
        project: '**/*.{js,ts,tsx}',
      },
      'apps/smarthmatch-demo-app': {
        entry: 'src/index.tsx',
        project: '**/*.{js,ts,tsx}',
      },
      'libs/*': {
        entry: 'src/index.{ts,tsx}',
        project: '**/*.{js,ts,tsx}',
      },
    },
  };

  const rootIgnoreFiles = [];
  const hrWebAppIgnoreFiles = [];
  const smartMatchIgnoreFiles = [];
  const libIgnoreFiles = [];

  ignoreFiles.forEach(file => {
    if (file.startsWith('apps/hr-web-app/')) {
      hrWebAppIgnoreFiles.push(file.replace('apps/hr-web-app/', ''));
    } else if (file.startsWith('apps/smartmatch-demo-app/')) {
      smartMatchIgnoreFiles.push(file.replace('apps/smartmatch-demo-app/', ''));
    } else if (file.startsWith('libs/')) {
      const subPaths = file.split('/');
      if (subPaths.length >= 3) {
        subPaths.shift();
        subPaths.shift();
        const filePath = subPaths.join('/');
        libIgnoreFiles.push(filePath);
      }
    } else {
      rootIgnoreFiles.push(file);
    }
  });

  baseConfig.workspaces['.'].ignore = rootIgnoreFiles;
  baseConfig.workspaces['apps/hr-web-app'].ignore = hrWebAppIgnoreFiles;
  baseConfig.workspaces['apps/smarthmatch-demo-app'].ignore =
    smartMatchIgnoreFiles;
  baseConfig.workspaces['libs/*'].ignore = libIgnoreFiles;

  // Convert JS object to JSON string
  const jsonString = JSON.stringify(baseConfig, null, 2);

  // Write JSON string to a file
  fs.writeFileSync('knip.json', jsonString, err => {
    if (err) {
      console.error('Error writing knip.json', err);
    } else {
      console.log('knip.json has been written');
    }
  });
};

generateKnipConfigFile();
