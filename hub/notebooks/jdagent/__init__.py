"""
JD Agent - Python Utilities for Jupyter Notebooks

Provides convenient access to JD Agent services from within notebooks:
- hub: Access tasks, projects, calendar, and other hub data
- claude: Pre-configured Claude AI helper for data analysis
- vault: Search and create vault entries

Usage:
    from jdagent import hub, claude, vault

    # Get today's tasks
    tasks = hub.tasks.list(status='today')

    # Query the vault
    results = vault.search('machine learning')

    # Analyze data with Claude
    response = claude.analyze(my_dataframe, "What trends do you see?")
"""

from .hub import HubClient
from .claude import ClaudeHelper
from .vault import VaultClient

# Create singleton instances
hub = HubClient()
claude = ClaudeHelper()
vault = VaultClient()

__version__ = "0.1.0"
__all__ = ["hub", "claude", "vault", "HubClient", "ClaudeHelper", "VaultClient"]
