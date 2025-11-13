#!/usr/bin/env python3
"""
GitHub Copilot Metrics Dashboard - FastAPI Backend
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Load environment variables
load_dotenv()

app = FastAPI(title="GitHub Copilot Metrics Dashboard")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_ORG = os.getenv("GITHUB_ORG")
GITHUB_ENTERPRISE = os.getenv("GITHUB_ENTERPRISE")
PORT = int(os.getenv("PORT", 8000))

# GitHub API configuration
GITHUB_API_BASE = "https://api.github.com"
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


async def fetch_github_api(endpoint: str) -> dict:
    """Fetch data from GitHub API"""
    url = f"{GITHUB_API_BASE}{endpoint}"

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=HEADERS, timeout=30.0)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"GitHub API error: {response.text}",
            )

        return response.json()


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "configured": bool(GITHUB_TOKEN and GITHUB_ORG),
        "organization": GITHUB_ORG or "not configured",
        "enterprise": GITHUB_ENTERPRISE or "not configured",
    }


@app.get("/api/metrics/usage")
async def get_usage_metrics(
    since: Optional[str] = None,
    until: Optional[str] = None,
):
    """Get Copilot usage metrics for organization"""
    if not GITHUB_TOKEN or not GITHUB_ORG:
        raise HTTPException(
            status_code=500,
            detail="GitHub token or organization not configured. Please set GITHUB_TOKEN and GITHUB_ORG in .env file.",
        )

    # Default date range: last 28 days
    if not since:
        since = (datetime.now() - timedelta(days=28)).strftime("%Y-%m-%d")
    if not until:
        until = datetime.now().strftime("%Y-%m-%d")

    # Construct endpoint
    if GITHUB_ENTERPRISE:
        endpoint = f"/enterprises/{GITHUB_ENTERPRISE}/copilot/usage"
    else:
        endpoint = f"/orgs/{GITHUB_ORG}/copilot/usage"

    endpoint += f"?since={since}&until={until}"

    try:
        data = await fetch_github_api(endpoint)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/seats")
async def get_seat_information():
    """Get Copilot seat information"""
    if not GITHUB_TOKEN or not GITHUB_ORG:
        raise HTTPException(
            status_code=500,
            detail="GitHub token or organization not configured",
        )

    # Construct endpoint
    if GITHUB_ENTERPRISE:
        endpoint = f"/enterprises/{GITHUB_ENTERPRISE}/copilot/billing/seats"
    else:
        endpoint = f"/orgs/{GITHUB_ORG}/copilot/billing/seats"

    try:
        data = await fetch_github_api(endpoint)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Mount static files
app.mount("/static", StaticFiles(directory="public"), name="static")


@app.get("/")
async def read_root():
    """Serve index.html"""
    return FileResponse("public/index.html")


if __name__ == "__main__":
    import uvicorn

    print(f"Server running on http://localhost:{PORT}")
    print(f"GitHub Org: {GITHUB_ORG or 'NOT CONFIGURED'}")
    print(f"GitHub Enterprise: {GITHUB_ENTERPRISE or 'NOT CONFIGURED'}")

    if not GITHUB_TOKEN or not GITHUB_ORG:
        print("\n⚠️  WARNING: Please configure GITHUB_TOKEN and GITHUB_ORG in .env file")

    uvicorn.run(app, host="0.0.0.0", port=PORT)
