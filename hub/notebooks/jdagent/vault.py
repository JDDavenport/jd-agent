"""
JD Agent Vault Client - Access vault knowledge base from notebooks.

Provides search, retrieval, and creation of vault entries.
"""

import os
from typing import Optional, List, Dict, Any
import requests


class VaultClient:
    """
    Client for accessing the JD Agent vault (knowledge base).

    Provides search, retrieval, and creation of vault entries.

    Usage:
        from jdagent import vault

        # Search the vault
        results = vault.search("machine learning")

        # Get a specific entry
        entry = vault.get("entry-id-here")

        # Create a new entry
        vault.create(
            title="Analysis Results",
            content="...",
            tags=["analysis", "q1-2024"]
        )
    """

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize the vault client.

        Args:
            base_url: Base URL for the hub API. Defaults to HUB_API_URL env var.
        """
        self.base_url = base_url or os.getenv("HUB_API_URL", "http://localhost:3000")
        self.api_url = f"{self.base_url}/api/vault"

    def search(
        self,
        query: str,
        content_type: Optional[str] = None,
        context: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 20,
        semantic: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Search the vault.

        Args:
            query: Search query string.
            content_type: Filter by content type (note, article, etc.).
            context: Filter by context.
            tags: Filter by tags.
            limit: Max results to return.
            semantic: Use semantic (AI) search instead of full-text.

        Returns:
            List of matching vault entries.
        """
        params = {"q": query, "limit": limit}
        if content_type:
            params["contentType"] = content_type
        if context:
            params["context"] = context
        if tags:
            params["tags"] = ",".join(tags)
        if semantic:
            params["mode"] = "semantic"

        response = requests.get(f"{self.api_url}/search", params=params)
        response.raise_for_status()
        return response.json().get("data", [])

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific vault entry by ID.

        Args:
            entry_id: The entry ID.

        Returns:
            Entry dict or None if not found.
        """
        response = requests.get(f"{self.api_url}/{entry_id}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json().get("data")

    def list(
        self,
        content_type: Optional[str] = None,
        context: Optional[str] = None,
        source: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        List vault entries with optional filters.

        Args:
            content_type: Filter by content type.
            context: Filter by context.
            source: Filter by source (remarkable, plaud, manual, etc.).
            limit: Max results.
            offset: Pagination offset.

        Returns:
            List of vault entries.
        """
        params = {"limit": limit, "offset": offset}
        if content_type:
            params["contentType"] = content_type
        if context:
            params["context"] = context
        if source:
            params["source"] = source

        response = requests.get(self.api_url, params=params)
        response.raise_for_status()
        return response.json().get("data", [])

    def create(
        self,
        title: str,
        content: str,
        content_type: str = "note",
        context: str = "data-analysis",
        source: str = "jupyter",
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Create a new vault entry.

        Args:
            title: Entry title.
            content: Entry content (markdown).
            content_type: Type of content.
            context: Context category.
            source: Source identifier.
            tags: Optional tags.

        Returns:
            Created entry dict.
        """
        data = {
            "title": title,
            "content": content,
            "contentType": content_type,
            "context": context,
            "source": source,
            "tags": tags or [],
        }

        response = requests.post(self.api_url, json=data)
        response.raise_for_status()
        return response.json().get("data")

    def update(
        self,
        entry_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Update an existing vault entry.

        Args:
            entry_id: Entry ID to update.
            title: New title (optional).
            content: New content (optional).
            tags: New tags (optional).

        Returns:
            Updated entry dict.
        """
        data = {}
        if title:
            data["title"] = title
        if content:
            data["content"] = content
        if tags is not None:
            data["tags"] = tags

        response = requests.patch(f"{self.api_url}/{entry_id}", json=data)
        response.raise_for_status()
        return response.json().get("data")

    def save_analysis(
        self,
        title: str,
        content: str,
        dataframe_info: Optional[str] = None,
        code: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Save an analysis to the vault.

        Convenience method for saving notebook analysis results.

        Args:
            title: Title for the analysis.
            content: Main analysis content/findings.
            dataframe_info: Optional info about the data used.
            code: Optional code used in the analysis.
            tags: Optional tags.

        Returns:
            Created vault entry.
        """
        # Build full content
        full_content = f"# {title}\n\n{content}"

        if dataframe_info:
            full_content += f"\n\n## Data\n{dataframe_info}"

        if code:
            full_content += f"\n\n## Code\n```python\n{code}\n```"

        return self.create(
            title=title,
            content=full_content,
            content_type="notebook",
            context="data-analysis",
            source="jupyter",
            tags=tags or ["analysis"],
        )

    def tags(self) -> List[str]:
        """Get all unique tags in the vault."""
        response = requests.get(f"{self.api_url}/tags")
        response.raise_for_status()
        return response.json().get("data", [])

    def stats(self) -> Dict[str, Any]:
        """Get vault statistics."""
        response = requests.get(f"{self.api_url}/stats")
        response.raise_for_status()
        return response.json().get("data", {})
