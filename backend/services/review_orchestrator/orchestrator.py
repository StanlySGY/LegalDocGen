import json
import asyncio
from typing import AsyncIterator

from backend.services.model_dispatcher.dispatcher import ChannelDispatcher

REVIEW_PROMPT = """你是一名法律文书审查专家，请对以下法律文书进行严格审查。

指出以下问题：
1. 事实认定是否准确、完整
2. 法律适用是否正确
3. 论证逻辑是否严密
4. 格式和用语是否规范
5. 其他需要修改的地方

请逐条列出问题及修改建议。

---
{draft}
"""

OPTIMIZE_PROMPT = """你是一名资深律师，请根据以下审查意见对法律文书进行优化。

原始文书：
{draft}

审查意见：
{review}

请输出优化后的完整法律文书。"""


class ReviewOrchestrator:
    def __init__(self):
        self.dispatcher = ChannelDispatcher()

    async def review_chain(
        self, case_id: str, models: list[dict], context_prompt: str
    ) -> AsyncIterator[dict]:
        gen_ch, gen_m = models[0]["channel_id"], models[0]["model"]
        rev_ch, rev_m = models[1]["channel_id"], models[1]["model"]
        opt_ch, opt_m = models[2]["channel_id"], models[2]["model"]

        # Step 1: Generate draft
        draft_parts = []
        yield {"step": "generate", "status": "running"}
        async for chunk in self.dispatcher.generate_stream(context_prompt, gen_ch, gen_m):
            draft_parts.append(chunk)
            yield {"step": "generate", "chunk": chunk}
        draft = "".join(draft_parts)
        yield {"step": "generate", "status": "done", "output": draft}

        # Step 2: Review draft
        review_prompt = REVIEW_PROMPT.format(draft=draft)
        review_parts = []
        yield {"step": "review", "status": "running"}
        async for chunk in self.dispatcher.generate_stream(review_prompt, rev_ch, rev_m):
            review_parts.append(chunk)
            yield {"step": "review", "chunk": chunk}
        review = "".join(review_parts)
        yield {"step": "review", "status": "done", "output": review}

        # Step 3: Optimize
        optimize_prompt = OPTIMIZE_PROMPT.format(draft=draft, review=review)
        opt_parts = []
        yield {"step": "optimize", "status": "running"}
        async for chunk in self.dispatcher.generate_stream(optimize_prompt, opt_ch, opt_m):
            opt_parts.append(chunk)
            yield {"step": "optimize", "chunk": chunk}
        optimized = "".join(opt_parts)
        yield {"step": "optimize", "status": "done", "output": optimized, "final": True}

    async def multi_compare(
        self, case_id: str, models: list[dict], context_prompt: str
    ) -> AsyncIterator[dict]:
        async def _run_one(m: dict) -> tuple[str, str]:
            ch, mid = m["channel_id"], m["model"]
            output = await self.dispatcher.generate(context_prompt, ch, mid)
            return mid, output

        yield {"status": "running", "total": len(models)}
        results = await asyncio.gather(*[_run_one(m) for m in models])
        outputs = {mid: output for mid, output in results}
        yield {"status": "done", "outputs": outputs, "final": True}
