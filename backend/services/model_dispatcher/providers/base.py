from abc import ABC, abstractmethod
from typing import AsyncIterator


class BaseProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, model: str = "") -> str: ...

    @abstractmethod
    async def generate_stream(self, prompt: str, model: str = "") -> AsyncIterator[str]: ...


class OpenAIProvider(BaseProvider):
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.base_url = base_url

    async def generate(self, prompt: str, model: str = "gpt-4o") -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        resp = await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": prompt}], temperature=0.3
        )
        return resp.choices[0].message.content

    async def generate_stream(self, prompt: str, model: str = "gpt-4o") -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        stream = await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": prompt}], temperature=0.3, stream=True
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class ClaudeProvider(BaseProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, prompt: str, model: str = "claude-sonnet-4-20250514") -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        resp = await client.messages.create(
            model=model, max_tokens=4096, messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text

    async def generate_stream(self, prompt: str, model: str = "claude-sonnet-4-20250514") -> AsyncIterator[str]:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        async with client.messages.stream(
            model=model, max_tokens=4096, messages=[{"role": "user", "content": prompt}]
        ) as stream:
            async for text in stream.text_stream:
                yield text


class CustomProvider(BaseProvider):
    def __init__(self, api_key: str, base_url: str, model_name: str):
        self.api_key = api_key
        self.base_url = base_url
        self.model_name = model_name

    async def generate(self, prompt: str, model: str = "") -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        resp = await client.chat.completions.create(
            model=model or self.model_name, messages=[{"role": "user", "content": prompt}], temperature=0.3
        )
        return resp.choices[0].message.content

    async def generate_stream(self, prompt: str, model: str = "") -> AsyncIterator[str]:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        stream = await client.chat.completions.create(
            model=model or self.model_name, messages=[{"role": "user", "content": prompt}],
            temperature=0.3, stream=True
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
