from tests.conftest import register_user

def get_token(client, db, email="u@example.com"):
    register_user(client, db, email=email)
    r = client.post("/api/auth/login", json={"email": email, "password": "123456"})
    return r.json()["access_token"]

def test_paper_crud(client, db):
    token = get_token(client, db)
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/api/papers", json={"title": "论文标题"}, headers=headers)
    assert r.status_code == 200
    paper_id = r.json()["id"]
    r = client.get("/api/papers", headers=headers)
    assert len(r.json()) == 1
    r = client.put(f"/api/papers/{paper_id}", json={"content": "新内容"}, headers=headers)
    assert r.json()["content"] == "新内容"
    r = client.delete(f"/api/papers/{paper_id}", headers=headers)
    assert r.json()["ok"] is True
