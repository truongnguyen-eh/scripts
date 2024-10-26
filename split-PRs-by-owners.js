/*
This script aims to split the current local changes inside git project into smaller PRs grouped by code owners
How to use this script?
- Copy this script to the root of current git project
- Install dependencies globally (To not affect package.json of current project):
    `yarn global add @octokit/rest simple-git codeowners`
- Run script:
    `node split-PRs-by-owners.js your-github-access-token-with-PR-create-permission`
*/

import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';
import Codeowners from 'codeowners';

const repos = new Codeowners();

// Function to group files by code owners
function groupFilesByOwners(files) {
  const filesByOwner = {};

  files.forEach(file => {
    const owners = repos.getOwner(file);
    if (owners.length > 0) {
      const ownerGroup = owners[0];
      if (!filesByOwner[ownerGroup]) {
        filesByOwner[ownerGroup] = [];
      }
      filesByOwner[ownerGroup].push(file);
    } else {
      if (!filesByOwner.unowned) {
        filesByOwner.unowned = [];
      }
      filesByOwner.unowned.push(file);
    }
  });

  return filesByOwner;
}

// Initialize GitHub API client
const githubToken = process.argv[2];
const octokit = new Octokit({ auth: githubToken });

// Git config
const git = simpleGit();

// Repo config
const repoOwner = 'Thinkei';
const repoName = 'frontend-core';

// Branch config
const branchPrefix = 'CUWP-818';
const prTitlePrefix = '[CUWP-818] Remove unused code part';
const prBody = `
# Jira card / Github issue
<!-- Strictly required to include:
1. JIRA card: The card can be created by yourself but please ensure EM & PO confirmed.
2. Or Github issue: The issue needs to be confirmed by @fe-platform.
-->

<!-- Fill in here -->
https://employmenthero.atlassian.net/browse/CUWP-818

# Description
<!-- Detailed explanation of
1. What is this PR for?
2. Why you come up with the solution?
-->

<!-- Fill in here -->
Remove unused code

- How was this PR created?
  - We used [Knip](https://knip.dev/explanations/why-use-knip) to automatically detect and remove unused static code. 
    'knip-bun --fix-type exports,types,dependencies,files --allow-remove-files'
    - To avoid removing code that may still be under active development, we added files modified within the last two weeks to the ignore list, ensuring Knip does not perform code removal on those files. Example of active development code https://github.com/Thinkei/frontend-core/pull/34390
  - After running Knip, we applied ESLint fixes to remove unused variables and resolve styling issues. 
  'eslint --fix path/to/folder1 path/to/folder2'
  - Then we reviewed each change and staged the change locally.
  - Finally, we use script to separate the change into smaller PRs grouped by codeowner.

- Why we believe this PR is safe to merge:
  - We've successfully merged and deployed [6 similar PRs](https://github.com/Thinkei/frontend-core/pulls?q=is%3Apr+label%3Acode-removal+is%3Aclosed) using this approach. These PRs demonstrated that Knip and ESLint scripts are reliable.
  - Wrong or missing removals can be caught by our CI: linting, type checks, and tests.

# Screenshots / Videos
<!-- Screenshots are required for static UI changes:
1. Fullscreen capture is recommended. You may add some markers to help reviewer recognise the change.
2. THREE screensize (Desktop, Ipad, Iphone) captures are required if this PR touches the layout.
-->

<!-- Videos (or gifs) are required for interaction changes: Make it short so reviewer can review quickly. -->

<!-- If there is no image or video attached, please add an explanation. -->

<!-- Fill in here -->
No UI changed

# Testing plan
<!-- Try to think we are a tester to read this PR change and prepare a testing plan for it:
1. The testing plan needs to be run on staging/sandbox environment.
2. [Optional] Provide the testing account & environment: Eg
- Account: ben@thinkei.com/P@ssword17e4
- Sandbox: instapay.staging.ehrocks.com
3. The common pattern of testing plan is:
- [ ] On the page .....
      When I do something ....
      Then I see .....
      And Something else.....
-->
<!-- If we don't have a testing plan, we can't ensure the PR gets merged won't cause any incident. -->

<!-- Fill in here -->
- Type checking CI passed
- Linter checking CI passed
- Tests CI passed
- E2E tests passed

Sandbox: The mobile sandbox URL can be found in the GitHub Action comment below.
Account: truong.nguyen2@employmenthero.com / K***AM1

# Checklist

 - [x] Have you confirmed the change with PO and/or EM?
 - [x] Is your backend ready? Or do you have flag to restrict access your front-end?
 - [x] Have you applied hero-design/hero-theme in your changed UIs?
 - [x] Have you updated CODEOWNERS and CODEOWNERS.url?
 - [x] Have you attached Mobile/Tablet/Desktop screenshots in case of UI changes?
 - [x] Have you applied I18n for all the text of your changed files?
`;

// Create a branch, commit files, and push changes
async function createBranchAndPush(part, group, branchName) {
  // Move back to base branch
  await git.checkout('master');

  // Create a new branch
  await git.checkoutLocalBranch(branchName);

  // Add files to the stage and commit
  await git.add(group);
  await git.commit(`Remove unused code part ${part}`);

  // Push branch
  await git.push('origin', branchName);
}

// Create a PR for the branch
async function createPR(part, branchName) {
  const { data } = await octokit.pulls.create({
    owner: repoOwner,
    repo: repoName,
    title: `${prTitlePrefix} ${part}`,
    head: branchName,
    base: 'master', // Adjust base branch if necessary
    body: prBody || `This PR contains changes from branch: ${branchName}.`,
    draft: true,
  });
  console.log(`PR created: ${data.html_url}`);
}

async function main() {
  // Get the list of changed files (this assumes you're working on an existing branch)
  const status = await git.status();
  const changedFiles = status.files.map(file => file.path);

  if (!changedFiles.length) {
    console.log('No files changed.');
    return;
  }

  // Group the files by owners
  const fileGroupsObject = groupFilesByOwners(changedFiles);
  const fileGroupsArray = Object.values(fileGroupsObject);

  // Process each group: create branch, commit, push, and open PR
  for (let i = 0; i < fileGroupsArray.length; i++) {
    const part = i + 1;
    const branchName = `${branchPrefix}-split-pr-${part}`;
    const group = fileGroupsArray[i];

    // Create a new branch, commit changes, and push it
    await createBranchAndPush(part, group, branchName);

    // Create a PR for the new branch
    await createPR(part, branchName);
  }
}

main().catch(console.error);
