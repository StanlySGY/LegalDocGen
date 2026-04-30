import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.models.party import Party
from backend.services.model_dispatcher.dispatcher import dispatcher

router = APIRouter(prefix="/api/parties", tags=["parties"])


class PartyCreate(BaseModel):
    name: str
    role: str = ""
    id_number: str = ""
    address: str = ""
    phone: str = ""
    legal_representative: str = ""
    notes: str = ""


class PartyUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    id_number: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    legal_representative: Optional[str] = None
    notes: Optional[str] = None


@router.get("/case/{case_id}")
def list_parties(case_id: str, db: Session = Depends(get_db)):
    parties = db.query(Party).filter(Party.case_id == case_id).order_by(Party.created_at).all()
    return [
        {
            "id": p.id, "name": p.name, "role": p.role,
            "id_number": p.id_number, "address": p.address,
            "phone": p.phone, "legal_representative": p.legal_representative,
            "notes": p.notes, "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in parties
    ]


@router.post("")
def create_party(data: dict, db: Session = Depends(get_db)):
    p = Party(
        case_id=data["case_id"],
        name=data.get("name", ""),
        role=data.get("role", ""),
        id_number=data.get("id_number", ""),
        address=data.get("address", ""),
        phone=data.get("phone", ""),
        legal_representative=data.get("legal_representative", ""),
        notes=data.get("notes", ""),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name}


@router.put("/{party_id}")
def update_party(party_id: str, data: dict, db: Session = Depends(get_db)):
    p = db.query(Party).filter(Party.id == party_id).first()
    if not p:
        raise HTTPException(404, "当事人不存在")
    for k in ["name", "role", "id_number", "address", "phone", "legal_representative", "notes"]:
        if k in data and data[k] is not None:
            setattr(p, k, data[k])
    db.commit()
    return {"message": "已更新"}


@router.delete("/{party_id}")
def delete_party(party_id: str, db: Session = Depends(get_db)):
    p = db.query(Party).filter(Party.id == party_id).first()
    if not p:
        raise HTTPException(404, "当事人不存在")
    db.delete(p)
    db.commit()
    return {"message": "已删除"}


@router.post("/extract/{case_id}")
async def extract_parties(case_id: str, db: Session = Depends(get_db)):
    from backend.models.material import Material
    from backend.services.workflow_engine.engine import WorkflowEngine

    materials = db.query(Material).filter(Material.case_id == case_id).all()
    if not materials:
        raise HTTPException(400, "无案件材料可供提取")

    engine = WorkflowEngine(db)
    context = engine.get_case_context(case_id)
    materials_text = context.get("materials", "")

    prompt = f"""请从以下案件材料中提取所有当事人信息，以JSON数组格式返回。每个当事人包含以下字段：
- name: 姓名/名称
- role: 角色（原告/被告/申请人/被申请人/第三人/上诉人/被上诉人/代理人/其他）
- id_number: 身份证号或统一社会信用代码（如有）
- address: 住址或住所地（如有）
- phone: 联系电话（如有）
- legal_representative: 法定代表人（如有）
- notes: 备注

只返回JSON数组，不要其他内容。例如：
[{{"name":"张三","role":"原告","id_number":"310...","address":"...","phone":"...","legal_representative":"","notes":""}}]

案件材料：
{materials_text}"""

    try:
        result = await dispatcher.generate(prompt)
    except Exception as e:
        raise HTTPException(500, f"AI提取失败: {e}")

    # Parse JSON from result
    try:
        text = result.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        parties_data = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(500, "AI返回格式异常，请重试")

    if not isinstance(parties_data, list):
        raise HTTPException(500, "AI返回格式异常，请重试")

    # Only delete AI-extracted parties, keep manually added ones
    db.query(Party).filter(Party.case_id == case_id, Party.notes == "AI提取").delete()
    created = []
    for pd_item in parties_data:
        p = Party(
            case_id=case_id,
            name=pd_item.get("name", ""),
            role=pd_item.get("role", ""),
            id_number=pd_item.get("id_number", ""),
            address=pd_item.get("address", ""),
            phone=pd_item.get("phone", ""),
            legal_representative=pd_item.get("legal_representative", ""),
            notes="AI提取",
        )
        db.add(p)
        created.append(p)
    db.commit()

    return [
        {
            "id": p.id, "name": p.name, "role": p.role,
            "id_number": p.id_number, "address": p.address,
            "phone": p.phone, "legal_representative": p.legal_representative,
            "notes": p.notes,
        }
        for p in created
    ]
