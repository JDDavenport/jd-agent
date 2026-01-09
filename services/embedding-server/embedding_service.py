"""
Speaker Embedding Service

Core logic for extracting speaker embeddings using pyannote-audio.
"""

import os
import uuid
import tempfile
from typing import Optional, Tuple

import numpy as np
import torch
import torchaudio


class SpeakerEmbeddingService:
    """Service for extracting speaker embeddings using pyannote-audio."""

    def __init__(self, hf_token: Optional[str] = None):
        """
        Initialize the embedding service.

        Args:
            hf_token: HuggingFace token for accessing pyannote models.
                     Required for pyannote-audio models.
        """
        self.hf_token = hf_token
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._model = None
        self._inference = None

        print(f"Using device: {self.device}")

    @property
    def model(self):
        """Lazy load the model on first use."""
        if self._model is None:
            from pyannote.audio import Model

            self._model = Model.from_pretrained(
                "pyannote/embedding",
                use_auth_token=self.hf_token,
            )
            self._model = self._model.to(self.device)
            self._model.eval()
        return self._model

    @property
    def inference(self):
        """Lazy load the inference pipeline on first use."""
        if self._inference is None:
            from pyannote.audio import Inference

            self._inference = Inference(
                self.model,
                window="whole",
                device=self.device,
            )
        return self._inference

    def extract_embedding(self, audio_path: str) -> Tuple[np.ndarray, float]:
        """
        Extract 512-dim embedding from audio file.

        Args:
            audio_path: Path to audio file.

        Returns:
            Tuple of (embedding array, duration in seconds)
        """
        # Get audio duration
        info = torchaudio.info(audio_path)
        duration = info.num_frames / info.sample_rate

        # Extract embedding
        embedding = self.inference(audio_path)
        embedding_array = embedding.data.flatten()

        return embedding_array, duration

    def extract_from_segment(
        self,
        audio_path: str,
        start_seconds: float,
        end_seconds: float,
    ) -> np.ndarray:
        """
        Extract embedding from specific segment of audio.

        Args:
            audio_path: Path to audio file.
            start_seconds: Start time in seconds.
            end_seconds: End time in seconds.

        Returns:
            512-dim embedding array.
        """
        # Load audio
        waveform, sample_rate = torchaudio.load(audio_path)

        # Calculate sample indices
        start_sample = int(start_seconds * sample_rate)
        end_sample = int(end_seconds * sample_rate)

        # Validate bounds
        num_samples = waveform.shape[1]
        start_sample = max(0, min(start_sample, num_samples - 1))
        end_sample = max(start_sample + 1, min(end_sample, num_samples))

        # Extract segment
        segment = waveform[:, start_sample:end_sample]

        # Minimum duration check (need at least ~1 second for reliable embedding)
        min_samples = sample_rate  # 1 second
        if segment.shape[1] < min_samples:
            # Pad with zeros if too short
            padding = min_samples - segment.shape[1]
            segment = torch.nn.functional.pad(segment, (0, padding))

        # Save segment to temp file
        temp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.wav")
        try:
            torchaudio.save(temp_path, segment, sample_rate)
            embedding, _ = self.extract_embedding(temp_path)
            return embedding
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings.

        Args:
            emb1: First embedding vector.
            emb2: Second embedding vector.

        Returns:
            Cosine similarity score between -1 and 1.
        """
        return float(
            np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        )

    def average_embeddings(self, embeddings: list[np.ndarray]) -> np.ndarray:
        """
        Compute average of multiple embeddings.

        Useful for creating a robust speaker profile from multiple samples.

        Args:
            embeddings: List of embedding arrays.

        Returns:
            Average embedding array.
        """
        if not embeddings:
            raise ValueError("Cannot average empty list of embeddings")

        stacked = np.stack(embeddings)
        avg = np.mean(stacked, axis=0)

        # Normalize the average embedding
        avg = avg / np.linalg.norm(avg)

        return avg
