from unittest.mock import patch, AsyncMock

def get_token(client):
    client.post("/api/auth/register", json={"email": "u@example.com", "password": "123456"})
    r = client.post("/api/auth/login", json={"email": "u@example.com", "password": "123456"})
    return r.json()["access_token"]

def test_generate_outline(client):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    with patch("app.routers.ai.generate_outline", new_callable=AsyncMock) as mock:
        mock.return_value = "1. 引言\n2. 相关工作"
        r = client.post("/api/ai/outline", json={"title": "测试"}, headers=headers)
    assert r.status_code == 200
    assert "引言" in r.json()["result"]
