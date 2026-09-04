import { execSync } from 'child_process';
import { api } from './apiUtils';

export interface GitContext {
  repositoryId: string;
  repositoryName: string;
  branch: string;
  owner: string;
}

interface ParsedGitRemote {
  owner: string;
  repo: string;
  organizationName?: string;
  projectName?: string;
}

interface AzureRepoUrlParts {
  username?: string;
  organization: string;
  project: string;
  repository: string;
  baseUrl: string;
}

// Parse Azure DevOps repository URL to extract its components
// Supports formats:
//  - https://username@dev.azure.com/organization/project/_git/repository
//  - https://dev.azure.com/organization/project/_git/repository
//  - https://organization.visualstudio.com/project/_git/repository
// params:
//  - url (string) - Azure DevOps repository URL
// returns:
//  - AzureRepoUrlParts object with extracted components, or null if invalid URL
function parseAzureRepoUrl(url: string): AzureRepoUrlParts | null {
  if (!url) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    const username = urlObj.username || undefined;

    if (hostname === 'dev.azure.com') {
      const parts = pathname.split('/').filter((p) => p);
      if (parts.length >= 4 && parts[2] === '_git') {
        const organization = decodeURIComponent(parts[0]);
        const project = decodeURIComponent(parts[1]);
        const repository = decodeURIComponent(parts[3]);
        return {
          username,
          organization,
          project,
          repository,
          baseUrl: `https://dev.azure.com/${organization}`
        };
      }
    }

    if (hostname.endsWith('.visualstudio.com')) {
      const organization = hostname.replace('.visualstudio.com', '');
      const parts = pathname.split('/').filter((p) => p);
      if (parts.length >= 3 && parts[1] === '_git') {
        const project = decodeURIComponent(parts[0]);
        const repository = decodeURIComponent(parts[2]);
        return {
          username,
          organization,
          project,
          repository,
          baseUrl: `https://${hostname}`
        };
      }
    }
  } catch {
    // Not a valid URL or not Azure format.
  }

  return null;
}

/**
 * Parses a git remote URL to extract owner and repo name.
 * Supports HTTPS and SSH formats:
 * - GitHub: https://github.com/owner/repo.git
 * - GitHub SSH: git@github.com:owner/repo.git
 * - Azure DevOps: https://[username@]dev.azure.com/organization/project/_git/repository
 */
function parseGitRemoteUrl(remoteUrl: string): ParsedGitRemote {

  const response: ParsedGitRemote = {
    owner: '',
    repo: ''
  };

  // Remove trailing .git if present
  const cleanUrl = remoteUrl.replace(/\.git$/, '');

  const parsedAzure = parseAzureRepoUrl(cleanUrl);
  if (parsedAzure) {
    return {
      owner: parsedAzure.username || '',
      repo: parsedAzure.repository,
      organizationName: parsedAzure.organization,
      projectName: parsedAzure.project
    };
  }
  
  // Match HTTPS format: https://github.com/owner/repo
  const httpsMatch = cleanUrl.match(/https?:\/\/[^\/]+\/([^\/]+)\/([^\/]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  
  // Match SSH format: git@github.com:owner/repo
  const sshMatch = cleanUrl.match(/git@[^:]+:([^\/]+)\/(.+)/);
  if (sshMatch) {
    response.owner = sshMatch[1];
    response.repo = sshMatch[2];
  }
  
  return response;
}

// This function retrieves the current git context, including the repository ID, branch name, and commit SHA.
// It uses the GitHub API to fetch the repository ID based on the owner and repo name extracted from the git remote URL.
export async function getGitContext(access_token: string): Promise<GitContext> {
  let branch: string;
  let remoteUrl: string;

  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim() || 'unknown-branch';
    remoteUrl = execSync('git config --get remote.origin.url', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    console.warn('Warning: Not a git repository. Repository context will not be available.');
    return { repositoryId: '0', repositoryName: 'unknown', branch: 'unknown-branch', owner: 'unknown-owner' };
  }

  // Get owner and repo from git remote URL
  const { owner, repo } = parseGitRemoteUrl(remoteUrl);

  const body = {
   "owner": owner,
    "name": repo
  }
  const response = await api.post('/repository/get', access_token , body);
  const repoData = await response?.data;
  return {
    repositoryId: repoData?.id?.toString() || "0",
    repositoryName: repo,
    branch,
    owner: repoData?.owner || 'unknown-owner'
  };
}
