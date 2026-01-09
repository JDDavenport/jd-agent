"""
Voice Embedding Service

FastAPI service for extracting speaker embeddings using pyannote-audio.
Provides REST endpoints for embedding extraction from audio files or segments.
"""

import os
import uuid
import tempfile
from typing import List, Optional
from contextlib import asynccontextmanager

import httpx
import numpy as np
from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel

from embedding_service import SpeakerEmbeddingService

# Global service instance
embedding_service: Optional[SpeakerEmbeddingService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize embedding service on startup."""
    global embedding_service

    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        print("WARNING: HF_TOKEN not set. pyannote-audio may not work properly.")

    print("Loading pyannote embedding model...")
    embedding_service = SpeakerEmbeddingService(hf_token=hf_token)
    print("Model loaded successfully!")

    yield

    # Cleanup
    embedding_service = None


app = FastAPI(
    title="Voice Embedding Service",
    description="Extract speaker embeddings using pyannote-audio",
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================
# Request/Response Models
# ============================================

class SegmentRequest(BaseModel):
    """Request to extract embedding from audio segment."""
    audio_url: str
    start_seconds: float
    end_seconds: float


class EmbeddingResponse(BaseModel):
    """Response containing extracted embedding."""
    embedding: List[float]
    duration_seconds: float
    model: str = "pyannote-embedding"
    dimensions: int = 512


class BatchSegment(BaseModel):
    """Single segment in a batch request."""
    speaker_id: int
    start: float
    end: float


class BatchSegmentRequest(BaseModel):
    """Request to extract embeddings for multiple segments."""
    audio_url: str
    segments: List[BatchSegment]


class BatchEmbeddingResult(BaseModel):
    """Single result in batch response."""
    speaker_id: int
    embedding: List[float]
    duration: float


class BatchEmbeddingResponse(BaseModel):
    """Response containing multiple embeddings."""
    embeddings: List[BatchEmbeddingResult]
    model: str = "pyannote-embedding"


class SimilarityRequest(BaseModel):
    """Request to compute similarity between embeddings."""
    embedding1: List[float]
    embedding2: List[float]


class SimilarityResponse(BaseModel):
    """Response containing similarity score."""
    similarity: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model: str
    ready: bool


# ============================================
# Helper Functions
# ============================================

async def download_audio(url: str) -> str:
    """Download audio from URL to temporary file."""
    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.get(url)
        response.raise_for_status()

        # Determine extension from content type
        content_type = response.headers.get("content-type", "audio/mpeg")
        ext = ".mp3"
        if "wav" in content_type:
            ext = ".wav"
        elif "m4a" in content_type or "mp4" in content_type:
            ext = ".m4a"
        elif "flac" in content_type:
            ext = ".flac"

        # Write to temp file
        temp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{ext}")
        with open(temp_path, "wb") as f:
            f.write(response.content)

        return temp_path


# ============================================
# API Endpoints
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if service is healthy and model is loaded."""
    return HealthResponse(
        status="healthy" if embedding_service else "initializing",
        model="pyannote-embedding",
        ready=embedding_service is not None,
    )


@app.post("/embed/file", response_model=EmbeddingResponse)
async def embed_file(file: UploadFile = File(...)):
    """Extract embedding from uploaded audio file."""
    if not embedding_service:
        raise HTTPException(status_code=503, detail="Service not ready")

    # Save uploaded file temporarily
    ext = os.path.splitext(file.filename or ".wav")[1] or ".wav"
    temp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{ext}")

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        embedding, duration = embedding_service.extract_embedding(temp_path)

        return EmbeddingResponse(
            embedding=embedding.tolist(),
            duration_seconds=duration,
            dimensions=len(embedding),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/embed/segment", response_model=EmbeddingResponse)
async def embed_segment(request: SegmentRequest):
    """Extract embedding from audio segment at URL."""
    if not embedding_service:
        raise HTTPException(status_code=503, detail="Service not ready")

    temp_path = None
    try:
        # Download audio
        temp_path = await download_audio(request.audio_url)

        # Extract from segment
        embedding = embedding_service.extract_from_segment(
            temp_path,
            request.start_seconds,
            request.end_seconds,
        )

        duration = request.end_seconds - request.start_seconds

        return EmbeddingResponse(
            embedding=embedding.tolist(),
            duration_seconds=duration,
            dimensions=len(embedding),
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Failed to download audio: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/embed/batch", response_model=BatchEmbeddingResponse)
async def embed_batch(request: BatchSegmentRequest):
    """Extract embeddings for multiple segments from same audio."""
    if not embedding_service:
        raise HTTPException(status_code=503, detail="Service not ready")

    temp_path = None
    try:
        # Download audio once
        temp_path = await download_audio(request.audio_url)

        results = []
        for seg in request.segments:
            try:
                embedding = embedding_service.extract_from_segment(
                    temp_path,
                    seg.start,
                    seg.end,
                )
                results.append(BatchEmbeddingResult(
                    speaker_id=seg.speaker_id,
                    embedding=embedding.tolist(),
                    duration=seg.end - seg.start,
                ))
            except Exception as e:
                print(f"Warning: Failed to extract segment for speaker {seg.speaker_id}: {e}")
                # Continue with other segments

        return BatchEmbeddingResponse(embeddings=results)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Failed to download audio: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/similarity", response_model=SimilarityResponse)
async def compute_similarity(request: SimilarityRequest):
    """Compute cosine similarity between two embeddings."""
    try:
        emb1 = np.array(request.embedding1)
        emb2 = np.array(request.embedding2)

        similarity = float(
            np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
        )

        return SimilarityResponse(similarity=similarity)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
