from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from agents.verifier.router import router as verifier_router
from agents.generator.router import router as generator_router
from agents.translator.router import router as translator_router

app = FastAPI(
    title="PayCrow AI Agents",
    description="Unified modular backend for PayCrow AI Agents.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(verifier_router, tags=["Verifier"])
app.include_router(generator_router, tags=["Generator"])
app.include_router(translator_router, tags=["Translator"])

@app.get("/health", summary="Health check")
async def health() -> dict:
    return {"status": "ok", "service": "paycrow-ai-agents", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
