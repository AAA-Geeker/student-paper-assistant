from tests.conftest import register_user


def test_register_requires_valid_code(client, db):
    # 不带验证码注册应失败（防虚假邮箱的核心约束）
    r = client.post("/api/auth/register", json={"email": "test@example.com", "password": "123456"})
    assert r.status_code == 422


def test_register_and_login(client, db):
    r = register_user(client, db, email="test@example.com")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "test@example.com"
    r = client.post("/api/auth/login", json={"email": "test@example.com", "password": "123456"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_register_wrong_code_fails(client, db):
    r = client.post(
        "/api/auth/register",
        json={"email": "x@example.com", "password": "123456", "code": "000000"},
    )
    assert r.status_code == 400
