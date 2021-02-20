jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('fs');

const core = require('@actions/core');
const { GitHub, context } = require('@actions/github');
const fs = require('fs');
const run = require('../src/upload-release-asset');

console.log = jest.fn();

/* eslint-disable no-undef */
describe('Upload Release Asset', () => {
  let getReleaseByTag;
  let uploadReleaseAsset;
  let content;

  beforeEach(() => {
    uploadReleaseAsset = jest.fn().mockReturnValueOnce({
      data: {
        browser_download_url: 'browserDownloadUrl'
      }
    });

    getReleaseByTag = jest.fn().mockReturnValueOnce({
      data: {
        upload_url: 'upload_url'
      }
    });

    getRelease = jest.fn().mockReturnValueOnce({
      data: {
        upload_url: 'upload_url'
      }
    });

    fs.statSync = jest.fn().mockReturnValueOnce({
      size: 527
    });

    content = Buffer.from('test content');
    fs.readFileSync = jest.fn().mockReturnValueOnce(content);

    context.repo = {
      owner: 'owner',
      repo: 'repo'
    };

    context.ref = 'refs/tags/release_tag';

    const github = {
      repos: {
        getReleaseByTag,
        getRelease,
        uploadReleaseAsset
      }
    };

    GitHub.mockImplementation(() => github);
  });

  test('Upload release asset endpoint is called via upload_url', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce('upload_url')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    await run();

    expect(uploadReleaseAsset).toHaveBeenCalledWith({
      url: 'upload_url',
      headers: { 'content-type': 'asset_content_type', 'content-length': 527 },
      name: 'asset_name',
      file: content
    });
  });

  test('Upload release asset endpoint is called via release_tag', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('release_tag')
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    await run();

    expect(uploadReleaseAsset).toHaveBeenCalledWith({
      url: 'upload_url',
      headers: { 'content-type': 'asset_content_type', 'content-length': 527 },
      name: 'asset_name',
      file: content
    });
  });

  test('Upload release asset endpoint is called via default release_tag', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    await run();

    expect(uploadReleaseAsset).toHaveBeenCalledWith({
      url: 'upload_url',
      headers: { 'content-type': 'asset_content_type', 'content-length': 527 },
      name: 'asset_name',
      file: content
    });
  });

  test('Not a release with a release tag', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('release_tag')
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    context.ref = null;

    await run();

    expect(uploadReleaseAsset).toHaveBeenCalledWith({
      url: 'upload_url',
      headers: { 'content-type': 'asset_content_type', 'content-length': 527 },
      name: 'asset_name',
      file: content
    });
  });

  test('Use the latest release', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    context.ref = null;

    getReleaseByTag.mockRestore();
    getReleaseByTag.mockReturnValueOnce({
      data: {
        upload_url: null
      }
    });

    await run();

    expect(uploadReleaseAsset).toHaveBeenCalledWith({
      url: 'upload_url',
      headers: { 'content-type': 'asset_content_type', 'content-length': 527 },
      name: 'asset_name',
      file: content
    });
  });

  test('Output is set', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce('upload_url')
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    core.setOutput = jest.fn();

    await run();

    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'browser_download_url', 'browserDownloadUrl');
  });

  test('Unable to get upload URL', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);

    context.ref = null;

    getReleaseByTag.mockRestore();
    getReleaseByTag.mockReturnValueOnce({
      data: {
        upload_url: null
      }
    });

    getRelease.mockRestore();
    getRelease.mockReturnValueOnce({
      data: {
        upload_url: null
      }
    });

    await run();

    expect(getRelease).toHaveBeenCalled();
    expect(core.setFailed).toHaveBeenCalledWith('Unable to get the upload URL');
  });

  test('Upload fails elegantly', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('upload_url')
      .mockReturnValueOnce('asset_path')
      .mockReturnValueOnce('asset_name')
      .mockReturnValueOnce('asset_content_type');

    uploadReleaseAsset.mockRestore();
    uploadReleaseAsset.mockImplementation(() => {
      throw new Error('Error uploading release asset');
    });

    core.setOutput = jest.fn();
    core.setFailed = jest.fn();

    await run();

    expect(uploadReleaseAsset).toHaveBeenCalled();
    expect(core.setFailed).toHaveBeenCalledWith('Error uploading release asset');
    expect(core.setOutput).toHaveBeenCalledTimes(0);
  });
});
