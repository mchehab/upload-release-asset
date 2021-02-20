const core = require('@actions/core');
const { GitHub, context } = require('@actions/github');
const fs = require('fs');

async function getUploadUrlByReleaseTag(github, releaseTag) {
  // Get owner and repo from context of payload that triggered the action
  const { owner, repo } = context.repo;

  // Get the default tag name from the triggered action when not given
  const tagName = releaseTag || context.ref;

  // This removes the 'refs/tags' portion of the string, i.e. from 'refs/tags/xxx' to 'xxx'
  const tag = tagName.replace('refs/tags/', '');

  // Get a release from the tag name
  // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
  // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
  const response = await github.repos.getReleaseByTag({
    owner,
    repo,
    tag
  });

  // Get the upload URL for the created Release from the response
  const {
    data: { upload_url: uploadUrl }
  } = response;

  return uploadUrl;
}

async function run() {
  try {
    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const github = new GitHub(process.env.GITHUB_TOKEN);

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const uploadUrlVar = core.getInput('upload_url', { required: false });
    const releaseTag = core.getInput('release_tag', { required: false });

    const uploadUrl = uploadUrlVar || (await getUploadUrlByReleaseTag(github, releaseTag));
    if (!uploadUrl) {
      throw new Error('Unable to get the upload URL');
    }

    const assetPath = core.getInput('asset_path', { required: true });
    const assetName = core.getInput('asset_name', { required: true });
    const assetContentType = core.getInput('asset_content_type', { required: true });

    // Determine content-length for header to upload asset
    const contentLength = filePath => fs.statSync(filePath).size;

    // Setup headers for API call, see Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset for more information
    const headers = { 'content-type': assetContentType, 'content-length': contentLength(assetPath) };

    // Upload a release asset
    // API Documentation: https://developer.github.com/v3/repos/releases/#upload-a-release-asset
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset

    console.log(`uploading ${assetName} to ${uploadUrl}`);

    const uploadAssetResponse = await github.repos.uploadReleaseAsset({
      url: uploadUrl,
      headers,
      name: assetName,
      file: fs.readFileSync(assetPath)
    });

    // Get the browser_download_url for the uploaded release asset from the response
    const {
      data: { browser_download_url: browserDownloadUrl }
    } = uploadAssetResponse;

    // Set the output variable for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    console.log(`download URL ${browserDownloadUrl}`);
    core.setOutput('browser_download_url', browserDownloadUrl);
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
