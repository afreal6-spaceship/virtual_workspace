"""Per-board architecture documents, separate from legacy tldraw snapshots."""
import hashlib
import json
import re
import threading
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from terminal_manager import terminal_manager

router = APIRouter()
_lock = threading.RLock()

class SaveArchitecture(BaseModel):
    architecture: dict
    revision: str | None = None


def document_path(project_id: str, board_id: str) -> Path:
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', board_id):
        raise HTTPException(400, 'Invalid board ID')
    return terminal_manager.get_project_dir(project_id) / 'architectures' / (board_id + '.json')


def validate_document(a):
    if a.get('format') != 'visual-workspace-architecture' or a.get('version') != 1:
        raise HTTPException(422, 'Unsupported architecture version')
    nodes, edges = a.get('nodes'), a.get('edges')
    if not isinstance(nodes, list) or not isinstance(edges, list) or len(nodes)>2000 or len(edges)>10000:
        raise HTTPException(422, 'Invalid graph size')
    ids = set()
    for n in nodes:
        if not isinstance(n,dict) or not isinstance(n.get('id'),str) or n['id'] in ids or not isinstance(n.get('data'),dict):
            raise HTTPException(422,'Invalid or duplicate node')
        ids.add(n['id'])
    eids=set()
    for e in edges:
        if not isinstance(e,dict) or not isinstance(e.get('id'),str) or e['id'] in eids or e.get('source') not in ids or e.get('target') not in ids:
            raise HTTPException(422,'Invalid or duplicate connection')
        eids.add(e['id'])


def revision(raw):
    return hashlib.sha256(raw).hexdigest() if raw else None


@router.get('/api/projects/{project_id}/architectures/{board_id}')
def read_architecture(project_id: str, board_id: str):
    p=document_path(project_id,board_id)
    try:
        with _lock:
            if not p.exists():return {'exists':False,'revision':None,'architecture':None}
            raw=p.read_bytes()
        return {'exists':True,'revision':revision(raw),'architecture':json.loads(raw)}
    except (OSError,ValueError) as exc:
        raise HTTPException(500,'Could not read architecture') from exc


@router.put('/api/projects/{project_id}/architectures/{board_id}')
def save_architecture(project_id: str, board_id: str, req: SaveArchitecture):
    validate_document(req.architecture)
    raw=json.dumps(req.architecture,indent=2,allow_nan=False).encode()
    if len(raw)>20_000_000:raise HTTPException(413,'Architecture exceeds 20 MB')
    p=document_path(project_id,board_id)
    try:
        with _lock:
            previous=p.read_bytes() if p.exists() else None
            if revision(previous)!=req.revision:raise HTTPException(409,'Architecture changed on disk')
            p.parent.mkdir(exist_ok=True)
            temporary=p.with_suffix('.tmp')
            temporary.write_bytes(raw)
            temporary.replace(p)
        return {'saved':True,'revision':revision(raw)}
    except OSError as exc:raise HTTPException(500,'Could not save architecture') from exc
