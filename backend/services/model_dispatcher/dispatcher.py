import json
import httpx
from typing import AsyncIterator
from backend.database import SessionLocal
from backend.models.channel import Channel
from backend.services.secret_service import decrypt_secret


class ChannelDispatcher:
    def _get_channel(self, provider: str = "", model: str = "") -> tuple[Channel | None, str]:
        db = SessionLocal()
        try:
            channels = db.query(Channel).filter(Channel.status == 1).order_by(Channel.priority.desc()).all()
            if not channels:
                return None, ""

            if provider:
                for ch in channels:
                    if ch.id == provider or ch.name == provider:
                        models = json.loads(ch.models) if ch.models else []
                        m = model or ch.default_model or (models[0] if models else "")
                        return ch, m

            for ch in channels:
                models = json.loads(ch.models) if ch.models else []
                if model and model in models:
                    return ch, model
                if not model:
                    m = ch.default_model or (models[0] if models else "")
                    if m:
                        return ch, m

            return channels[0], model or ""
        finally:
            db.close()

    def get_available_models(self) -> list[dict]:
        db = SessionLocal()
        try:
            channels = db.query(Channel).filter(Channel.status == 1).order_by(Channel.priority.desc()).all()
            result = []
            for ch in channels:
                models = json.loads(ch.models) if ch.models else []
                for m in models:
                    result.append({
                        "model": m,
                        "channel_id": ch.id,
                        "channel_name": ch.name,
                        "channel_type": ch.type,
                    })
            return result
        finally:
            db.close()

    async def generate(self, prompt: str, provider: str = "", model: str = "") -> str:
        ch, m = self._get_channel(provider, model)
        if not ch:
            raise ValueError("没有可用渠道，请先在「渠道管理」中添加API渠道")
        if not m:
            raise ValueError(f"渠道「{ch.name}」未配置模型，请先获取模型列表并启用")
        return await self._call_api(ch, m, prompt, stream=False)

    async def generate_stream(self, prompt: str, provider: str = "", model: str = "") -> AsyncIterator[str]:
        ch, m = self._get_channel(provider, model)
        if not ch:
            raise ValueError("没有可用渠道，请先在「渠道管理」中添加API渠道")
        if not m:
            raise ValueError(f"渠道「{ch.name}」未配置模型，请先获取模型列表并启用")
        async for chunk in self._call_api_stream(ch, m, prompt):
            yield chunk

    def _build_headers(self, ch: Channel) -> dict:
        headers = {"Content-Type": "application/json"}
        api_key = decrypt_secret(ch.api_key)
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    async def _call_api(self, ch: Channel, model: str, prompt: str, stream: bool = False) -> str:
        url = f"{ch.base_url.rstrip('/')}/chat/completions"
        headers = self._build_headers(ch)
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"API调用失败 ({resp.status_code}): {resp.text[:300]}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_api_stream(self, ch: Channel, model: str, prompt: str) -> AsyncIterator[str]:
        url = f"{ch.base_url.rstrip('/')}/chat/completions"
        headers = self._build_headers(ch)
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                if resp.status_code != 200:
                    text = ""
                    async for chunk in resp.aiter_text():
                        text += chunk
                    raise ValueError(f"API调用失败 ({resp.status_code}): {text[:300]}")
                buffer = ""
                async for chunk in resp.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            return
                        try:
                            data = json.loads(data_str)
                            delta = data.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            pass


dispatcher = ChannelDispatcher()
