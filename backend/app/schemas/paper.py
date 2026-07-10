from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class PaperCreate(BaseModel):
    title: str
    content: Optional[str] = ""
    outline: Optional[str] = ""

class PaperUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    outline: Optional[str] = None

class PaperOut(BaseModel):
    id: int
    user_id: int
    title: str
    content: str
    outline: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
