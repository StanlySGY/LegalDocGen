import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.database import get_db
from backend.dependencies import require_admin
from backend.models.channel import Channel
from backend.services.secret_service import decrypt_secret, encrypt_secret, mask_secret

router = APIRouter(prefix="/api/channel", tags=["channel"])


class ChannelCreate(BaseModel):
    name: str
    type: str = "openai"
    base_url: str
    api_key: str = ""
    models: list[str] = []
    default_model: str = ""
    priority: int = 0


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    models: Optional[list[str]] = None
    default_model: Optional[str] = None
    status: Optional[int] = None
    priority: Optional[int] = None


def _channel_to_dict(ch: Channel) -> dict:
    return {
        "id": ch.id,
        "name": ch.name,
        "type": ch.type,
        "base_url": ch.base_url,
        "api_key": mask_secret(ch.api_key),
        "api_key_set": bool(decrypt_secret(ch.api_key)),
        "models": json.loads(ch.models) if ch.models else [],
        "default_model": ch.default_model,
        "status": ch.status,
        "test_status": ch.test_status,
        "balance": ch.balance,
        "priority": ch.priority,
        "created_at": ch.created_at.isoformat() if ch.created_at else None,
    }


@router.get("")
def list_channels(db: Session = Depends(get_db)):
    channels = db.query(Channel).order_by(Channel.priority.desc(), Channel.created_at.desc()).all()
    return [_channel_to_dict(ch) for ch in channels]


@router.post("", dependencies=[Depends(require_admin)])
def create_channel(data: ChannelCreate, db: Session = Depends(get_db)):
    ch = Channel(
        name=data.name,
        type=data.type,
        base_url=data.base_url.rstrip("/"),
        api_key=encrypt_secret(data.api_key),
        models=json.dumps(data.models),
        default_model=data.default_model,
        priority=data.priority,
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return _channel_to_dict(ch)


@router.get("/{channel_id}")
def get_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "渠道不存在")
    d = _channel_to_dict(ch)
    d["api_key"] = ""
    return d


@router.put("/{channel_id}", dependencies=[Depends(require_admin)])
def update_channel(channel_id: str, data: ChannelUpdate, db: Session = Depends(get_db)):
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "渠道不存在")
    for k, v in data.model_dump(exclude_unset=True).items():
        if k == "models":
            setattr(ch, k, json.dumps(v))
        elif k == "api_key" and v:
            setattr(ch, k, encrypt_secret(v))
        elif k == "base_url" and v:
            setattr(ch, k, v.rstrip("/"))
        else:
            setattr(ch, k, v)
    db.commit()
    db.refresh(ch)
    return _channel_to_dict(ch)


@router.delete("/{channel_id}", dependencies=[Depends(require_admin)])
def delete_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "渠道不存在")
    db.delete(ch)
    db.commit()
    return {"message": "已删除"}


@router.get("/test/{channel_id}")
async def test_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "渠道不存在")
    result = await _test_connection(ch.base_url, decrypt_secret(ch.api_key))
    ch.test_status = "success" if result["success"] else "failed"
    db.commit()
    return result


@router.post("/test", dependencies=[Depends(require_admin)])
async def test_channel_direct(data: dict):
    base_url = data.get("base_url", "").rstrip("/")
    api_key = data.get("api_key", "")
    return await _test_connection(base_url, api_key)


@router.get("/fetch_models/{channel_id}")
async def fetch_models_from_channel(channel_id: str, db: Session = Depends(get_db)):
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(404, "渠道不存在")
    return await _fetch_models(ch.base_url, decrypt_secret(ch.api_key))


@router.post("/fetch_models", dependencies=[Depends(require_admin)])
async def fetch_models_direct(data: dict):
    base_url = data.get("base_url", "").rstrip("/")
    api_key = data.get("api_key", "")
    return await _fetch_models(base_url, api_key)


@router.get("/models/all")
def get_all_enabled_models(db: Session = Depends(get_db)):
    channels = db.query(Channel).filter(Channel.status == 1).all()
    result = []
    for ch in channels:
        models = json.loads(ch.models) if ch.models else []
        for m in models:
            result.append({
                "model": m,
                "channel_id": ch.id,
                "channel_name": ch.name,
                "channel_type": ch.type,
                "base_url": ch.base_url,
            })
    return result


async def _test_connection(base_url: str, api_key: str) -> dict:
    url = f"{base_url}/models"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return {"success": True, "message": "连接成功", "status_code": resp.status_code}
            else:
                return {"success": False, "message": f"HTTP {resp.status_code}", "status_code": resp.status_code}
    except Exception as e:
        return {"success": False, "message": str(e)[:200]}


async def _fetch_models(base_url: str, api_key: str) -> dict:
    url = f"{base_url}/models"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return {"success": False, "message": f"HTTP {resp.status_code}", "models": []}
            data = resp.json()
            models = []
            if isinstance(data, dict) and "data" in data:
                for item in data["data"]:
                    if isinstance(item, dict) and "id" in item:
                        models.append(item["id"])
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and "id" in item:
                        models.append(item["id"])
                    elif isinstance(item, str):
                        models.append(item)
            models.sort()
            return {"success": True, "models": models, "count": len(models)}
    except Exception as e:
        return {"success": False, "message": str(e)[:200], "models": []}
