from unittest.mock import patch, AsyncMock
from tests.conftest import register_user

def get_token(client, db):
    register_user(client, db, email="u@example.com")
    r = client.post("/api/auth/login", json={"email": "u@example.com", "password": "123456"})
    return r.json()["access_token"]

def test_generate_outline(client, db):
    token = get_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    with patch("app.routers.ai.generate_outline", new_callable=AsyncMock) as mock:
        mock.return_value = "1. 引言\n2. 相关工作"
        r = client.post("/api/ai/outline", json={"title": "测试"}, headers=headers)
    assert r.status_code == 200
    assert "引言" in r.json()["result"]
