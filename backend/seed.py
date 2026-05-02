from sqlalchemy.orm import Session
from backend.models.case import Case
from backend.models.material import Material
from backend.models.party import Party
from backend.models.workflow import WorkflowNode
import uuid


def seed_demo_data(db: Session):
    if db.query(Case).first():
        return
    case_id = str(uuid.uuid4())
    case = Case(
        id=case_id,
        name="张三诉李四民间借贷纠纷",
        description="原告张三与被告李四民间借贷纠纷一案，涉及借款本金50万元及利息",
        case_type="债权债务",
        case_number="(2024)京0105民初12345号",
        court="北京市朝阳区人民法院",
        cause="民间借贷纠纷",
        filing_date="2024-06-15",
        status="in_progress",
    )
    db.add(case)
    db.flush()

    parties = [
        Party(id=str(uuid.uuid4()), case_id=case_id, name="张三", role="原告",
              id_number="110105199001011234", address="北京市朝阳区建国路88号",
              phone="13800138001", notes=""),
        Party(id=str(uuid.uuid4()), case_id=case_id, name="李四", role="被告",
              id_number="110105198505052345", address="北京市海淀区中关村大街1号",
              phone="13900139001", notes=""),
    ]
    for p in parties:
        db.add(p)

    material_id = str(uuid.uuid4())
    db.add(Material(
        id=material_id, case_id=case_id, filename="借款合同.pdf", file_type=".pdf",
        file_path="demo/借款合同.pdf",
        file_size=102400, parse_status="completed",
        parsed_content="借款合同\n甲方（出借人）：张三\n乙方（借款人）：李四\n借款金额：人民币50万元整\n借款期限：2023年1月1日至2024年1月1日\n年利率：8%\n还款方式：到期一次性还本付息",
        structured_data='{"parties":"甲方：张三（出借人），乙方：李四（借款人）","case_facts":"2023年1月1日，张三向李四出借50万元，约定期限1年，年利率8%，到期一次性还本付息","timeline":"2023-01-01 签订借款合同并转账\\n2024-01-01 借款到期，李四未还款\\n2024-03-15 张三发送催款通知\\n2024-06-15 张三起诉至法院","evidence":"1. 借款合同原件，证明借贷关系\\n2. 银行转账记录，证明已交付借款\\n3. 催款通知及快递回执"}',
    ))

    stages = [
        ("fact_extraction", "## 当事人信息\n- 原告：张三\n- 被告：李四\n\n## 关键事实\n2023年1月1日，原告张三与被告李四签订借款合同，约定张三向李四出借人民币50万元整，借款期限1年，年利率8%，到期一次性还本付息。合同签订后，张三通过银行转账将50万元支付给李四。\n\n2024年1月1日借款到期后，李四未按约归还本息。2024年3月15日，张三向李四发送催款通知，要求其10日内还款，李四仍未履行还款义务。\n\n## 证据清单\n1. 借款合同原件 — 证明双方借贷关系\n2. 银行转账记录 — 证明已交付借款\n3. 催款通知及快递回执 — 证明已催告"),
        ("legal_analysis", "## 法律关系分析\n本案为典型的民间借贷纠纷，法律关系清晰。\n\n## 适用法律\n1. 《中华人民共和国民法典》第六百六十七条 — 借款合同定义\n2. 《中华人民共和国民法典》第六百七十五条 — 借款人返还义务\n3. 《中华人民共和国民法典》第六百七十六条 — 逾期还款责任\n4. 最高人民法院《关于审理民间借贷案件适用法律若干问题的规定》\n\n## 分析意见\n1. 借贷关系成立：双方签订了书面借款合同，且有银行转账记录佐证款项交付\n2. 被告违约：借款到期后被告未按约归还本息，构成违约\n3. 原告诉请合理：本金50万元及按年利率8%计算的利息，未超过法律保护上限"),
        ("dispute_focus", "## 争议焦点\n\n### 焦点一：借款事实是否成立\n原告提供了借款合同及银行转账记录，借贷事实清楚，证据充分。\n\n### 焦点二：利息计算标准\n合同约定年利率8%，未超过一年期贷款市场报价利率的四倍，应予支持。\n\n### 焦点三：被告的抗辩理由\n被告可能主张已部分还款或存在其他抗辩事由，需在庭审中核实。"),
        ("draft_generation", "# 民事起诉状\n\n## 原告\n张三，男，1990年1月1日出生，汉族，住北京市朝阳区建国路88号，电话：13800138001\n\n## 被告\n李四，男，1985年5月5日出生，汉族，住北京市海淀区中关村大街1号，电话：13900139001\n\n## 诉讼请求\n1. 判令被告归还原告借款本金人民币50万元整；\n2. 判令被告支付借款利息（以50万元为基数，按年利率8%自2023年1月1日起计算至实际清偿之日止）；\n3. 本案诉讼费用由被告承担。\n\n## 事实与理由\n2023年1月1日，原告与被告签订《借款合同》，约定原告向被告出借人民币50万元整，借款期限为一年（自2023年1月1日至2024年1月1日），年利率8%，到期一次性还本付息。合同签订当日，原告通过银行转账向被告支付了借款50万元。\n\n借款到期后，被告未按约归还借款本息。2024年3月15日，原告向被告发送催款通知，要求被告在10日内归还全部借款本息，但被告至今仍未履行还款义务。\n\n原告认为，被告的行为已严重违反合同约定，损害了原告的合法权益。根据《中华人民共和国民法典》第六百七十五条、第六百七十六条的规定，原告有权要求被告归还借款本金并支付逾期利息。\n\n此致\n北京市朝阳区人民法院\n\n具状人：张三\n2024年6月15日"),
        ("review_optimization", "## 审查意见\n\n### 格式审查\n- 起诉状格式规范，包含当事人信息、诉讼请求、事实理由等必要要素 ✓\n- 管辖法院表述正确 ✓\n\n### 内容审查\n- 诉讼请求明确具体，具有可执行性 ✓\n- 事实陈述清楚，时间线完整 ✓\n- 法律依据引用准确 ✓\n\n### 建议优化\n1. 可补充证据清单作为附件\n2. 利息计算可明确暂计金额\n3. 可增加财产保全申请"),
    ]
    for stage, output in stages:
        db.add(WorkflowNode(
            id=str(uuid.uuid4()), case_id=case_id, stage=stage,
            output=output, prompt="", model_used="demo",
            version=1, status="completed",
        ))
    db.commit()
