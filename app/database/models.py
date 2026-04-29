from dataclasses import dataclass
from datetime import datetime


@dataclass
class User:
    id: int
    name: str
    total_chats: int
    created_at: datetime


@dataclass
class Emotion:
    id: int
    user_name: str
    emotion: str
    confidence: int
    created_at: datetime


@dataclass
class XP:
    id: int
    user_name: str
    points: int
    reason: str
    created_at: datetime