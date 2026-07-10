def test_register_and_login(client):
    r = client.post("/api/auth/register", json={"email": "test@example.com", "password": "123456"})
    assert r.status_code == 200
    assert r.json()["email"] == "test@example.com"
    r = client.post("/api/auth/login", json={"email": "test@example.com", "password": "123456"})
    assert r.status_code == 200
    assert "access_token" in r.json()
