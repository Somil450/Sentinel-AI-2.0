#!/usr/bin/env python3
"""
Build-time real data fetcher for Vercel.
Run this script locally to fetch real outbreak data and save it as
frontend/api/backend/data/real_data_snapshot.json

This snapshot is embedded in the deployment and served as the initial
dataset. The frontend can call /api/refresh to update it on demand.
"""

import sys
import os
import json

# Add the backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from real_data_fetcher import fetch_all_real_data, get_real_data_summary

print("Fetching real outbreak data from all sources...")
reports = fetch_all_real_data(force=True)

output_path = os.path.join(os.path.dirname(__file__), 'backend', 'data', 'real_data_snapshot.json')

snapshot = {
    "reports": reports,
    "summary": get_real_data_summary(),
}

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(snapshot, f, indent=2, default=str)

print(f"Saved {len(reports)} real reports to {output_path}")
