"""Provider-agnostic LLM client. Switch via LLM_PROVIDER env var."""
import os
import json
import anthropic
from openai import OpenAI

_PROVIDER = os.getenv("LLM_PROVIDER", "deepseek")

# Model aliases per provider
_MODELS = {
    "deepseek": {
        "extraction": "deepseek-chat",   # DeepSeek-V3
        "judge":      "deepseek-chat",
    },
    "anthropic": {
        "extraction": "claude-sonnet-4-6",
        "judge":      "claude-haiku-4-5-20251001",
    },
}


def _get_models() -> dict:
    return _MODELS.get(_PROVIDER, _MODELS["anthropic"])


def chat(system: str, user: str, max_tokens: int = 4096, role: str = "extraction") -> str:
    """
    Send a chat request to the configured LLM provider.
    role: "extraction" | "judge" — selects the right model tier per provider.
    Returns the assistant's text content.
    """
    model = _get_models()[role]

    if _PROVIDER == "deepseek":
        client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com",
        )
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content

    else:  # anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text
