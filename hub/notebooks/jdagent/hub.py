"""
JD Agent Hub Client - Access hub API from Python notebooks.

Provides typed interfaces for accessing tasks, projects, calendar,
people, and other hub data.
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import requests


class TasksAPI:
    """Interface for the tasks API."""

    def __init__(self, base_url: str):
        self.base_url = f"{base_url}/api/tasks"

    def list(
        self,
        status: Optional[str] = None,
        project_id: Optional[str] = None,
        context: Optional[str] = None,
        priority: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        List tasks with optional filters.

        Args:
            status: Filter by status ('inbox', 'next', 'scheduled', 'waiting', 'someday', 'done')
            project_id: Filter by project
            context: Filter by context ('class', 'personal', 'work')
            priority: Filter by priority (0-4)
            limit: Max results to return
            offset: Pagination offset

        Returns:
            List of task dictionaries
        """
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        if project_id:
            params["projectId"] = project_id
        if context:
            params["context"] = context
        if priority is not None:
            params["priority"] = priority

        response = requests.get(self.base_url, params=params)
        response.raise_for_status()
        return response.json().get("data", [])

    def today(self) -> List[Dict[str, Any]]:
        """Get tasks due today or scheduled for today."""
        return self.list(status="next")

    def inbox(self) -> List[Dict[str, Any]]:
        """Get inbox tasks (unclarified)."""
        return self.list(status="inbox")

    def get(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific task by ID."""
        response = requests.get(f"{self.base_url}/{task_id}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json().get("data")

    def create(
        self,
        title: str,
        description: Optional[str] = None,
        status: str = "inbox",
        priority: int = 0,
        due_date: Optional[datetime] = None,
        project_id: Optional[str] = None,
        context: str = "personal",
    ) -> Dict[str, Any]:
        """Create a new task."""
        data = {
            "title": title,
            "status": status,
            "priority": priority,
            "context": context,
        }
        if description:
            data["description"] = description
        if due_date:
            data["dueDate"] = due_date.isoformat()
        if project_id:
            data["projectId"] = project_id

        response = requests.post(self.base_url, json=data)
        response.raise_for_status()
        return response.json().get("data")


class ProjectsAPI:
    """Interface for the projects API."""

    def __init__(self, base_url: str):
        self.base_url = f"{base_url}/api/projects"

    def list(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all projects."""
        params = {}
        if status:
            params["status"] = status
        response = requests.get(self.base_url, params=params)
        response.raise_for_status()
        return response.json().get("data", [])

    def get(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific project."""
        response = requests.get(f"{self.base_url}/{project_id}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json().get("data")


class CalendarAPI:
    """Interface for the calendar API."""

    def __init__(self, base_url: str):
        self.base_url = f"{base_url}/api/calendar"

    def events(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get calendar events."""
        params = {"limit": limit}
        if start_date:
            params["startDate"] = start_date.isoformat()
        if end_date:
            params["endDate"] = end_date.isoformat()

        response = requests.get(f"{self.base_url}/events", params=params)
        response.raise_for_status()
        return response.json().get("data", [])

    def today(self) -> List[Dict[str, Any]]:
        """Get today's events."""
        today = date.today()
        return self.events(start_date=today, end_date=today)


class PeopleAPI:
    """Interface for the people API."""

    def __init__(self, base_url: str):
        self.base_url = f"{base_url}/api/people"

    def list(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List all people."""
        response = requests.get(self.base_url, params={"limit": limit})
        response.raise_for_status()
        return response.json().get("data", [])

    def search(self, query: str) -> List[Dict[str, Any]]:
        """Search people by name."""
        response = requests.get(f"{self.base_url}/search", params={"q": query})
        response.raise_for_status()
        return response.json().get("data", [])


class GoalsAPI:
    """Interface for the goals API."""

    def __init__(self, base_url: str):
        self.base_url = f"{base_url}/api/goals"

    def list(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all goals."""
        params = {}
        if status:
            params["status"] = status
        response = requests.get(self.base_url, params=params)
        response.raise_for_status()
        return response.json().get("data", [])


class HubClient:
    """
    Main client for accessing the JD Agent hub API.

    Provides access to tasks, projects, calendar, people, and goals.

    Usage:
        from jdagent import hub

        # Get today's tasks
        tasks = hub.tasks.today()

        # Get all projects
        projects = hub.projects.list()

        # Get today's calendar events
        events = hub.calendar.today()
    """

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize the hub client.

        Args:
            base_url: Base URL for the hub API. Defaults to HUB_API_URL env var
                      or http://localhost:3000
        """
        self.base_url = base_url or os.getenv("HUB_API_URL", "http://localhost:3000")

        # Initialize sub-clients
        self.tasks = TasksAPI(self.base_url)
        self.projects = ProjectsAPI(self.base_url)
        self.calendar = CalendarAPI(self.base_url)
        self.people = PeopleAPI(self.base_url)
        self.goals = GoalsAPI(self.base_url)

    def health(self) -> Dict[str, Any]:
        """Check if the hub is healthy."""
        response = requests.get(f"{self.base_url}/api/health")
        response.raise_for_status()
        return response.json()

    def is_connected(self) -> bool:
        """Check if we can connect to the hub."""
        try:
            self.health()
            return True
        except Exception:
            return False
