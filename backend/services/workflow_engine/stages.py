from backend.models.workflow import StageType, STAGE_ORDER, STAGE_NAMES

TRUSTED_OUTPUT_GUIDE = """

## 可信输出要求
- 仅基于案件材料和前序阶段内容作答，不得编造未出现的事实、证据或程序进展。
- 对关键事实、证据和结论尽量标注依据材料；依据不足时明确写入“需人工核验事项”。
- 法律条文、金额计算和诉讼策略必须提示律师复核；不确定的法条不得强行断言。
- 输出末尾保留“需人工核验事项”小节。
"""

STAGE_PROMPTS = {
    StageType.FACT_EXTRACTION: """你是一名资深律师，请从以下案件材料中提取关键信息。

请按以下结构输出：

## 当事人信息
- 原告：
- 被告：
- 其他当事人：

## 关键事实
按时间顺序列出案件关键事实。

## 时间线
| 时间 | 事件 |
|------|------|
| ... | ... |

## 证据清单
列出已知证据及其证明目的。

---
案件材料：
{materials}
{previous_context}
""" + TRUSTED_OUTPUT_GUIDE,

    StageType.LEGAL_ANALYSIS: """你是一名资深律师，请基于以下案件信息进行法律关系分析。

请分析：

## 法律关系
分析本案涉及的法律关系类型及各方权利义务。

## 适用法律
列出本案可能适用的法律法规及具体条款。

## 有利因素
对我方有利的事实和法律依据。

## 不利因素与风险点
指出潜在的法律风险和不利因素。

---
案件信息：
{materials}
{previous_context}
""" + TRUSTED_OUTPUT_GUIDE,

    StageType.DISPUTE_FOCUS: """你是一名资深律师，请基于以下分析梳理本案的争议焦点。

请输出：

## 核心争议焦点
按重要性排列，列出本案的核心争议点。

对每个争议焦点：
1. 争议描述
2. 各方可能的主张
3. 法律依据
4. 胜诉可能性评估

---
案件信息：
{materials}
{previous_context}
""" + TRUSTED_OUTPUT_GUIDE,

    StageType.DRAFT_GENERATION: """你是一名资深律师，请基于以下分析生成法律文书初稿。

要求：
- 格式规范，符合法律文书标准
- 论点清晰，逻辑严密
- 引用法律条文准确
- 语言正式、专业

请生成完整法律文书：

---
案件信息：
{materials}
{previous_context}
""" + TRUSTED_OUTPUT_GUIDE,

    StageType.REVIEW_OPTIMIZATION: """你是一名法律文书审查专家，请对以下法律文书进行全面审查。

请从以下维度审查：

## 形式审查
- 格式是否规范
- 结构是否完整
- 用语是否准确

## 实体审查
- 事实认定是否准确
- 法律适用是否正确
- 论证逻辑是否严密

## 修改建议
列出具体修改建议及理由。

## 优化版本
提供优化后的文书。

---
原始文书：
{materials}
{previous_context}
""" + TRUSTED_OUTPUT_GUIDE,
}
