"""
Judge0 Router — Code execution via Judge0 API.
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# Judge0 CE (Community Edition) API endpoint
JUDGE0_API_URL = os.getenv("JUDGE0_API_URL", "https://judge0-ce.p.rapidapi.com")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY", "")
JUDGE0_API_HOST = os.getenv("JUDGE0_API_HOST", "judge0-ce.p.rapidapi.com")

# Language ID mapping for Judge0
LANGUAGE_IDS = {
    "javascript": 63,  # Node.js
    "python": 71,      # Python 3
    "java": 62,        # Java
    "cpp": 54,         # C++ (GCC 9.2.0)
    "c": 50,           # C (GCC 9.2.0)
    "csharp": 51,      # C# (Mono 6.6.0.161)
    "go": 60,          # Go
    "rust": 73,        # Rust
    "ruby": 72,        # Ruby
    "php": 68,         # PHP
    "typescript": 74,  # TypeScript
    "kotlin": 78,      # Kotlin
    "swift": 83,       # Swift
    "r": 80,           # R
    "sql": 82,         # SQL (SQLite)
    "bash": 46,        # Bash
}


class CodeExecutionRequest(BaseModel):
    source_code: str
    language: str
    stdin: Optional[str] = ""
    expected_output: Optional[str] = None


class CodeExecutionResponse(BaseModel):
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    message: Optional[str] = None
    status: dict
    time: Optional[str] = None
    memory: Optional[int] = None


@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    Execute code using Judge0 API.
    """
    # Get language ID
    language_id = LANGUAGE_IDS.get(request.language.lower())
    if not language_id:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {request.language}. Supported: {', '.join(LANGUAGE_IDS.keys())}"
        )

    # Prepare submission
    submission_data = {
        "source_code": request.source_code,
        "language_id": language_id,
        "stdin": request.stdin or "",
    }

    if request.expected_output:
        submission_data["expected_output"] = request.expected_output

    headers = {
        "content-type": "application/json",
    }

    # Add RapidAPI headers if using RapidAPI
    if JUDGE0_API_KEY:
        headers["X-RapidAPI-Key"] = JUDGE0_API_KEY
        headers["X-RapidAPI-Host"] = JUDGE0_API_HOST

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Create submission
            response = await client.post(
                f"{JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true",
                json=submission_data,
                headers=headers,
            )
            response.raise_for_status()
            result = response.json()

            return CodeExecutionResponse(
                stdout=result.get("stdout"),
                stderr=result.get("stderr"),
                compile_output=result.get("compile_output"),
                message=result.get("message"),
                status=result.get("status", {}),
                time=result.get("time"),
                memory=result.get("memory"),
            )

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Judge0 API error: {e.response.text}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@router.get("/languages")
async def get_supported_languages():
    """
    Get list of supported languages.
    """
    return {
        "languages": [
            {"id": lang_id, "name": lang_name, "display": lang_name.title()}
            for lang_name, lang_id in LANGUAGE_IDS.items()
        ]
    }


@router.get("/status")
async def get_judge0_status():
    """
    Check Judge0 API status.
    """
    headers = {}
    if JUDGE0_API_KEY:
        headers["X-RapidAPI-Key"] = JUDGE0_API_KEY
        headers["X-RapidAPI-Host"] = JUDGE0_API_HOST

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{JUDGE0_API_URL}/about",
                headers=headers,
            )
            response.raise_for_status()
            return {"status": "ok", "judge0": response.json()}
    except Exception as e:
        return {"status": "error", "message": str(e)}
