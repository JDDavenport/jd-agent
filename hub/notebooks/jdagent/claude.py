"""
JD Agent Claude Helper - AI-powered data analysis from notebooks.

Provides convenient Claude integration with data analysis utilities.
"""

import os
from typing import Optional, Any, List, Dict, Union
import json


class ClaudeHelper:
    """
    Claude AI helper for data analysis in Jupyter notebooks.

    Provides convenient methods for analyzing data, generating code,
    and getting insights from Claude.

    Usage:
        from jdagent import claude

        # Analyze a dataframe
        insights = claude.analyze(df, "What trends do you see?")

        # Get code suggestions
        code = claude.suggest_code("Create a bar chart of sales by region")

        # Chat conversation
        response = claude.chat("Explain the p-value in simple terms")
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-sonnet-4-20250514"):
        """
        Initialize Claude helper.

        Args:
            api_key: Anthropic API key. Defaults to ANTHROPIC_API_KEY env var.
            model: Model to use. Defaults to claude-sonnet-4-20250514.
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model
        self._client = None

    @property
    def client(self):
        """Lazy-load the Anthropic client."""
        if self._client is None:
            if not self.api_key:
                raise ValueError(
                    "ANTHROPIC_API_KEY environment variable not set. "
                    "Set it or pass api_key to ClaudeHelper."
                )
            try:
                from anthropic import Anthropic
                self._client = Anthropic(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "anthropic package not installed. "
                    "Install with: pip install anthropic"
                )
        return self._client

    def chat(
        self,
        message: str,
        system: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        """
        Send a chat message to Claude.

        Args:
            message: The message to send.
            system: Optional system prompt.
            max_tokens: Maximum tokens in response.

        Returns:
            Claude's response text.
        """
        messages = [{"role": "user", "content": message}]

        response = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system or "You are a helpful data science assistant.",
            messages=messages,
        )

        return response.content[0].text

    def analyze(
        self,
        data: Any,
        question: str,
        context: Optional[str] = None,
    ) -> str:
        """
        Analyze data with Claude.

        Args:
            data: Data to analyze (DataFrame, dict, list, or string).
            question: Question about the data.
            context: Optional additional context.

        Returns:
            Claude's analysis.
        """
        # Format data for the prompt
        data_str = self._format_data(data)

        prompt = f"""Analyze the following data and answer the question.

DATA:
{data_str}

QUESTION: {question}
"""
        if context:
            prompt += f"\nCONTEXT: {context}"

        system = """You are an expert data analyst. Analyze the provided data thoroughly and give clear, actionable insights. When appropriate, suggest visualizations or further analysis that might be helpful."""

        return self.chat(prompt, system=system)

    def suggest_code(
        self,
        task: str,
        context: Optional[str] = None,
        data_description: Optional[str] = None,
    ) -> str:
        """
        Get Python code suggestions for a data task.

        Args:
            task: Description of what you want to accomplish.
            context: Optional context about your environment.
            data_description: Optional description of your data.

        Returns:
            Python code suggestion.
        """
        prompt = f"""Write Python code to: {task}

Use these libraries as available:
- pandas for data manipulation
- matplotlib/seaborn for visualization
- scikit-learn for ML
- numpy for numerical operations
"""
        if data_description:
            prompt += f"\nData description: {data_description}"
        if context:
            prompt += f"\nContext: {context}"

        prompt += "\nProvide clean, well-commented code."

        system = """You are an expert Python programmer specializing in data science. Write clean, efficient code with helpful comments. Use best practices and modern Python idioms."""

        return self.chat(prompt, system=system)

    def explain(self, topic: str, level: str = "intermediate") -> str:
        """
        Get an explanation of a data science topic.

        Args:
            topic: Topic to explain.
            level: Explanation level ('beginner', 'intermediate', 'advanced').

        Returns:
            Explanation text.
        """
        system = f"""You are an expert data science educator. Explain concepts at a {level} level, using practical examples and analogies where helpful."""

        return self.chat(f"Explain: {topic}", system=system)

    def summarize_dataframe(self, df: Any, name: str = "DataFrame") -> str:
        """
        Get a summary analysis of a pandas DataFrame.

        Args:
            df: Pandas DataFrame to summarize.
            name: Name to refer to the dataframe.

        Returns:
            Summary analysis.
        """
        # Get basic info
        info = {
            "shape": str(df.shape),
            "columns": list(df.columns),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "missing": df.isnull().sum().to_dict(),
            "sample": df.head(5).to_string(),
        }

        # Get numeric stats if any numeric columns
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            info["numeric_stats"] = df[numeric_cols].describe().to_string()

        prompt = f"""Summarize this {name} and provide key insights:

METADATA:
- Shape: {info['shape']}
- Columns: {info['columns']}
- Data types: {info['dtypes']}
- Missing values: {info['missing']}

NUMERIC STATISTICS:
{info.get('numeric_stats', 'No numeric columns')}

SAMPLE DATA:
{info['sample']}

Provide:
1. A brief overview of the data
2. Data quality observations
3. Key patterns or distributions
4. Suggestions for analysis or cleaning
"""
        system = """You are a data analyst reviewing a new dataset. Provide practical, actionable insights."""

        return self.chat(prompt, system=system)

    def _format_data(self, data: Any) -> str:
        """Format data for prompts."""
        # Handle pandas DataFrame
        try:
            import pandas as pd
            if isinstance(data, pd.DataFrame):
                return f"DataFrame with {len(data)} rows and {len(data.columns)} columns:\n{data.to_string(max_rows=20)}"
        except ImportError:
            pass

        # Handle dict/list
        if isinstance(data, (dict, list)):
            return json.dumps(data, indent=2, default=str)[:5000]

        # Handle string
        if isinstance(data, str):
            return data[:5000]

        # Fallback
        return str(data)[:5000]

    def is_configured(self) -> bool:
        """Check if Claude is properly configured."""
        return bool(self.api_key)
