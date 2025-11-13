require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG;
const GITHUB_ENTERPRISE = process.env.GITHUB_ENTERPRISE;

// Helper function to fetch from GitHub API
async function fetchGitHubAPI(endpoint) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// API Routes

// Get Copilot usage metrics for organization
app.get('/api/metrics/usage', async (req, res) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_ORG) {
      return res.status(500).json({
        error: 'GitHub token or organization not configured. Please set GITHUB_TOKEN and GITHUB_ORG in .env file.'
      });
    }

    const since = req.query.since || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = req.query.until || new Date().toISOString().split('T')[0];

    const endpoint = GITHUB_ENTERPRISE
      ? `/enterprises/${GITHUB_ENTERPRISE}/copilot/usage`
      : `/orgs/${GITHUB_ORG}/copilot/usage`;

    const data = await fetchGitHubAPI(`${endpoint}?since=${since}&until=${until}`);
    res.json(data);
  } catch (error) {
    console.error('Error fetching Copilot usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Copilot seat information
app.get('/api/metrics/seats', async (req, res) => {
  try {
    if (!GITHUB_TOKEN || !GITHUB_ORG) {
      return res.status(500).json({
        error: 'GitHub token or organization not configured'
      });
    }

    const endpoint = GITHUB_ENTERPRISE
      ? `/enterprises/${GITHUB_ENTERPRISE}/copilot/billing/seats`
      : `/orgs/${GITHUB_ORG}/copilot/billing/seats`;

    const data = await fetchGitHubAPI(endpoint);
    res.json(data);
  } catch (error) {
    console.error('Error fetching Copilot seats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!(GITHUB_TOKEN && GITHUB_ORG),
    organization: GITHUB_ORG || 'not configured',
    enterprise: GITHUB_ENTERPRISE || 'not configured'
  });
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`GitHub Org: ${GITHUB_ORG || 'NOT CONFIGURED'}`);
  console.log(`GitHub Enterprise: ${GITHUB_ENTERPRISE || 'NOT CONFIGURED'}`);
  if (!GITHUB_TOKEN || !GITHUB_ORG) {
    console.warn('\n⚠️  WARNING: Please configure GITHUB_TOKEN and GITHUB_ORG in .env file');
  }
});
