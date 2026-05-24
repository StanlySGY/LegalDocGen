import json
import uuid
from sqlalchemy.orm import Session
from backend.models.case_template import CaseTemplate

BUILT_IN_TEMPLATES = [
    {
        "name": "合同纠纷案件",
        "description": "适用于买卖合同、服务合同、租赁合同等各类合同纠纷",
        "category": "contract",
        "materials_checklist": [
            {"name": "合同原件或复印件", "description": "双方签署的完整合同文本", "required": True},
            {"name": "当事人身份证明", "description": "身份证、营业执照等", "required": True},
            {"name": "履行情况证明", "description": "付款凭证、收据、邮件等", "required": True},
            {"name": "违约证据", "description": "对方违约的证据材料", "required": True},
            {"name": "沟通记录", "description": "邮件、短信、聊天记录等", "required": False},
            {"name": "其他相关文件", "description": "发票、送货单等", "required": False},
        ],
        "default_prompts": {
            "fact_extraction": """请从以下合同纠纷案件材料中提取关键要素：

【材料内容】
{materials}

请按以下格式提取：
1. 当事人信息：原告/申请人、被告/被申请人的基本信息
2. 合同基本信息：合同类型、签署时间、合同金额、主要条款
3. 事实经过：按时间顺序描述合同履行过程和违约情况
4. 时间节点：关键日期（签署日、付款日、违约日等）
5. 争议焦点：双方的主要分歧点""",
            "legal_analysis": """基于以下案件事实，进行法律关系分析：

【案件事实】
{previous_context}

【参考材料】
{materials}

请分析：
1. 法律关系性质：确定合同类型和法律关系
2. 适用法律：列出相关的法律、法规、司法解释
3. 权利义务分析：双方的权利和义务
4. 违约责任：违约方应承担的责任
5. 风险点分析：案件的关键风险点和突破口""",
            "dispute_focus": """基于以下法律分析，整理争议焦点：

【法律分析】
{previous_context}

请整理：
1. 核心争议点（3-5个）：最关键的法律问题
2. 事实争议：双方对哪些事实有争议
3. 法律争议：双方对法律适用有争议的地方
4. 证据关键点：最能证明我方主张的证据
5. 对方可能的抗辩：预判对方的主要抗辩理由""",
            "draft_generation": """基于以下争议焦点，生成法律文书初稿：

【争议焦点】
{previous_context}

请生成一份完整的法律文书，包括：
1. 文书标题和当事人信息
2. 诉讼请求/仲裁请求
3. 事实与理由（按逻辑顺序论述）
4. 法律依据（引用具体法条）
5. 结尾和签署部分""",
            "review_optimization": """请对以下法律文书进行审查和优化：

【原文书】
{previous_context}

请进行以下审查：
1. 逻辑性检查：论证是否严密、层次是否清晰
2. 法律性检查：法律引用是否准确、是否有遗漏
3. 完整性检查：是否包含所有必要部分
4. 表述优化：语言是否专业、表述是否准确
5. 提出修改建议，给出优化后的版本""",
        },
    },
    {
        "name": "劳动争议案件",
        "description": "适用于劳动合同纠纷、工伤保险、社会保险等劳动争议",
        "category": "labor",
        "materials_checklist": [
            {"name": "劳动合同", "description": "双方签署的劳动合同", "required": True},
            {"name": "员工身份证明", "description": "身份证复印件", "required": True},
            {"name": "公司营业执照", "description": "营业执照复印件", "required": True},
            {"name": "工资支付凭证", "description": "工资条、银行转账记录", "required": True},
            {"name": "考勤记录", "description": "打卡记录、考勤表", "required": True},
            {"name": "解除通知", "description": "解除劳动关系的通知书", "required": True},
            {"name": "医疗诊断", "description": "工伤认定书、医疗诊断证明（如涉及）", "required": False},
        ],
        "default_prompts": {
            "fact_extraction": """请从以下劳动争议案件材料中提取关键要素：

【材料内容】
{materials}

请按以下格式提取：
1. 当事人信息：员工和用人单位的基本信息
2. 劳动关系基本情况：入职时间、岗位、工资等
3. 事实经过：工作期间的关键事件和争议发生过程
4. 争议事项：工资、加班费、解除补偿等
5. 时间节点：入职日期、争议发生日期、解除日期等""",
            "legal_analysis": """基于以下案件事实，进行法律关系分析：

【案件事实】
{previous_context}

请分析：
1. 劳动关系认定：是否存在劳动关系
2. 适用法律：《劳动法》《劳动合同法》等相关规定
3. 权利义务分析：双方的权利和义务
4. 违法行为认定：用人单位是否存在违法行为
5. 赔偿责任：应赔偿的项目和金额计算""",
            "dispute_focus": """基于以下法律分析，整理争议焦点：

【法律分析】
{previous_context}

请整理：
1. 核心争议点：劳动关系认定、工资计算、赔偿责任等
2. 事实争议：工作时间、工资标准、解除原因等
3. 法律争议：法律适用和解释的分歧
4. 证据关键点：最能证明我方主张的证据
5. 对方可能的抗辩：预判对方的主要抗辩理由""",
            "draft_generation": """基于以下争议焦点，生成法律文书初稿：

【争议焦点】
{previous_context}

请生成一份完整的仲裁申请书或诉状，包括：
1. 申请人/原告和被申请人/被告信息
2. 仲裁请求/诉讼请求（明确金额）
3. 事实与理由（按时间顺序论述）
4. 法律依据（引用具体法条）
5. 证据清单和结尾部分""",
            "review_optimization": """请对以下法律文书进行审查和优化：

【原文书】
{previous_context}

请进行以下审查：
1. 请求金额是否准确、计算是否合理
2. 法律引用是否符合最新规定
3. 事实陈述是否完整、逻辑是否清晰
4. 证据是否充分支撑主张
5. 提出修改建议，给出优化后的版本""",
        },
    },
    {
        "name": "房产纠纷案件",
        "description": "适用于房屋买卖、租赁、产权纠纷等房产相关案件",
        "category": "property",
        "materials_checklist": [
            {"name": "房产证或不动产权证", "description": "房产权属证明", "required": True},
            {"name": "买卖合同或租赁合同", "description": "双方签署的合同", "required": True},
            {"name": "当事人身份证明", "description": "身份证或营业执照", "required": True},
            {"name": "付款凭证", "description": "转账记录、收据等", "required": True},
            {"name": "房屋检验报告", "description": "房屋质量、面积等检验报告", "required": False},
            {"name": "中介协议", "description": "如涉及中介的协议", "required": False},
        ],
        "default_prompts": {
            "fact_extraction": """请从以下房产纠纷案件材料中提取关键要素：

【材料内容】
{materials}

请按以下格式提取：
1. 当事人信息：买卖双方或出租人、承租人信息
2. 房产基本信息：位置、面积、产权情况
3. 交易基本情况：交易价格、支付方式、交易时间
4. 履行情况：款项支付、房屋交付等
5. 争议事项：价格纠纷、交付延迟、产权问题等""",
            "legal_analysis": """基于以下案件事实，进行法律关系分析：

【案件事实】
{previous_context}

请分析：
1. 法律关系性质：买卖关系、租赁关系等
2. 适用法律：《民法典》房产相关规定
3. 权利义务分析：双方的权利和义务
4. 违约责任：违约方应承担的责任
5. 产权风险：产权瑕疵和风险分析""",
            "dispute_focus": """基于以下法律分析，整理争议焦点：

【法律分析】
{previous_context}

请整理：
1. 核心争议点：产权、价格、交付等关键问题
2. 事实争议：房屋状况、交付时间等
3. 法律争议：法律适用的分歧
4. 证据关键点：最能证明我方主张的证据
5. 对方可能的抗辩：预判对方的主要抗辩理由""",
            "draft_generation": """基于以下争议焦点，生成法律文书初稿：

【争议焦点】
{previous_context}

请生成一份完整的诉状，包括：
1. 原告和被告信息
2. 诉讼请求（明确金额和具体要求）
3. 事实与理由（详细论述）
4. 法律依据（引用具体法条）
5. 证据清单和结尾部分""",
            "review_optimization": """请对以下法律文书进行审查和优化：

【原文书】
{previous_context}

请进行以下审查：
1. 产权问题是否充分论述
2. 损失赔偿计算是否准确
3. 法律引用是否准确
4. 事实陈述是否完整
5. 提出修改建议，给出优化后的版本""",
        },
    },
    {
        "name": "侵权纠纷案件",
        "description": "适用于人身伤害、财产损害、名誉权等侵权案件",
        "category": "tort",
        "materials_checklist": [
            {"name": "侵权事实证明", "description": "事故报告、现场照片等", "required": True},
            {"name": "受害人身份证明", "description": "身份证复印件", "required": True},
            {"name": "侵权人身份证明", "description": "身份证或营业执照", "required": True},
            {"name": "医疗诊断证明", "description": "医院诊断书、病历等", "required": True},
            {"name": "医疗费用凭证", "description": "医疗费发票、清单", "required": True},
            {"name": "证人证言", "description": "目击者证言", "required": False},
            {"name": "保险单据", "description": "保险合同、理赔记录", "required": False},
        ],
        "default_prompts": {
            "fact_extraction": """请从以下侵权纠纷案件材料中提取关键要素：

【材料内容】
{materials}

请按以下格式提取：
1. 当事人信息：受害人、侵权人的基本信息
2. 侵权事实：侵权行为的具体情况
3. 损害结果：人身伤害、财产损失等
4. 因果关系：侵权行为与损害结果的关系
5. 时间节点：侵权发生时间、就医时间等""",
            "legal_analysis": """基于以下案件事实，进行法律关系分析：

【案件事实】
{previous_context}

请分析：
1. 侵权行为认定：是否构成侵权
2. 适用法律：《民法典》侵权责任相关规定
3. 过错认定：侵权人是否存在过错
4. 因果关系：侵权行为与损害的因果关系
5. 赔偿责任：应赔偿的项目和金额""",
            "dispute_focus": """基于以下法律分析，整理争议焦点：

【法律分析】
{previous_context}

请整理：
1. 核心争议点：侵权认定、过错程度、赔偿金额
2. 事实争议：侵权事实、损害程度等
3. 法律争议：责任认定和赔偿范围
4. 证据关键点：最能证明我方主张的证据
5. 对方可能的抗辩：预判对方的主要抗辩理由""",
            "draft_generation": """基于以下争议焦点，生成法律文书初稿：

【争议焦点】
{previous_context}

请生成一份完整的诉状，包括：
1. 原告和被告信息
2. 诉讼请求（明确赔偿金额）
3. 事实与理由（详细论述侵权事实和损害）
4. 法律依据（引用具体法条）
5. 证据清单和结尾部分""",
            "review_optimization": """请对以下法律文书进行审查和优化：

【原文书】
{previous_context}

请进行以下审查：
1. 侵权事实陈述是否清晰、完整
2. 损失计算是否准确、合理
3. 法律引用是否准确
4. 因果关系论述是否充分
5. 提出修改建议，给出优化后的版本""",
        },
    },
]


def init_default_templates(db: Session):
    """初始化默认模板"""
    # 检查是否已存在模板
    existing = db.query(CaseTemplate).count()
    if existing > 0:
        return

    for template_data in BUILT_IN_TEMPLATES:
        template = CaseTemplate(
            id=str(uuid.uuid4()),
            name=template_data["name"],
            description=template_data["description"],
            category=template_data["category"],
            materials_checklist=json.dumps(template_data["materials_checklist"]),
            default_prompts=json.dumps(template_data["default_prompts"]),
            is_default=True,
        )
        db.add(template)

    db.commit()
